import { contextBridge, ipcRenderer } from 'electron'

// ── Type definitions (mirrored in src/app/types/electron.d.ts) ────────────────
type Mode = 'discussion' | 'interview'

// ── Secure API surface exposed to the renderer ────────────────────────────────
const api = {
  /** Minimize the overlay window. */
  minimize: () => ipcRenderer.send('window:minimize'),

  /** Maximize/Restore the overlay window. */
  maximize: () => ipcRenderer.send('window:maximize'),

  /** Close the overlay window. */
  close: () => ipcRenderer.send('window:close'),

  /** Listen for window restore event to reverse CSS animations */
  onRestore: (callback: () => void) => {
    ipcRenderer.on('window:restored', callback)
    return () => ipcRenderer.removeListener('window:restored', callback)
  },

  /** Resize the overlay window. */
  resize: (width: number, height: number) => ipcRenderer.send('window:resize', width, height),

  /** Hide the overlay window (keeps it in memory). */
  hide: () => ipcRenderer.send('window:hide'),

  /** Show the overlay window. If inactive=true, does not steal focus. */
  show: (inactive?: boolean) => ipcRenderer.send('window:show', inactive),

  /** Show the overlay window without stealing focus. */
  showInactive: () => ipcRenderer.send('window:showInactive'),

  /** Enable/disable screen capture protection (WDA_EXCLUDEFROMCAPTURE / NSWindowSharingNone) */
  setContentProtection: (enable: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:setContentProtection', enable),

  /** Check if content protection is active */
  isContentProtected: (): Promise<boolean> =>
    ipcRenderer.invoke('window:isContentProtected'),

  /** Set whether the window can receive focus */
  setFocusable: (focusable: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:setFocusable', focusable),

  /** Enable/disable mouse pass-through (click-through) */
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:setIgnoreMouseEvents', ignore, forward),

  /** Set stealth mode (content protection on, focusable off) */
  setStealthMode: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:setStealthMode', enabled),

  /**
   * Notify the main process of a mode change.
   * @param mode 'discussion' | 'interview'
   */
  toggleMode: (mode: Mode) => ipcRenderer.send('mode:toggle', mode),

  /**
   * Toggle the always-on-top setting and return the new state.
   */
  toggleAlwaysOnTop: (): Promise<boolean> =>
    ipcRenderer.invoke('window:toggleAlwaysOnTop'),

  /**
   * Get the application version string.
   */
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  /**
   * Get desktop sources for screen and audio capturing.
   */
  getDesktopSources: (types?: ('screen' | 'window')[]): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke('desktop:getSources', types),

  /**
   * Native high-resolution screen capture for visual technical question analysis.
   */
  captureScreen: (options?: { sourceType?: 'screen' | 'window'; sourceId?: string }): Promise<{
    success: boolean
    dataUrl?: string
    width?: number
    height?: number
    sourceName?: string
    error?: string
  }> => ipcRenderer.invoke('desktop:captureScreen', options),

  /**
   * Native Whisper C++ Engine API
   */
  nativeWhisper: {
    getStatus: (): Promise<any> => ipcRenderer.invoke('nativeWhisper:getStatus'),
    getProcessState: (): Promise<any> => ipcRenderer.invoke('nativeWhisper:getProcessState'),
    healthCheck: (modelId?: string): Promise<any> =>
      ipcRenderer.invoke('nativeWhisper:healthCheck', modelId),
    restartProcess: (): Promise<boolean> => ipcRenderer.invoke('nativeWhisper:restartProcess'),
    downloadModel: (modelId: string): Promise<any> =>
      ipcRenderer.invoke('nativeWhisper:downloadModel', modelId),
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
    ): Promise<any> => ipcRenderer.invoke('nativeWhisper:transcribe', audioData, options),
    prewarm: (): Promise<boolean> => ipcRenderer.invoke('nativeWhisper:prewarm'),
    onDownloadProgress: (
      callback: (data: { modelId: string; percent: number; loadedMb: number; totalMb: number }) => void
    ) => {
      const listener = (
        _event: any,
        data: { modelId: string; percent: number; loadedMb: number; totalMb: number }
      ) => callback(data)
      ipcRenderer.on('nativeWhisper:downloadProgress', listener)
      return () => ipcRenderer.removeListener('nativeWhisper:downloadProgress', listener)
    },
    onStateChange: (
      callback: (data: { state: string; telemetry: any }) => void
    ) => {
      const listener = (_event: any, data: { state: string; telemetry: any }) => callback(data)
      ipcRenderer.on('nativeWhisper:stateChange', listener)
      return () => ipcRenderer.removeListener('nativeWhisper:stateChange', listener)
    },
  },

  /**
   * File-based Session Storage API (stored in userData/sessions/*.json)
   */
  sessions: {
    getAll: (): Promise<any[]> => ipcRenderer.invoke('sessions:getAll'),
    getById: (sessionId: string): Promise<any | null> => ipcRenderer.invoke('sessions:getById', sessionId),
    save: (session: any): Promise<boolean> => ipcRenderer.invoke('sessions:save', session),
    delete: (sessionId: string): Promise<boolean> => ipcRenderer.invoke('sessions:delete', sessionId),
    deleteMany: (sessionIds: string[]): Promise<boolean> =>
      ipcRenderer.invoke('sessions:deleteMany', sessionIds),
    deleteAll: (): Promise<boolean> => ipcRenderer.invoke('sessions:deleteAll'),
    rename: (sessionId: string, newTitle: string): Promise<boolean> =>
      ipcRenderer.invoke('sessions:rename', sessionId, newTitle),
    rebuildIndex: (): Promise<any[]> => ipcRenderer.invoke('sessions:rebuildIndex'),
    getMigrationStatus: (): Promise<any> => ipcRenderer.invoke('sessions:getMigrationStatus'),
    startMigration: (): Promise<any> => ipcRenderer.invoke('sessions:startMigration'),
    recovery: {
      list: (): Promise<any[]> => ipcRenderer.invoke('sessions:recovery:list'),
      append: (event: any): Promise<boolean> => ipcRenderer.invoke('sessions:recovery:append', event),
      checkpoint: (sessionId: string, snapshot: Record<string, unknown>): Promise<boolean> =>
        ipcRenderer.invoke('sessions:recovery:checkpoint', sessionId, snapshot),
      recover: (sessionId: string): Promise<any | null> =>
        ipcRenderer.invoke('sessions:recovery:recover', sessionId),
      complete: (sessionId: string, lifecycle: 'completed' | 'discarded'): Promise<boolean> =>
        ipcRenderer.invoke('sessions:recovery:complete', sessionId, lifecycle),
    },
  },

  /**
   * Secure OS Credential Store API (DPAPI / Keychain / Secret Service via safeStorage)
   * The Renderer process NEVER receives raw API keys back after saving.
   */
  credentials: {
    isAvailable: (): Promise<boolean> => ipcRenderer.invoke('credentials:isAvailable'),
    saveApiKey: (
      provider: string,
      key: string
    ): Promise<{ success: boolean; provider: string; maskedKey?: string; error?: string }> =>
      ipcRenderer.invoke('credentials:saveApiKey', { provider, key }),
    deleteApiKey: (provider: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('credentials:deleteApiKey', { provider }),
    hasApiKey: (provider: string): Promise<boolean> =>
      ipcRenderer.invoke('credentials:hasApiKey', { provider }),
    getStatus: (
      provider: string
    ): Promise<{ provider: string; configured: boolean; maskedKey?: string; updatedAt?: number }> =>
      ipcRenderer.invoke('credentials:getStatus', { provider }),
    getAllStatuses: (): Promise<
      Record<string, { configured: boolean; maskedKey?: string; updatedAt?: number }>
    > => ipcRenderer.invoke('credentials:getAllStatuses'),
    verifyApiKey: (
      provider: string,
      rawKey?: string
    ): Promise<{
      valid: boolean
      provider: string
      message: string
      modelCount?: number
      models?: any[]
      sttModels?: any[]
    }> => ipcRenderer.invoke('credentials:verifyApiKey', { provider, rawKey }),
    testModelAvailability: (
      provider: string,
      rawKey: string,
      modelId: string
    ): Promise<{ available: boolean; status?: number; code?: string; message: string }> =>
      ipcRenderer.invoke('credentials:testModelAvailability', { provider, rawKey, modelId }),
    callLLM: (
      params: any
    ): Promise<{
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
    } | null> =>
      ipcRenderer.invoke('credentials:callLLM', params),
    streamLLM: (
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
    ): (() => void) => {
      const handleFirstToken = (_e: any, d: any) => {
        if (d?.requestId === params.requestId) callbacks.onFirstToken?.(d)
      }
      const handleDelta = (_e: any, d: any) => {
        if (d?.requestId === params.requestId) callbacks.onDelta(d)
      }
      const handleDone = (_e: any, d: any) => {
        if (d?.requestId === params.requestId) {
          cleanup()
          callbacks.onDone(d)
        }
      }
      const handleError = (_e: any, d: any) => {
        if (d?.requestId === params.requestId) {
          cleanup()
          callbacks.onError(d)
        }
      }
      const cleanup = () => {
        ipcRenderer.removeListener('credentials:streamLLM:first-token', handleFirstToken)
        ipcRenderer.removeListener('credentials:streamLLM:delta', handleDelta)
        ipcRenderer.removeListener('credentials:streamLLM:done', handleDone)
        ipcRenderer.removeListener('credentials:streamLLM:error', handleError)
      }

      ipcRenderer.on('credentials:streamLLM:first-token', handleFirstToken)
      ipcRenderer.on('credentials:streamLLM:delta', handleDelta)
      ipcRenderer.on('credentials:streamLLM:done', handleDone)
      ipcRenderer.on('credentials:streamLLM:error', handleError)

      ipcRenderer.send('credentials:streamLLM:start', params)

      return () => {
        cleanup()
        ipcRenderer.send('credentials:streamLLM:cancel', { requestId: params.requestId })
      }
    },
    cancelStreamLLM: (requestId: string): void => {
      ipcRenderer.send('credentials:streamLLM:cancel', { requestId })
    },
    callMultimodalLLM: (
      params: any
    ): Promise<{
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
    } | null> =>
      ipcRenderer.invoke('credentials:callMultimodalLLM', params),
    transcribeGroq: (
      audioBase64: string,
      modelId?: string,
      language?: string,
      prompt?: string
    ): Promise<{ text: string; latencyMs: number } | null> =>
      ipcRenderer.invoke('credentials:transcribeGroq', { audioBase64, modelId, language, prompt }),
    syncModels: (): Promise<{
      totalLoaded: number
      providerBreakdown: string
      models: any[]
      sttModels?: any[]
      configuredProviders?: string[]
    }> => ipcRenderer.invoke('credentials:syncModels'),
  },
}

// Expose the api object on `window.api` in the renderer.
contextBridge.exposeInMainWorld('api', api)
