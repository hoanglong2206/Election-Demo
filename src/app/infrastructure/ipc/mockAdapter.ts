import type {
  IIpcClient,
  IWindowPort,
  ICapturePort,
  IWhisperPort,
  ISessionsPort,
  IUsagePort,
  ICredentialsPort,
} from './ports'
import type { AppMode, WhisperProcessState } from '@/types/electron.d'

export class MockIpcAdapter implements IIpcClient {
  public sessionsStore = new Map<string, any>()
  public usageRecords: any[] = []
  public credentialsStore = new Map<string, string>()
  public currentMode: AppMode = 'interview'
  public windowVisible = true
  public contentProtected = false
  public firstRun = true

  public readonly window: IWindowPort = {
    isAvailable: true,
    minimize: () => {},
    maximize: () => {},
    close: () => {},
    onRestore: () => () => {},
    resize: () => {},
    hide: () => {
      this.windowVisible = false
    },
    show: () => {
      this.windowVisible = true
    },
    showInactive: () => {
      this.windowVisible = true
    },
    setContentProtection: async (enable) => {
      this.contentProtected = enable
      return enable
    },
    isContentProtected: async () => this.contentProtected,
    setFocusable: async () => true,
    setIgnoreMouseEvents: async () => true,
    setStealthMode: async () => true,
    toggleMode: (mode) => {
      this.currentMode = mode
    },
    toggleAlwaysOnTop: async () => true,
    getVersion: async () => '1.0.0-mock',
  }

  public readonly capture: ICapturePort = {
    isAvailable: true,
    getDesktopSources: async () => [
      { id: 'screen:0', name: 'Entire Screen' },
      { id: 'window:1', name: 'Mock Window' },
    ],
    captureScreen: async () => ({
      success: true,
      dataUrl: 'data:image/jpeg;base64,mock',
      width: 1920,
      height: 1080,
      sourceName: 'Mock Window',
    }),
  }

  public readonly whisper: IWhisperPort = {
    isAvailable: true,
    getStatus: async () => ({
      isReady: true,
      binaryFound: true,
      binaryPath: '/mock/bin/whisper',
      availableModels: [{ id: 'ggml-base', name: 'Base', sizeMb: 140, downloaded: true }],
      activeModel: 'ggml-base',
      modelsDir: '/mock/models',
      binDir: '/mock/bin',
      deviceInfo: 'Mock CPU',
    }),
    getProcessState: async () => ({
      state: 'READY' as WhisperProcessState,
      telemetry: {
        restartCount: 0,
        timeoutCount: 0,
        crashCount: 0,
        processLatency: 10,
        lastLatencyMs: 15,
        totalJobsExecuted: 5,
        state: 'READY' as WhisperProcessState,
      },
      logs: ['Mock whisper process ready'],
    }),
    healthCheck: async () => ({
      healthy: true,
      binaryFound: true,
      modelFound: true,
      binaryPath: '/mock/bin/whisper',
      modelPath: '/mock/models/ggml-base.bin',
    }),
    restartProcess: async () => true,
    prewarm: async () => true,
    downloadModel: async (modelId) => ({ success: true, filePath: `/mock/models/${modelId}.bin` }),
    transcribe: async () => ({
      success: true,
      text: 'Mock transcription result',
      latencyMs: 120,
      modelName: 'ggml-base',
      isNative: true,
    }),
    onDownloadProgress: () => () => {},
    onStateChange: () => () => {},
  }

  public readonly sessions: ISessionsPort = {
    isAvailable: true,
    isFirstRun: async () => this.firstRun,
    setFirstRunCompleted: async (completed = true) => {
      this.firstRun = !completed
      return true
    },
    getAll: async () => Array.from(this.sessionsStore.values()),
    getById: async (id) => this.sessionsStore.get(id) ?? null,
    save: async (session) => {
      this.sessionsStore.set(session.id, session)
      return { success: true, id: session.id }
    },
    delete: async (id) => this.sessionsStore.delete(id),
    deleteMany: async (ids) => {
      for (const id of ids) this.sessionsStore.delete(id)
      return true
    },
    deleteAll: async () => {
      this.sessionsStore.clear()
      return true
    },
    rename: async (id, newTitle) => {
      const s = this.sessionsStore.get(id)
      if (s) {
        s.title = newTitle
        return true
      }
      return false
    },
    rebuildIndex: async () => Array.from(this.sessionsStore.values()),
    getMigrationStatus: async () => ({
      isRunning: false,
      total: this.sessionsStore.size,
      processed: this.sessionsStore.size,
      migrated: 0,
      errors: 0,
      completed: true,
    }),
    startMigration: async () => ({}),
    recovery: {
      list: async () => [],
      append: async () => true,
      checkpoint: async () => true,
      recover: async (id) => this.sessionsStore.get(id) ?? null,
      complete: async () => true,
      flush: async () => true,
    },
  }

