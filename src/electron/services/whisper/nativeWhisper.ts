export interface NativeWhisperStatus {
  isReady: boolean
  binaryFound: boolean
  binaryPath: string | null
  availableModels: { id: string; name: string; sizeMb: number; downloaded: boolean; path?: string }[]
  activeModel: string | null
  modelsDir: string
  binDir: string
  deviceInfo: string
}

export interface NativeTranscribeResult {
  success: boolean
  text: string
  latencyMs: number
  modelName: string
  isNative: boolean
  error?: string
}
