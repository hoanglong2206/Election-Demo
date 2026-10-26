import type { STTJob, STTQueueConfig, STTQueueMetrics, TranscribeResult } from './types'
import { TranscriptAssembler } from './transcriptAssembler'
import { transcribeAudio } from './transcribe'
import { encodeWavBlob } from '../../../lib/audioPipeline'
import { getAvailableSTTEngines, getSavedSTTEngineId } from '../aiModels'

/**
 * STTJobQueue
 *
 * Intelligent Speech-to-Text Job Queue and Concurrency Controller.
 * Pipeline: Audio → VAD → AudioChunk → STTJobQueue → Worker Pool → TranscriptAssembler
 *
 * Features:
 * - Strict Concurrency Limits: Local Whisper C++ = 1 worker, Cloud Whisper = 2-4 requests.
 * - Backpressure Protection: Max queue size limit (default 20), drops silence chunks early.
 * - Monotonic Sequence Commitment: Out-of-order worker completions reassembled by sequenceId.
 * - Telemetry: queueDepth, processingJobs, droppedJobs, averageWaitTime.
 * - Lifecycle: pause, resume, clear, provider hot-swapping.
 */
export class STTJobQueue {
  private queue: STTJob[] = []
  private activeJobs = new Set<string>()
  private maxQueueSize: number
  private concurrency: number
  private isPaused = false
  private provider: 'Local' | 'Groq' = 'Local'

  // Telemetry metrics
  private droppedJobsCount = 0
  private completedJobsCount = 0
  private enqueuedJobsCount = 0
  private succeededJobsCount = 0
  private failedJobsCount = 0
  private lastResult: STTQueueMetrics['lastResult'] = null
  private releasedJobsCount = 0
  private totalWaitTimeMs = 0
  private processedWithWaitCount = 0
  private lastQueueWaitMs = 0
  private lastInferenceMs = 0
  private lastTotalMs = 0
  private totalInferenceMs = 0
  private totalJobLatencyMs = 0

  // Native worker supervision telemetry
  private workerState: 'STOPPED' | 'STARTING' | 'READY' | 'BUSY' | 'FAILED' | 'RESTARTING' = 'READY'
  private nativeTelemetry = {
    restartCount: 0,
    timeoutCount: 0,
    crashCount: 0,
    processLatency: 0,
  }

  private listeners = new Set<(metrics: STTQueueMetrics) => void>()
  public readonly assembler: TranscriptAssembler

  constructor(config?: STTQueueConfig, assembler?: TranscriptAssembler) {
    this.maxQueueSize = config?.maxQueueSize ?? 20
    this.assembler = assembler ?? new TranscriptAssembler()

    // Determine initial provider and concurrency
    this.updateProviderFromSaved()
    if (config?.concurrency) {
      this.concurrency = config.concurrency
    } else {
      this.concurrency = this.provider === 'Local' ? 1 : 3
    }

    this.initNativeWorkerListener()
  }

  private initNativeWorkerListener(): void {
    if (typeof window !== 'undefined' && window.api?.nativeWhisper?.onStateChange) {
      window.api.nativeWhisper.onStateChange((data) => {
        this.workerState = data.state
        if (data.telemetry) {
          this.nativeTelemetry = {
            restartCount: data.telemetry.restartCount,
            timeoutCount: data.telemetry.timeoutCount,
            crashCount: data.telemetry.crashCount,
            processLatency: data.telemetry.processLatency,
          }
        }
        this.emitMetrics()
      })

      window.api.nativeWhisper.getProcessState?.().then((res) => {
        if (res) {
          this.workerState = res.state
          if (res.telemetry) {
            this.nativeTelemetry = {
              restartCount: res.telemetry.restartCount,
              timeoutCount: res.telemetry.timeoutCount,
              crashCount: res.telemetry.crashCount,
              processLatency: res.telemetry.processLatency,
            }
          }
          this.emitMetrics()
        }
      }).catch(() => {})
    }
  }

