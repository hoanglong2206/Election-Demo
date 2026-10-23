// ── Domain Types and Abstractions for Audio Subsystem ─────────────────────────

export type AudioSourceType = 'system' | 'mic'

export interface AudioMetrics {
  volume: number // 0 - 100
  db: number // -60 to 0
  frequencyBands: number[] // 16 bands (0 - 100)
  isAudioDetected: boolean
}

export type AudioChunkLifecycleState = 'recording' | 'queued' | 'processing' | 'released'

export interface AudioLifecycleStats {
  recordingChunks: number
  queuedChunks: number
  processingChunks: number
  releasedChunks: number
  bufferedSeconds: number
  estimatedMemoryBytes: number
  estimatedMemoryMb: number
}

export interface AudioChunkMeta {
  id: number | string
  index: number
  timestamp: string
  durationSec: number
  sizeBytes: number
  sampleCount: number
  rmsDb: number
  state?: AudioChunkLifecycleState
}

export interface AudioSegment {
  blob: Blob
  endSample: number
  sampleCount: number
  hasAudio: boolean
}

export interface PipelineStageInfo {
  stage: number
  name: string
  status: 'idle' | 'processing' | 'active' | 'ready' | 'error'
  detail: string
  subDetail?: string
}

export interface AudioBufferStats {
  durationSec: number
  sizeBytes: number
  totalSamples: number
  hasBuffer: boolean
  bufferedSeconds?: number
  estimatedMemoryBytes?: number
  estimatedMemoryMb?: number
  queuedChunks?: number
  processingChunks?: number
  releasedChunks?: number
}

/**
 * High-performance domain buffer manager abstraction.
 * Completely decoupled from React and Browser UI APIs.
 */
export interface IAudioBufferManager {
  readonly totalSamples: number
  readonly durationSec: number
  readonly sizeBytes: number
  readonly hasBuffer: boolean
  readonly bufferedSeconds: number
  readonly estimatedMemoryBytes: number
  readonly estimatedMemoryMb: number

  appendSamples(pcm16: Int16Array): AudioChunkMeta | null
  getAudioSegmentSince(fromSample?: number, minDurationSec?: number): AudioSegment | null
  getRecentAudioBlob(seconds?: number): Blob | null
  getRecentPcmSamples?(seconds?: number): Int16Array
  getFullWavBlob(): Blob | null
  pruneBefore(sampleIndex: number): void
  markChunkQueued(chunkId: string | number): void
  markChunkProcessing(chunkId: string | number): void
  markChunkReleased(chunkId: string | number): void
  readonly vadEnergyThreshold?: number
  setVadEnergyThreshold?(threshold: number): void
  getVadEnergyThreshold?(): number
  clear(): void
}

/**
 * Capture Engine Type
 */
export type AudioEngineType = 'audio_worklet' | 'script_processor'

export interface AudioCaptureEngineOptions {
  deviceId?: string
  targetSampleRate?: number
  chunkSize?: number
}

/**
 * Capture engine abstraction (Infrastructure contract)
 * Supports both AudioWorkletNode and ScriptProcessorNode fallback.
 */
export interface IAudioCaptureEngine {
  readonly isCapturing: boolean
  readonly engineType: AudioEngineType
  readonly sampleRate: number

  start(
    sourceType: AudioSourceType,
    onAudioProcess: (pcm16: Int16Array) => void,
    options?: AudioCaptureEngineOptions
  ): Promise<void>
  stop(): void
  switchDevice(deviceId: string): Promise<void>
  getMetrics(): AudioMetrics
  getAnalyser?(): AnalyserNode | null
  getByteFrequencyData?(outputArray: Uint8Array<ArrayBuffer>): void
}

/**
 * Backwards compatible alias for capture service
 */
export interface IAudioCaptureService extends IAudioCaptureEngine {}

/**
 * Audio playback service abstraction
 */
export interface IAudioPlaybackService {
  isPlaying: boolean
  play(blob: Blob, onEnd?: () => void): Promise<void>
  stop(): void
}
