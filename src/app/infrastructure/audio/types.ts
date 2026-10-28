import type {
  AudioChunkMeta,
  AudioEngineType,
  AudioMetrics,
  AudioSegment,
  AudioSourceType,
  IAudioBufferManager,
  IAudioCaptureService,
  IAudioPlaybackService,
  PipelineStageInfo,
} from '@/core/audio/types'

export type AudioPipelineLifecycleState =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'stopping'
  | 'error'

export interface AudioPipelineState {
  lifecycleState: AudioPipelineLifecycleState
  isCapturing: boolean
  isStarting: boolean
  sourceType: AudioSourceType
  volume: number
  db: number
  frequencyBands: number[]
  isAudioDetected: boolean
  error: string | null

  // Buffer stats
  bufferDurationSec: number
  bufferSizeBytes: number
  totalSamples: number
  bufferedSeconds: number
  estimatedMemoryMb: number
  chunks: AudioChunkMeta[]
  hasBuffer: boolean

  // Playback
  isPlaying: boolean

  // Hardware & engine
  engineType: AudioEngineType
  inputSampleRateHz: number | null
  vadEnergyThreshold: number
  pipelineStages: PipelineStageInfo[]
}

export interface AudioPipelineControllerDeps {
  captureService?: IAudioCaptureService
  bufferManager?: IAudioBufferManager
  playbackService?: IAudioPlaybackService
  getSavedDeviceId?: () => string
  getEffectiveThreshold?: (deviceId?: string) => number
}

export interface AudioPipelineActions {
  setSourceType: (type: AudioSourceType) => void
  startCapture: (sourceType?: AudioSourceType, options?: { deviceId?: string }) => Promise<void>
  stopCapture: () => void
  switchDevice: (deviceId: string) => Promise<void>
  playBuffer: () => Promise<void>
  stopPlayback: () => void
  clearBuffer: () => void
  downloadWav: (filename?: string) => void
  getWavBlob: () => Blob | null
  getRecentAudioBlob: (seconds?: number) => Blob | null
  getRecentPcmSamples: (seconds?: number) => Int16Array
  getAudioSegmentSince: (fromSample?: number, minDurationSec?: number) => AudioSegment | null
  getRawSamplesSince: (fromSample?: number) => any
  subscribeAudioFrames: (listener: (pcm16: Int16Array, totalSamples: number) => void) => () => void
  pruneBefore: (sampleIndex: number) => void
  getLifecycleStats: () => any
  setVadEnergyThreshold: (threshold: number) => void
  getAudioMetrics: () => AudioMetrics
  getAnalyser: () => AnalyserNode | null
}