  private updateProviderFromSaved(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.provider = 'Local'
      return
    }
    const engineId = getSavedSTTEngineId()
    const engines = getAvailableSTTEngines()
    const engine = engines.find((e) => e.id === engineId)
    this.provider = engine?.provider === 'Groq' ? 'Groq' : 'Local'
  }

  public setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency)
    this.emitMetrics()
    this.drain()
  }

  public getConcurrency(): number {
    return this.concurrency
  }

  public getMaxQueueSize(): number {
    return this.maxQueueSize
  }

  public setMaxQueueSize(size: number): void {
    this.maxQueueSize = Math.max(1, size)
  }

  /**
   * Adapts provider and concurrency limits when the user switches STT engines.
   * If Local Whisper -> locks concurrency to 1 to protect CPU/CLI child process.
   * If Groq Whisper -> sets concurrency to 3 (within 2-4 concurrent request range).
   */
  public handleProviderSwitch(
    engineId: string,
    options?: { cancelPending?: boolean }
  ): void {
    const engines = getAvailableSTTEngines()
    const engine = engines.find((e) => e.id === engineId)
    const newProvider: 'Local' | 'Groq' = engine?.provider === 'Groq' ? 'Groq' : 'Local'

    this.provider = newProvider
    this.concurrency = newProvider === 'Local' ? 1 : 3

    if (options?.cancelPending && this.queue.length > 0) {
      // Discard pending jobs cleanly and release their audio buffers for GC
      for (const job of this.queue) {
        job.status = 'released'
        job.audioBuffer = null
        this.releasedJobsCount++
        this.assembler.skipSequence(job.sequenceId)
      }
      this.droppedJobsCount += this.queue.length
      this.queue = []
    }

    this.emitMetrics()
    this.drain()
  }

  /**
   * Enqueue STT Job with VAD checking, backpressure protection, priority queuing,
   * and audio chunk lifecycle transitions.
   */
  public enqueue(
    job: STTJob
  ): { enqueued: boolean; reason?: 'silence_vad' | 'backpressure_full' | 'ok' } {
    job.status = 'queued'

    // 1. VAD Check: Drop silence/non-speech chunks before enqueue and immediately release buffer
    if (job.hasSpeech === false) {
      job.status = 'released'
      job.audioBuffer = null
      this.releasedJobsCount++
      this.droppedJobsCount++
      this.assembler.skipSequence(job.sequenceId, job.sessionId)
      this.emitMetrics()
      return { enqueued: false, reason: 'silence_vad' }
    }

    // 2. Backpressure Check: Queue full
    if (this.queue.length >= this.maxQueueSize) {
      // Look for the lowest priority job in queue to evict (searching lowest priority from back)
      let lowPriorityIndex = -1
      let minPriority = job.priority
      for (let i = this.queue.length - 1; i >= 0; i--) {
        if (this.queue[i].priority < minPriority) {
          minPriority = this.queue[i].priority
          lowPriorityIndex = i
        }
      }

      if (lowPriorityIndex !== -1) {
        const evicted = this.queue.splice(lowPriorityIndex, 1)[0]
        evicted.status = 'released'
        evicted.audioBuffer = null
        this.releasedJobsCount++
        this.assembler.skipSequence(evicted.sequenceId, evicted.sessionId)
        this.droppedJobsCount++
      } else {
        // Backpressure reached: Queue is saturated with active speech chunks.
        // We reject the incoming chunk rather than dropping critical voice, and release its buffer
        job.status = 'released'
        job.audioBuffer = null
        this.releasedJobsCount++
        this.droppedJobsCount++
        this.assembler.skipSequence(job.sequenceId, job.sessionId)
        this.emitMetrics()
        return { enqueued: false, reason: 'backpressure_full' }
      }
    }

    // 3. Insert job keeping priority order (higher priority first; equal priority by sequenceId)
    let insertIdx = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      if (job.priority > this.queue[i].priority) {
        insertIdx = i
        break
      } else if (
        job.priority === this.queue[i].priority &&
        job.sequenceId < this.queue[i].sequenceId
      ) {
        insertIdx = i
        break
      }
    }
    this.queue.splice(insertIdx, 0, job)
    this.enqueuedJobsCount++

    this.emitMetrics()
    this.drain()
    return { enqueued: true, reason: 'ok' }
  }

  /**
   * Drain queue by dispatching jobs to available workers up to concurrency limit.
   */
  private drain(): void {
    if (this.isPaused) return

    while (this.activeJobs.size < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!
      job.status = 'processing'
      this.activeJobs.add(job.jobId)

      // Calculate wait time
      const waitTime = Math.max(0, Date.now() - job.createdAt)
      this.totalWaitTimeMs += waitTime
      this.processedWithWaitCount++

      this.emitMetrics()
      this.executeJob(job)
    }
  }

  private async executeJob(job: STTJob): Promise<void> {
    job.retryCount = job.retryCount ?? 0
    job.maxRetries = job.maxRetries ?? 2

    const waitTime = Math.max(0, Date.now() - job.createdAt)
    const execStartTime = performance.now()

    try {
      if (!job.audioBuffer) {
        throw new Error('AudioBuffer has already been released or is missing')
      }

      const engineId = job.engineId || getSavedSTTEngineId()
      const lang = job.language || 'auto'

      // For Local Whisper, pass Int16Array/Blob directly across IPC (no wav encode needed)
      // For Cloud Groq, normalize to WAV Blob if Int16Array
      let audioPayload: any = job.audioBuffer
      if (this.provider !== 'Local' && !(job.audioBuffer instanceof Blob)) {
        audioPayload = encodeWavBlob(job.audioBuffer as any, 16000)
      }

      const result = await transcribeAudio(audioPayload, engineId, lang, job.prompt, job.sessionId)

      const inferenceTime = result.inferenceMs || result.latencyMs || Math.round(performance.now() - execStartTime)
      const totalTime = waitTime + inferenceTime

      result.queueWaitMs = waitTime
      result.inferenceMs = inferenceTime
      result.totalMs = totalTime

      this.lastQueueWaitMs = waitTime
      this.lastInferenceMs = inferenceTime
      this.lastTotalMs = totalTime
      this.totalInferenceMs += inferenceTime
      this.totalJobLatencyMs += totalTime

      if (result.success) {
        this.assembler.receiveResult(job.sequenceId, result, job)
        // Release buffer reference immediately on successful transcription for V8 GC
        job.status = 'released'
        job.audioBuffer = null
        this.releasedJobsCount++
        this.completedJobsCount++
        this.succeededJobsCount++
        this.lastResult = { success: true, at: Date.now() }
      } else {
        // Failed attempt - check retry limit
        if (job.retryCount < job.maxRetries) {
          job.retryCount++
          console.warn(`[STTJobQueue] Retrying job ${job.jobId} (attempt ${job.retryCount}/${job.maxRetries})`)
          job.status = 'queued'
          this.activeJobs.delete(job.jobId)
          this.queue.unshift(job) // Re-enqueue for retry
          return
        } else {
          // Exceeded retry limit -> commit error result and release buffer
          this.assembler.receiveResult(job.sequenceId, result, job)
          job.status = 'released'
          job.audioBuffer = null
          this.releasedJobsCount++
          this.completedJobsCount++
          this.failedJobsCount++
          this.lastResult = {
            success: false,
            at: Date.now(),
            error: result.error || 'STT không trả về kết quả thành công.',
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[STTJobQueue] Job ${job.jobId} error:`, err)
      if (job.retryCount < job.maxRetries) {
        job.retryCount++
        job.status = 'queued'
        this.activeJobs.delete(job.jobId)
        this.queue.unshift(job)
        return
      }

      const errResult: TranscribeResult = {
        success: false,
        text: '',
        translatedVi: '',
        latencyMs: 0,
        engineId: job.engineId || 'unknown',
        engineName: 'Unknown',
        provider: this.provider,
        confidence: 0,
        error: err instanceof Error ? err.message : String(err),
      }
      this.assembler.receiveResult(job.sequenceId, errResult, job)
      job.status = 'released'
      job.audioBuffer = null
      this.releasedJobsCount++
      this.completedJobsCount++
      this.failedJobsCount++
      this.lastResult = { success: false, at: Date.now(), error: errResult.error }
    } finally {
      this.activeJobs.delete(job.jobId)
      if (job.status === 'released') {
        job.audioBuffer = null
      }
      this.emitMetrics()
      // Drain next available job
      this.drain()
    }
  }

  public pause(): void {
    this.isPaused = true
    this.emitMetrics()
  }

  public resume(): void {
    this.isPaused = false
    this.emitMetrics()
    this.drain()
  }

  public clear(): void {
    for (const job of this.queue) {
      job.status = 'released'
      job.audioBuffer = null
      this.releasedJobsCount++
      this.assembler.skipSequence(job.sequenceId, job.sessionId)
    }
    this.droppedJobsCount += this.queue.length
    this.queue = []
    this.emitMetrics()
  }

  public reset(newSessionId = 'session_' + Date.now()): void {
    this.clear()
    this.assembler.reset(1)
    this.assembler.setSessionId(newSessionId, 1)
    this.droppedJobsCount = 0
    this.completedJobsCount = 0
    this.enqueuedJobsCount = 0
    this.succeededJobsCount = 0
    this.failedJobsCount = 0
    this.lastResult = null
    this.releasedJobsCount = 0
    this.totalWaitTimeMs = 0
    this.processedWithWaitCount = 0
    this.lastQueueWaitMs = 0
    this.lastInferenceMs = 0
    this.lastTotalMs = 0
    this.totalInferenceMs = 0
    this.totalJobLatencyMs = 0
    this.emitMetrics()
  }

  public getMetrics(): STTQueueMetrics {
    const avgWait =
      this.processedWithWaitCount > 0
        ? Math.round(this.totalWaitTimeMs / this.processedWithWaitCount)
        : 0
    const avgInference =
      this.completedJobsCount > 0
        ? Math.round(this.totalInferenceMs / this.completedJobsCount)
        : 0
    const avgTotal =
      this.completedJobsCount > 0
        ? Math.round(this.totalJobLatencyMs / this.completedJobsCount)
        : 0

    return {
      queueDepth: this.queue.length,
      processingJobs: this.activeJobs.size,
      droppedJobs: this.droppedJobsCount,
      completedJobs: this.completedJobsCount,
      enqueuedJobs: this.enqueuedJobsCount,
      succeededJobs: this.succeededJobsCount,
      failedJobs: this.failedJobsCount,
      lastResult: this.lastResult,
      averageWaitTime: avgWait,
      concurrency: this.concurrency,
      isPaused: this.isPaused,
      provider: this.provider,
      workerState: this.provider === 'Local' ? this.workerState : undefined,
      nativeTelemetry: this.provider === 'Local' ? this.nativeTelemetry : undefined,
      queuedChunks: this.queue.length,
      processingChunks: this.activeJobs.size,
      releasedChunks: this.releasedJobsCount,
      bufferedSeconds: Math.round(this.queue.length * 1.0 * 10) / 10,
      estimatedMemoryMb: Math.round(((this.queue.length * 32 * 1024) / (1024 * 1024)) * 100) / 100,
      lastQueueWaitMs: this.lastQueueWaitMs,
      lastInferenceMs: this.lastInferenceMs,
      lastTotalMs: this.lastTotalMs,
      avgInferenceMs: avgInference,
      avgTotalMs: avgTotal,
    }
  }

  public subscribe(listener: (metrics: STTQueueMetrics) => void): () => void {
    this.listeners.add(listener)
    listener(this.getMetrics())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emitMetrics(): void {
    const m = this.getMetrics()
    for (const listener of this.listeners) {
      try {
        listener(m)
      } catch (err) {
        console.error('[STTJobQueue] Listener error:', err)
      }
    }
  }
}

// Global shared singleton
export const sttJobQueue = new STTJobQueue()
