import { AudioBufferManager } from '@/core/audio/AudioBufferManager'
import { SpeechSegmenter } from '@/core/audio/SpeechSegmenter'
import { WebAudioCaptureService } from './WebAudioCaptureService'
import { AudioPlaybackService } from './AudioPlaybackService'
import type {
  AudioLifecycleStats,
  AudioMetrics,
  AudioSegment,
  AudioSourceType,
  IAudioBufferManager,
  IAudioCaptureService,
  IAudioPlaybackService,
  SpeechSegment,
  SpeechSegmenterConfig,
} from '@/core/audio/types'
import type {
  AudioPipelineState,
  AudioPipelineControllerDeps,
} from './types'
import { computePipelineStages } from './pipelineStages'

export * from './types'
export * from './pipelineStages'

export class AudioPipelineController {
  private captureService: IAudioCaptureService
  private bufferManager: IAudioBufferManager
  private playbackService: IAudioPlaybackService
  private getSavedDeviceId: () => string
  private getEffectiveThreshold: (deviceId?: string) => number

  private speechSegmenter: SpeechSegmenter | null = null
  private presenceTimer: ReturnType<typeof setInterval> | null = null
  private lastStatsUpdate = 0
  private listeners = new Set<(state: AudioPipelineState) => void>()
  private frameListeners = new Set<(pcm16: Int16Array, totalSamples: number) => void>()
  private segmentListeners = new Set<(segment: SpeechSegment) => void>()

  private state: AudioPipelineState

  constructor(deps?: AudioPipelineControllerDeps) {
    this.captureService = deps?.captureService ?? new WebAudioCaptureService()
    this.bufferManager = deps?.bufferManager ?? new AudioBufferManager()
    this.playbackService = deps?.playbackService ?? new AudioPlaybackService()
    this.getSavedDeviceId = deps?.getSavedDeviceId ?? (() => '')
    this.getEffectiveThreshold = deps?.getEffectiveThreshold ?? (() => 0.008)

    const initialVad = this.bufferManager.vadEnergyThreshold ?? 0.008
    const baseState: Omit<AudioPipelineState, 'pipelineStages'> = {
      lifecycleState: 'idle',
      isCapturing: false,
      isStarting: false,
      sourceType: 'system',
      volume: 0,
      db: -60,
      frequencyBands: new Array(16).fill(0),
      isAudioDetected: false,
      error: null,
      bufferDurationSec: 0,
      bufferSizeBytes: 0,
      totalSamples: 0,
      bufferedSeconds: 0,
      estimatedMemoryMb: 0,
      chunks: [],
      hasBuffer: false,
      isPlaying: false,
      engineType: this.captureService.engineType,
      inputSampleRateHz: null,
      vadEnergyThreshold: initialVad,
    }

    this.state = {
      ...baseState,
      pipelineStages: computePipelineStages(baseState),
    }
  }

  public getState(): AudioPipelineState {
    return this.state
  }

  public subscribe(listener: (state: AudioPipelineState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emitState(): void {
    this.state = {
      ...this.state,
      pipelineStages: computePipelineStages(this.state),
    }
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch (err) {
        console.error('[AudioPipelineController] Listener error:', err)
      }
    }
  }

  private syncBufferStats(force = false): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (!force && now - this.lastStatsUpdate < 200) {
      return
    }
    this.lastStatsUpdate = now

    const hasChanged =
      this.state.totalSamples !== this.bufferManager.totalSamples ||
      this.state.bufferSizeBytes !== this.bufferManager.sizeBytes ||
      this.state.bufferDurationSec !== this.bufferManager.durationSec ||
      this.state.bufferedSeconds !== this.bufferManager.bufferedSeconds ||
      this.state.estimatedMemoryMb !== this.bufferManager.estimatedMemoryMb ||
      this.state.hasBuffer !== this.bufferManager.hasBuffer

    if (hasChanged || force) {
      this.state = {
        ...this.state,
        totalSamples: this.bufferManager.totalSamples,
        bufferSizeBytes: this.bufferManager.sizeBytes,
        bufferDurationSec: this.bufferManager.durationSec,
        bufferedSeconds: this.bufferManager.bufferedSeconds,
        estimatedMemoryMb: this.bufferManager.estimatedMemoryMb,
        hasBuffer: this.bufferManager.hasBuffer,
      }
      this.emitState()
    }
  }