  public readonly usage: IUsagePort = {
    isAvailable: true,
    append: async (batch) => {
      this.usageRecords.push(...batch)
      return batch.length
    },
    query: async ({ limit = 50, cursor = 0 }: any) => {
      const offset = typeof cursor === 'number' ? cursor : parseInt(cursor, 10) || 0
      const slice = this.usageRecords.slice(offset, offset + limit)
      return {
        records: slice,
        total: this.usageRecords.length,
        nextCursor: offset + limit < this.usageRecords.length ? String(offset + limit) : undefined,
        hasMore: offset + limit < this.usageRecords.length,
      }
    },
    migrate: async (records) => {
      this.usageRecords.push(...records)
      return { migratedCount: records.length, success: true }
    },
    getRecent: async (limit = 20) => this.usageRecords.slice(-limit),
    loadCurrentMonth: async () => this.usageRecords,
    reset: async () => {
      this.usageRecords = []
      return true
    },
  }

  public readonly credentials: ICredentialsPort = {
    isSupported: true,
    isAvailable: async () => true,
    saveApiKey: async (provider, key) => {
      this.credentialsStore.set(provider, key)
      return { success: true, provider, maskedKey: '****' }
    },
    deleteApiKey: async (provider) => {
      this.credentialsStore.delete(provider)
      return { success: true }
    },
    hasApiKey: async (provider) => this.credentialsStore.has(provider),
    getStatus: async (provider) => ({
      provider,
      configured: this.credentialsStore.has(provider),
      maskedKey: this.credentialsStore.has(provider) ? '****' : undefined,
      updatedAt: Date.now(),
    }),
    getAllStatuses: async () => {
      const res: Record<string, any> = {}
      for (const [k] of this.credentialsStore.entries()) {
        res[k] = { configured: true, maskedKey: '****', updatedAt: Date.now() }
      }
      return res
    },
    verifyApiKey: async (provider) => ({
      valid: this.credentialsStore.has(provider),
      provider,
      message: 'Verified successfully (mock)',
      modelCount: 1,
      models: [{ id: 'mock-model', name: 'Mock Model' }],
      sttModels: provider === 'groq' ? [{ id: 'whisper-large-v3-turbo', name: 'Groq Whisper Large v3 Turbo', provider: 'Groq' }] : [],
    }),
    testModelAvailability: async () => ({ available: true, message: 'Available' }),
    callLLM: async (params) => ({
      text: `Mock LLM response for: ${JSON.stringify(params).slice(0, 50)}`,
      modelName: params?.model || 'mock-model',
      provider: params?.provider || 'MockProvider',
      usage: { inputTokens: 10, outputTokens: 20 },
      benchmark: { ttftMs: 50, generationMs: 150, outputTokens: 20 },
    }),
    streamLLM: (_params, callbacks) => {
      const timer = setTimeout(() => {
        callbacks.onFirstToken?.({ requestId: _params.requestId, ttftMs: 40 })
        callbacks.onDelta({ requestId: _params.requestId, delta: 'Mock stream chunk' })
        callbacks.onDone({
          requestId: _params.requestId,
          text: 'Mock stream chunk',
          modelName: 'mock-model',
          provider: 'MockProvider',
          benchmark: { ttftMs: 40, generationMs: 80, outputTokens: 5 },
        })
      }, 10)
      return () => clearTimeout(timer)
    },
    cancelStreamLLM: () => {},
    callMultimodalLLM: async (params) => ({
      text: 'Mock Multimodal response',
      modelName: params?.model || 'mock-vision',
      provider: params?.provider || 'MockProvider',
    }),
    transcribeGroq: async () => ({ text: 'Mock Groq transcription', latencyMs: 80 }),
    syncModels: async () => ({
      totalLoaded: 2,
      providerBreakdown: 'Mock: 2',
      models: [{ id: 'mock-1', name: 'Mock 1' }],
      configuredProviders: Array.from(this.credentialsStore.keys()),
    }),
    translateText: async (params) => ({
      success: true,
      translations: params.texts.map((t) => `[VI] ${t}`),
    }),
  }
}
