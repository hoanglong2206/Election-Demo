import type {
  IIpcClient,
  IWindowPort,
  ICapturePort,
  IWhisperPort,
  ISessionsPort,
  IUsagePort,
  ICredentialsPort,
} from './ports'
import type { ElectronAPI } from '@/types/electron.d'

function getRawApi(): ElectronAPI | undefined {
  if (typeof window !== 'undefined' && window.api) {
    return window.api
  }
  return undefined
}

export class ElectronIpcAdapter implements IIpcClient {
  public readonly window: IWindowPort = {
    get isAvailable() {
      return Boolean(getRawApi()?.minimize)
    },
    minimize: () => getRawApi()?.minimize?.(),
    maximize: () => getRawApi()?.maximize?.(),
    close: () => getRawApi()?.close?.(),
    onRestore: (cb) => getRawApi()?.onRestore?.(cb) ?? (() => {}),
    resize: (w, h) => getRawApi()?.resize?.(w, h),
    hide: () => getRawApi()?.hide?.(),
    show: (inactive) => getRawApi()?.show?.(inactive),
    showInactive: () => getRawApi()?.showInactive?.(),
    setContentProtection: (enable) => getRawApi()?.setContentProtection?.(enable) ?? Promise.resolve(false),
    isContentProtected: () => getRawApi()?.isContentProtected?.() ?? Promise.resolve(false),
    setFocusable: (focusable) => getRawApi()?.setFocusable?.(focusable) ?? Promise.resolve(false),
    setIgnoreMouseEvents: (ignore, forward) =>
      getRawApi()?.setIgnoreMouseEvents?.(ignore, forward) ?? Promise.resolve(false),
    setStealthMode: (enabled) => getRawApi()?.setStealthMode?.(enabled) ?? Promise.resolve(false),
    toggleMode: (mode) => getRawApi()?.toggleMode?.(mode),
    toggleAlwaysOnTop: () => getRawApi()?.toggleAlwaysOnTop?.() ?? Promise.resolve(false),
    getVersion: () => getRawApi()?.getVersion?.() ?? Promise.resolve('0.0.0'),
  }

  public readonly capture: ICapturePort = {
    get isAvailable() {
      return Boolean(getRawApi()?.captureScreen)
    },
    getDesktopSources: (types) => getRawApi()?.getDesktopSources?.(types) ?? Promise.resolve([]),
    captureScreen: (options) =>
      getRawApi()?.captureScreen?.(options) ?? Promise.resolve({ success: false, error: 'Electron API unavailable' }),
  }

  public readonly whisper: IWhisperPort = {
    get isAvailable() {
      return Boolean(getRawApi()?.nativeWhisper)
    },
    getStatus: () =>
      getRawApi()?.nativeWhisper?.getStatus?.() ??
      Promise.resolve({
        isReady: false,
        binaryFound: false,
        binaryPath: null,
        availableModels: [],
        activeModel: null,
        modelsDir: '',
        binDir: '',
        deviceInfo: '',
      }),
    getProcessState: () =>
      getRawApi()?.nativeWhisper?.getProcessState?.() ??
      Promise.resolve({
        state: 'STOPPED' as const,
        telemetry: {
          restartCount: 0,
          timeoutCount: 0,
          crashCount: 0,
          processLatency: 0,
          lastLatencyMs: 0,
          totalJobsExecuted: 0,
          state: 'STOPPED' as const,
        },
        logs: [],
      }),
    healthCheck: (modelId) =>
      getRawApi()?.nativeWhisper?.healthCheck?.(modelId) ??
      Promise.resolve({
        healthy: false,
        binaryFound: false,
        modelFound: false,
        binaryPath: null,
        modelPath: null,
        error: 'Native Whisper unavailable',
      }),
    restartProcess: () => getRawApi()?.nativeWhisper?.restartProcess?.() ?? Promise.resolve(false),
    prewarm: () => getRawApi()?.nativeWhisper?.prewarm?.() ?? Promise.resolve(false),
    downloadModel: (modelId) =>
      getRawApi()?.nativeWhisper?.downloadModel?.(modelId) ??
      Promise.resolve({ success: false, filePath: '', error: 'Unavailable' }),
    transcribe: (audioData, options) =>
      getRawApi()?.nativeWhisper?.transcribe?.(audioData, options) ??
      Promise.resolve({
        success: false,
        text: '',
        latencyMs: 0,
        modelName: '',
        isNative: false,
        error: 'Native Whisper unavailable',
      }),
    onDownloadProgress: (cb) => getRawApi()?.nativeWhisper?.onDownloadProgress?.(cb) ?? (() => {}),
    onStateChange: (cb) => getRawApi()?.nativeWhisper?.onStateChange?.(cb) ?? (() => {}),
  }

