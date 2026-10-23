import type { AudioChunkLifecycleState } from '../../../core/audio/types'

export interface TranscribeResult {
  success: boolean
  text: string
  translatedVi: string
  latencyMs: number
  engineId: string
  engineName: string
  provider: 'Local' | 'Groq'
  isNative?: boolean
  confidence: number
  error?: string
}

export type STTJobPriority = 'low' | 'normal' | 'high'

/**
 * Detailed specification for a Speech-to-Text unit of work in the queue pipeline.
 */
export interface STTJob {
  jobId: string
  sessionId: string
  sequenceId: number
  audioBuffer: Blob | Int16Array | null
  createdAt: number
  priority: number // Higher number = higher processing priority (e.g., normal: 0, high: 10)
  status?: AudioChunkLifecycleState
  hasSpeech?: boolean // True if VAD detected active speech in this chunk
  engineId?: string
  language?: string
  prompt?: string // Contextual vocabulary prompt (initial_prompt for Whisper)
  sourceType?: 'system' | 'mic'
  speakerLabel?: string
  timestampStr?: string
  retryCount?: number
  maxRetries?: number
}

/**
 * Real-time telemetry metrics emitted by STTJobQueue.
 */
export interface STTQueueMetrics {
  queueDepth: number // Number of jobs waiting in queue
  processingJobs: number // Number of jobs actively executing in worker pool
  droppedJobs: number // Total silence / backpressure dropped jobs
  completedJobs: number // Total successfully transcribed jobs
  enqueuedJobs?: number
  succeededJobs?: number
  failedJobs?: number
  lastResult?: {
    success: boolean
    at: number
    error?: string
  } | null
  averageWaitTime: number // Average waiting time in queue in ms
  concurrency: number // Active worker limit (e.g. 1 for Local, 2-4 for Cloud)
  isPaused: boolean // True if queue dispatching is temporarily paused
  provider: 'Local' | 'Groq'
  workerState?: 'STOPPED' | 'STARTING' | 'READY' | 'BUSY' | 'FAILED' | 'RESTARTING'
  nativeTelemetry?: {
    restartCount: number
    timeoutCount: number
    crashCount: number
    processLatency: number
  }
  // Audio Garbage Collection & Lifecycle Telemetry
  queuedChunks?: number
  processingChunks?: number
  releasedChunks?: number
  bufferedSeconds?: number
  estimatedMemoryMb?: number
}

export interface STTQueueConfig {
  maxQueueSize?: number
  concurrency?: number
  provider?: 'Local' | 'Groq'
}

/**
 * Result emitted by TranscriptAssembler when a sequence is ready to commit.
 */
export interface AssemblerCommit {
  sequenceId: number
  jobId: string
  sessionId: string
  result: TranscribeResult
  speakerLabel?: string
  timestampStr?: string
  sourceType?: 'system' | 'mic'
}
