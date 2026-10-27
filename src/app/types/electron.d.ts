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
  queueWaitMs?: number
  inferenceMs?: number
  totalMs?: number
  mode?: 'server' | 'cli'
}

export interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  onRestore: (callback: () => void) => () => void
  resize: (width: number, height: number) => void
  hide: () => void
  show: (inactive?: boolean) => void
  showInactive: () => void
  setContentProtection: (enable: boolean) => Promise<boolean>
  isContentProtected: () => Promise<boolean>
  setFocusable: (focusable: boolean) => Promise<boolean>
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => Promise<boolean>
  setStealthMode: (enabled: boolean) => Promise<boolean>
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
    prewarm?: () => Promise<boolean>
    downloadModel: (modelId: string) => Promise<{ success: boolean; filePath: string; error?: string }>
    transcribe: (
      audioData: string | ArrayBuffer | Uint8Array | Float32Array | Int16Array,
      options?: {
        modelId?: string
        language?: string
        prompt?: string
        temperature?: number
        timeoutMs?: number
        maxRetries?: number
        sequenceId?: number
      }
    ) => Promise<NativeTranscribeResult>
    onDownloadProgress: (
      callback: (data: { modelId: string; percent: number; loadedMb: number; totalMb: number }) => void
    ) => () => void
    onStateChange?: (
      callback: (data: { state: WhisperProcessState; telemetry: WhisperTelemetry }) => void
    ) => () => void
  }
  sessions?: {
    isFirstRun?: () => Promise<boolean>
    setFirstRunCompleted?: (completed?: boolean) => Promise<boolean>
    getAll: () => Promise<any[]>
    getById: (sessionId: string) => Promise<any | null>
    save: (session: any) => Promise<{ success: boolean; id: string; error?: string } | boolean>
    delete: (sessionId: string) => Promise<boolean>
    deleteMany: (sessionIds: string[]) => Promise<boolean>
    deleteAll: () => Promise<boolean>
    rename: (sessionId: string, newTitle: string) => Promise<boolean>
    rebuildIndex?: () => Promise<any[]>
    getMigrationStatus?: () => Promise<{
      isRunning: boolean
      total: number
      processed: number
      migrated: number
      errors: number
      completed: boolean
    }>
    startMigration?: () => Promise<any>
    recovery?: {
      list: (options?: any) => Promise<any[]>
      append: (event: any) => Promise<boolean>
      checkpoint: (sessionId: string, snapshot?: Record<string, unknown>) => Promise<boolean>
      recover: (sessionId: string) => Promise<any | null>
      complete: (sessionId: string, lifecycle: 'completed' | 'discarded') => Promise<boolean>
      flush?: (sessionId?: string) => Promise<boolean>
    }
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
    streamLLM?: (
      params: { requestId: string; input: any },
      callbacks: {
        onFirstToken?: (data: { requestId: string; ttftMs: number }) => void
        onDelta: (data: { requestId: string; delta: string }) => void
        onDone: (data: {
          requestId: string
          text: string
          modelName: string
          provider: string
          usage?: {
            inputTokens?: number
            outputTokens?: number
            cachedTokens?: number
          }
          benchmark: { ttftMs: number; generationMs: number; outputTokens?: number }
        }) => void
        onError: (data: { requestId: string; error: string; partialText: string }) => void
      }
    ) => () => void
    cancelStreamLLM?: (requestId: string) => void
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
    translateText?: (params: {
      texts: string[]
      sourceLang?: string
      targetLang?: string
      provider?: 'google_translate' | 'deepl'
    }) => Promise<{
      success: boolean
      translations: string[]
      error?: string
      status?: number
      retryAfterSec?: number
    }>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
