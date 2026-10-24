export type AppMode = 'discussion' | 'interview'

export type WhisperProcessState =
  | 'STOPPED'
  | 'STARTING'
  | 'READY'
  | 'BUSY'
  | 'FAILED'
  | 'RESTARTING'

export interface WhisperTelemetry {
  restartCount: number
  timeoutCount: number
  crashCount: number
  processLatency: number
  lastLatencyMs: number
  totalJobsExecuted: number
  state: WhisperProcessState
}

export interface WhisperHealthCheckResult {
  healthy: boolean
  binaryFound: boolean
  modelFound: boolean
  binaryPath: string | null
  modelPath: string | null
  error?: string
}

export interface NativeWhisperStatus {
  isReady: boolean
  binaryFound: boolean
  binaryPath: string | null
  availableModels: { id: string; name: string; sizeMb: number; downloaded: boolean; path?: string }[]
  activeModel: string | null
  modelsDir: string
  binDir: string
  deviceInfo: string
  state?: WhisperProcessState
  telemetry?: WhisperTelemetry
}

export interface NativeTranscribeResult {
  success: boolean
  text: string
  latencyMs: number
  modelName: string
  isNative: boolean
  error?: string
  retriesUsed?: number
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  onRestore: (callback: () => void) => () => void
  resize: (width: number, height: number) => void
  hide: () => void
  show: () => void
  toggleMode: (mode: AppMode) => void
  toggleAlwaysOnTop: () => Promise<boolean>
  getVersion: () => Promise<string>
  getDesktopSources?: (types?: ('screen' | 'window')[]) => Promise<{ id: string; name: string }[]>
  captureScreen?: (options?: { sourceType?: 'screen' | 'window'; sourceId?: string }) => Promise<{
    success: boolean
    dataUrl?: string
    width?: number
    height?: number
    sourceName?: string
    error?: string
  }>
  nativeWhisper?: {
    getStatus: () => Promise<NativeWhisperStatus>
    getProcessState?: () => Promise<{ state: WhisperProcessState; telemetry: WhisperTelemetry; logs: string[] }>
    healthCheck?: (modelId?: string) => Promise<WhisperHealthCheckResult>
    restartProcess?: () => Promise<boolean>
    downloadModel: (modelId: string) => Promise<{ success: boolean; filePath: string; error?: string }>
    transcribe: (
      audioData: string,
      options?: { modelId?: string; language?: string; prompt?: string; timeoutMs?: number; maxRetries?: number }
    ) => Promise<NativeTranscribeResult>
    onDownloadProgress: (
      callback: (data: { modelId: string; percent: number; loadedMb: number; totalMb: number }) => void
    ) => () => void
    onStateChange?: (
      callback: (data: { state: WhisperProcessState; telemetry: WhisperTelemetry }) => void
    ) => () => void
  }
  sessions?: {
    getAll: () => Promise<any[]>
    save: (session: any) => Promise<boolean>
    delete: (sessionId: string) => Promise<boolean>
    deleteMany: (sessionIds: string[]) => Promise<boolean>
    deleteAll: () => Promise<boolean>
    rename: (sessionId: string, newTitle: string) => Promise<boolean>
  }
  credentials?: {
    isAvailable: () => Promise<boolean>
    saveApiKey: (
      provider: string,
      key: string
    ) => Promise<{ success: boolean; provider: string; maskedKey?: string; error?: string }>
    deleteApiKey: (provider: string) => Promise<{ success: boolean; error?: string }>
    hasApiKey: (provider: string) => Promise<boolean>
    getStatus: (
      provider: string
    ) => Promise<{ provider: string; configured: boolean; maskedKey?: string; updatedAt?: number }>
    getAllStatuses: () => Promise<
      Record<string, { configured: boolean; maskedKey?: string; updatedAt?: number }>
    >
    verifyApiKey: (
      provider: string,
      rawKey?: string
    ) => Promise<{
      valid: boolean
      provider: string
      message: string
      pingMs?: number
      modelCount?: number
      models?: any[]
      sttModels?: any[]
    }>
    testModelAvailability: (
      provider: string,
      rawKey: string,
      modelId: string
    ) => Promise<{ available: boolean; status?: number; code?: string; message: string }>
    callLLM: (
      params: any
    ) => Promise<{
      text: string
      modelName: string
      provider?: string
      usage?: {
        inputTokens?: number
        outputTokens?: number
        cachedTokens?: number
        prompt_tokens?: number
        completion_tokens?: number
        cached_tokens?: number
      }
      benchmark?: { ttftMs: number; generationMs: number; outputTokens?: number }
    } | null>
    callMultimodalLLM?: (
      params: any
    ) => Promise<{
      text: string
      modelName: string
      provider: string
      usage?: {
        inputTokens?: number
        outputTokens?: number
        cachedTokens?: number
        prompt_tokens?: number
        completion_tokens?: number
        cached_tokens?: number
      }
    } | null>
    transcribeGroq: (
      audioBase64: string,
      modelId?: string,
      language?: string,
      prompt?: string
    ) => Promise<{ text: string; latencyMs: number } | null>
    syncModels: () =>
      Promise<{
        totalLoaded: number
        providerBreakdown: string
        models: any[]
        sttModels?: any[]
        configuredProviders?: string[]
      }>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