  public setSourceType(sourceType: AudioSourceType): void {
    if (this.state.sourceType !== sourceType) {
      this.state = { ...this.state, sourceType }
      this.emitState()
    }
  }

  public async start(
    sourceType?: AudioSourceType,
    options?: { deviceId?: string }
  ): Promise<void> {
    if (this.state.isStarting) return

    if (sourceType) {
      this.setSourceType(sourceType)
    }

    this.state = {
      ...this.state,
      lifecycleState: 'starting',
      isStarting: true,
      error: null,
    }
    this.emitState()

    this.stop()

    try {
      this.bufferManager.clear()
      this.state = {
        ...this.state,
        chunks: [],
      }
      this.syncBufferStats(true)

      const targetDeviceId = options?.deviceId ?? this.getSavedDeviceId()
      const effectiveVad = this.getEffectiveThreshold(targetDeviceId)
      if (this.bufferManager.setVadEnergyThreshold) {
        this.bufferManager.setVadEnergyThreshold(effectiveVad)
      }

      await this.captureService.start(
        this.state.sourceType,
        (pcm16) => {
          const currentTotal = this.bufferManager.totalSamples
          const readyChunk = this.bufferManager.appendSamples(pcm16)

          if (readyChunk) {
            this.state = {
              ...this.state,
              chunks: [readyChunk, ...this.state.chunks.slice(0, 7)],
            }
          }

          this.syncBufferStats(false)

          // Run segmenter if active
          if (this.speechSegmenter) {
            const closedSegments = this.speechSegmenter.feed(pcm16, currentTotal)
            for (const seg of closedSegments) {
              for (const segListener of this.segmentListeners) {
                try {
                  segListener(seg)
                } catch (err) {
                  console.error('[AudioPipelineController] Segment listener error:', err)
                }
              }
            }
          }

          // Emit to frame listeners
          for (const listener of this.frameListeners) {
            try {
              listener(pcm16, currentTotal)
            } catch (err) {
              console.error('[AudioPipelineController] Frame listener error:', err)
            }
          }
        },
        { deviceId: targetDeviceId }
      )

      this.state = {
        ...this.state,
        lifecycleState: 'capturing',
        isCapturing: true,
        isStarting: false,
        engineType: this.captureService.engineType,
        inputSampleRateHz: this.captureService.sampleRate,
        vadEnergyThreshold: effectiveVad,
      }
      this.emitState()

      // Periodic presence check & hardware disconnect detection
      this.presenceTimer = setInterval(() => {
        if (!this.captureService.isCapturing) {
          this.handleExternalDisconnect()
          return
        }
        const metrics = this.captureService.getMetrics()
        const detected = metrics.isAudioDetected
        if (this.state.isAudioDetected !== detected) {
          this.state = { ...this.state, isAudioDetected: detected }
          this.emitState()
        }
      }, 400)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Lỗi không xác định khi mở âm thanh hệ thống'
      this.state = {
        ...this.state,
        lifecycleState: 'error',
        isStarting: false,
        error: message,
      }
      this.stop()
      throw err
    }
  }

  public stop(): void {
    if (this.presenceTimer) {
      clearInterval(this.presenceTimer)
      this.presenceTimer = null
    }

    this.captureService.stop()

    // Flush segmenter if active
    if (this.speechSegmenter) {
      const flushed = this.speechSegmenter.flush()
      if (flushed && flushed.hasSpeech) {
        for (const segListener of this.segmentListeners) {
          try {
            segListener(flushed)
          } catch (err) {
            console.error('[AudioPipelineController] Flush segment listener error:', err)
          }
        }
      }
    }

    this.state = {
      ...this.state,
      lifecycleState: 'idle',
      isCapturing: false,
      isStarting: false,
      isAudioDetected: false,
      volume: 0,
      db: -60,
      frequencyBands: new Array(16).fill(0),
    }

    this.syncBufferStats(true)
  }

  private handleExternalDisconnect(): void {
    console.warn('[AudioPipelineController] Capture disconnected externally (device lost)')
    this.stop()
  }

  public async switchDevice(deviceId: string): Promise<void> {
    try {
      this.state = { ...this.state, error: null }
      await this.captureService.switchDevice(deviceId)
      const effectiveThreshold = this.getEffectiveThreshold(deviceId)
      if (this.bufferManager.setVadEnergyThreshold) {
        this.bufferManager.setVadEnergyThreshold(effectiveThreshold)
      }
      this.state = {
        ...this.state,
        vadEnergyThreshold: effectiveThreshold,
      }
      this.emitState()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Lỗi khi chuyển đổi thiết bị microphone'
      this.state = { ...this.state, error: message }
      this.emitState()
      throw err
    }
  }