  public readonly sessions: ISessionsPort = {
    get isAvailable() {
      return Boolean(getRawApi()?.sessions)
    },
    isFirstRun: () => getRawApi()?.sessions?.isFirstRun?.() ?? Promise.resolve(false),
    setFirstRunCompleted: (completed) =>
      getRawApi()?.sessions?.setFirstRunCompleted?.(completed) ?? Promise.resolve(true),
    getAll: () => getRawApi()?.sessions?.getAll?.() ?? Promise.resolve([]),
    getById: (id) => getRawApi()?.sessions?.getById?.(id) ?? Promise.resolve(null),
    save: (session) => getRawApi()?.sessions?.save?.(session) ?? Promise.resolve({ success: false, id: session?.id }),
    delete: (id) => getRawApi()?.sessions?.delete?.(id) ?? Promise.resolve(false),
    deleteMany: (ids) => getRawApi()?.sessions?.deleteMany?.(ids) ?? Promise.resolve(false),
    deleteAll: () => getRawApi()?.sessions?.deleteAll?.() ?? Promise.resolve(false),
    rename: (id, newTitle) => getRawApi()?.sessions?.rename?.(id, newTitle) ?? Promise.resolve(false),
    rebuildIndex: () => getRawApi()?.sessions?.rebuildIndex?.() ?? Promise.resolve([]),
    getMigrationStatus: () =>
      getRawApi()?.sessions?.getMigrationStatus?.() ??
      Promise.resolve({
        isRunning: false,
        total: 0,
        processed: 0,
        migrated: 0,
        errors: 0,
        completed: true,
      }),
    startMigration: () => getRawApi()?.sessions?.startMigration?.() ?? Promise.resolve(null),
    recovery: {
      list: (opts) => getRawApi()?.sessions?.recovery?.list?.(opts) ?? Promise.resolve([]),
      append: (event) => getRawApi()?.sessions?.recovery?.append?.(event) ?? Promise.resolve(false),
      checkpoint: (sessionId, snapshot) =>
        getRawApi()?.sessions?.recovery?.checkpoint?.(sessionId, snapshot) ?? Promise.resolve(false),
      recover: (sessionId) => getRawApi()?.sessions?.recovery?.recover?.(sessionId) ?? Promise.resolve(null),
      complete: (sessionId, lifecycle) =>
        getRawApi()?.sessions?.recovery?.complete?.(sessionId, lifecycle) ?? Promise.resolve(false),
      flush: (sessionId) => getRawApi()?.sessions?.recovery?.flush?.(sessionId) ?? Promise.resolve(false),
    },
  }

  public readonly usage: IUsagePort = {
    get isAvailable() {
      return Boolean(getRawApi()?.usage)
    },
    append: (batch) => getRawApi()?.usage?.append?.(batch) ?? Promise.resolve(0),
    query: (params) =>
      getRawApi()?.usage?.query?.(params) ?? Promise.resolve({ records: [], total: 0, hasMore: false }),
    migrate: (records) =>
      getRawApi()?.usage?.migrate?.(records) ?? Promise.resolve({ migratedCount: 0, success: false }),
    getRecent: (limit) => getRawApi()?.usage?.getRecent?.(limit) ?? Promise.resolve([]),
    loadCurrentMonth: () => getRawApi()?.usage?.loadCurrentMonth?.() ?? Promise.resolve([]),
    reset: () => getRawApi()?.usage?.reset?.() ?? Promise.resolve(false),
  }

  public readonly credentials: ICredentialsPort = {
    get isSupported() {
      return Boolean(getRawApi()?.credentials)
    },
    isAvailable: () => getRawApi()?.credentials?.isAvailable?.() ?? Promise.resolve(false),
    saveApiKey: (provider, key) =>
      getRawApi()?.credentials?.saveApiKey?.(provider, key) ??
      Promise.resolve({ success: false, provider, error: 'API unavailable' }),
    deleteApiKey: (provider) =>
      getRawApi()?.credentials?.deleteApiKey?.(provider) ??
      Promise.resolve({ success: false, error: 'API unavailable' }),
    hasApiKey: (provider) => getRawApi()?.credentials?.hasApiKey?.(provider) ?? Promise.resolve(false),
    getStatus: (provider) =>
      getRawApi()?.credentials?.getStatus?.(provider) ??
      Promise.resolve({ provider, configured: false }),
    getAllStatuses: () => getRawApi()?.credentials?.getAllStatuses?.() ?? Promise.resolve({}),
    verifyApiKey: (provider, rawKey) =>
      getRawApi()?.credentials?.verifyApiKey?.(provider, rawKey) ??
      Promise.resolve({ valid: false, provider, message: 'API unavailable' }),
    testModelAvailability: (provider, rawKey, modelId) =>
      getRawApi()?.credentials?.testModelAvailability?.(provider, rawKey, modelId) ??
      Promise.resolve({ available: false, message: 'API unavailable' }),
    callLLM: (params) => getRawApi()?.credentials?.callLLM?.(params) ?? Promise.resolve(null),
    streamLLM: (params, callbacks) =>
      getRawApi()?.credentials?.streamLLM?.(params, callbacks) ?? (() => {}),
    cancelStreamLLM: (requestId) => getRawApi()?.credentials?.cancelStreamLLM?.(requestId),
    callMultimodalLLM: (params) =>
      getRawApi()?.credentials?.callMultimodalLLM?.(params) ?? Promise.resolve(null),
    transcribeGroq: (audioBase64, modelId, language, prompt) =>
      getRawApi()?.credentials?.transcribeGroq?.(audioBase64, modelId, language, prompt) ??
      Promise.resolve(null),
    syncModels: () =>
      getRawApi()?.credentials?.syncModels?.() ??
      Promise.resolve({ totalLoaded: 0, providerBreakdown: '', models: [], configuredProviders: [] }),
    translateText: (params) =>
      getRawApi()?.credentials?.translateText?.(params) ??
      Promise.resolve({ success: false, translations: [], error: 'API unavailable' }),
  }
}
