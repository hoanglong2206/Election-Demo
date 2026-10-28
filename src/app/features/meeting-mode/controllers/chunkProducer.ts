import {
  SpeechSegmenter,
  type SpeechSegment,
  type SpeechSegmentCloseReason,
  speechSegmentationTelemetry,
} from '@/core/audio'
import {
  sttJobQueue,
  type STTJob,
  whisperPromptBuilder,
} from '@/services/ai-model/stt'
import { getSavedSTTEngineId } from '@/services/ai-model/aiModels'
import type { AppMode } from '@/types/electron.d'

export interface ChunkProducerConfig {
  sampleRate?: number
  silenceEndMs?: number
  maxSegmentMs?: number
  vadThresholdRms?: number
}

export interface ChunkDispatchContext {
  sessionId: string
  mode: AppMode
  sourceType: 'mic' | 'system'
  sttLang: string
  activeKeywords?: string[]
  fallbackPrompt?: string
}

export class ChunkProducer {
  private speechSegmenter: SpeechSegmenter | null = null
  private sequenceId = 1
  private lastProcessedSample = 0
  private lastTranscriptText = ''
  private lastCloseReason: SpeechSegmentCloseReason | undefined = undefined

  constructor(config?: ChunkProducerConfig) {
    this.initSegmenter(config)
  }

  public initSegmenter(config?: ChunkProducerConfig): void {
    this.speechSegmenter = new SpeechSegmenter({
      sampleRate: config?.sampleRate ?? 16000,
      silenceEndMs: config?.silenceEndMs ?? 400,
      maxSegmentMs: config?.maxSegmentMs ?? 4500,
      vadThresholdRms: config?.vadThresholdRms ?? 0.015,
    })
  }

  public updateLastTranscriptText(text: string): void {
    this.lastTranscriptText = text
  }

  public getLastCloseReason(): SpeechSegmentCloseReason | undefined {
    return this.lastCloseReason
  }

  public getSequenceId(): number {
    return this.sequenceId
  }

  public getLastProcessedSample(): number {
    return this.lastProcessedSample
  }

  public setLastProcessedSample(sample: number): void {
    this.lastProcessedSample = sample
  }

  public feedPcmFrames(
    pcm16: Int16Array,
    totalSamples: number,
    context: ChunkDispatchContext
  ): SpeechSegment[] {
    if (!this.speechSegmenter) return []

    const closedSegments = this.speechSegmenter.feed(pcm16, totalSamples)
    for (const seg of closedSegments) {
      this.dispatchSegment(seg, context)
    }
    return closedSegments
  }

  public flush(context?: ChunkDispatchContext): SpeechSegment | null {
    if (!this.speechSegmenter) return null

    const flushed = this.speechSegmenter.flush()
    if (flushed && flushed.hasSpeech && context) {
      this.dispatchSegment(flushed, context)
    }
    return flushed
  }

  public reset(): void {
    if (this.speechSegmenter) {
      this.speechSegmenter.reset()
    }
    this.lastProcessedSample = 0
    this.lastCloseReason = undefined
  }

  public resetAll(newSessionId?: string): void {
    this.reset()
    this.sequenceId = 1
    this.lastTranscriptText = ''
    if (newSessionId) {
      sttJobQueue.reset(newSessionId)
    }
  }

  public dispatchSegment(segment: SpeechSegment, context: ChunkDispatchContext): STTJob {
    speechSegmentationTelemetry.recordSegmentClosed(segment)

    this.lastCloseReason = segment.closeReason
    const seqId = this.sequenceId++
    const now = new Date()
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    const speakerLabel =
      context.mode === 'interview'
        ? context.sourceType === 'system'
          ? 'Interviewer'
          : 'You'
        : context.sourceType === 'system'
        ? 'Cuộc họp'
        : 'You'

    const dynamicPrompt =
      whisperPromptBuilder.buildPrompt(context.activeKeywords || [], {
        contextType: context.mode,
        previousTranscript: this.lastTranscriptText,
      }) ||
      context.fallbackPrompt ||
      undefined

    const job: STTJob = {
      jobId: `stt_${context.sessionId}_${seqId}_${Date.now()}`,
      sessionId: context.sessionId,
      sequenceId: seqId,
      audioBuffer: segment.blob,
      hasSpeech: segment.hasSpeech,
      createdAt: Date.now(),
      priority: segment.hasSpeech ? 1 : 0,
      engineId: getSavedSTTEngineId(),
      language: context.sttLang,
      sourceType: context.sourceType,
      speakerLabel,
      timestampStr: timeStr,
      prompt: dynamicPrompt,
      startSample: segment.startSample,
      endSample: segment.endSample,
      durationMs: segment.durationMs,
      closeReason: segment.closeReason,
      continuation: segment.continuation,
      endOfSpeechTimestampMs: segment.endOfSpeechTimestampMs,
    }

    sttJobQueue.enqueue(job)
    return job
  }
}

export const chunkProducer = new ChunkProducer()