  public async playBuffer(): Promise<void> {
    const blob = this.bufferManager.getFullWavBlob()
    if (!blob) return

    try {
      this.state = { ...this.state, isPlaying: true }
      this.emitState()
      await this.playbackService.play(blob, () => {
        this.state = { ...this.state, isPlaying: false }
        this.emitState()
      })
    } catch (err) {
      console.error('[AudioPipelineController] Playback failed:', err)
      this.state = { ...this.state, isPlaying: false }
      this.emitState()
    }
  }

  public stopPlayback(): void {
    this.playbackService.stop()
    if (this.state.isPlaying) {
      this.state = { ...this.state, isPlaying: false }
      this.emitState()
    }
  }

  public clearBuffer(): void {
    this.stopPlayback()
    this.bufferManager.clear()
    this.state = { ...this.state, chunks: [] }
    this.syncBufferStats(true)
  }

  public downloadWav(filename?: string): void {
    const blob = this.bufferManager.getFullWavBlob()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `system-audio-capture-16khz-${Date.now()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }

  public getWavBlob(): Blob | null {
    return this.bufferManager.getFullWavBlob()
  }

  public getRecentAudioBlob(seconds = 4): Blob | null {
    return this.bufferManager.getRecentAudioBlob(seconds)
  }

  public getRecentPcmSamples(seconds = 3): Int16Array {
    return this.bufferManager.getRecentPcmSamples
      ? this.bufferManager.getRecentPcmSamples(seconds)
      : new Int16Array(0)
  }

  public getAudioSegmentSince(fromSample = 0, minDurationSec = 1.8): AudioSegment | null {
    return this.bufferManager.getAudioSegmentSince(fromSample, minDurationSec)
  }

  public getRawSamplesSince(fromSample = 0) {
    return (this.bufferManager as any).getRawSamplesSince?.(fromSample) ?? null
  }

  public subscribeAudioFrames(
    listener: (pcm16: Int16Array, totalSamples: number) => void
  ): () => void {
    this.frameListeners.add(listener)
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  public initSegmenter(config?: SpeechSegmenterConfig): SpeechSegmenter {
    this.speechSegmenter = new SpeechSegmenter({
      sampleRate: config?.sampleRate ?? 16000,
      silenceEndMs: config?.silenceEndMs ?? 400,
      maxSegmentMs: config?.maxSegmentMs ?? 4500,
      vadThresholdRms: config?.vadThresholdRms ?? 0.015,
    })
    return this.speechSegmenter
  }

  public onSpeechSegment(listener: (segment: SpeechSegment) => void): () => void {
    this.segmentListeners.add(listener)
    return () => {
      this.segmentListeners.delete(listener)
    }
  }

  public pruneBefore(sampleIndex: number): void {
    this.bufferManager.pruneBefore(sampleIndex)
    this.syncBufferStats(false)
  }

  public getLifecycleStats(): AudioLifecycleStats {
    return (this.bufferManager as any).getLifecycleStats?.() ?? {
      recordingChunks: 0,
      queuedChunks: 0,
      processingChunks: 0,
      releasedChunks: 0,
      bufferedSeconds: this.bufferManager.bufferedSeconds,
      estimatedMemoryBytes: this.bufferManager.estimatedMemoryBytes,
      estimatedMemoryMb: this.bufferManager.estimatedMemoryMb,
    }
  }

  public setVadEnergyThreshold(threshold: number): void {
    if (this.bufferManager.setVadEnergyThreshold) {
      this.bufferManager.setVadEnergyThreshold(threshold)
    }
    this.state = { ...this.state, vadEnergyThreshold: threshold }
    this.emitState()
  }

  public getAudioMetrics(): AudioMetrics {
    return this.captureService.getMetrics()
  }

  public getAnalyser(): AnalyserNode | null {
    return this.captureService.getAnalyser ? this.captureService.getAnalyser() : null
  }

  public destroy(): void {
    this.stop()
    this.stopPlayback()
    this.bufferManager.clear()
    this.listeners.clear()
    this.frameListeners.clear()
    this.segmentListeners.clear()
    this.speechSegmenter = null
  }
}
