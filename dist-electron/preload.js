import { contextBridge, ipcRenderer } from 'electron';
// ── Secure API surface exposed to the renderer ────────────────────────────────
const api = {
    /** Minimize the overlay window. */
    minimize: () => ipcRenderer.send('window:minimize'),
    /** Maximize/Restore the overlay window. */
    maximize: () => ipcRenderer.send('window:maximize'),
    /** Close the overlay window. */
    close: () => ipcRenderer.send('window:close'),
    /** Listen for window restore event to reverse CSS animations */
    onRestore: (callback) => {
        ipcRenderer.on('window:restored', callback);
        return () => ipcRenderer.removeListener('window:restored', callback);
    },
    /** Resize the overlay window. */
    resize: (width, height) => ipcRenderer.send('window:resize', width, height),
    /** Hide the overlay window (keeps it in memory). */
    hide: () => ipcRenderer.send('window:hide'),
    /** Show the overlay window. */
    show: () => ipcRenderer.send('window:show'),
    /**
     * Notify the main process of a mode change.
     * @param mode 'discussion' | 'interview'
     */
    toggleMode: (mode) => ipcRenderer.send('mode:toggle', mode),
    /**
     * Toggle the always-on-top setting and return the new state.
     */
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    /**
     * Get the application version string.
     */
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    /**
     * Get desktop sources for screen and audio capturing.
     */
    getDesktopSources: () => ipcRenderer.invoke('desktop:getSources'),
    /**
     * Native high-resolution screen capture for visual technical question analysis.
     */
    captureScreen: () => ipcRenderer.invoke('desktop:captureScreen'),
    /**
     * Native Whisper C++ Engine API
     */
    nativeWhisper: {
        getStatus: () => ipcRenderer.invoke('nativeWhisper:getStatus'),
        getProcessState: () => ipcRenderer.invoke('nativeWhisper:getProcessState'),
        healthCheck: (modelId) => ipcRenderer.invoke('nativeWhisper:healthCheck', modelId),
        restartProcess: () => ipcRenderer.invoke('nativeWhisper:restartProcess'),
        downloadModel: (modelId) => ipcRenderer.invoke('nativeWhisper:downloadModel', modelId),
        transcribe: (audioData, options) => ipcRenderer.invoke('nativeWhisper:transcribe', audioData, options),
        onDownloadProgress: (callback) => {
            const listener = (_event, data) => callback(data);
            ipcRenderer.on('nativeWhisper:downloadProgress', listener);
            return () => ipcRenderer.removeListener('nativeWhisper:downloadProgress', listener);
        },
        onStateChange: (callback) => {
            const listener = (_event, data) => callback(data);
            ipcRenderer.on('nativeWhisper:stateChange', listener);
            return () => ipcRenderer.removeListener('nativeWhisper:stateChange', listener);
        },
    },
    /**
     * File-based Session Storage API (stored in userData/sessions/*.json)
     */
    sessions: {
        getAll: () => ipcRenderer.invoke('sessions:getAll'),
        save: (session) => ipcRenderer.invoke('sessions:save', session),
        delete: (sessionId) => ipcRenderer.invoke('sessions:delete', sessionId),
        deleteMany: (sessionIds) => ipcRenderer.invoke('sessions:deleteMany', sessionIds),
        deleteAll: () => ipcRenderer.invoke('sessions:deleteAll'),
        rename: (sessionId, newTitle) => ipcRenderer.invoke('sessions:rename', sessionId, newTitle),
    },
    /**
     * Secure OS Credential Store API (DPAPI / Keychain / Secret Service via safeStorage)
     * The Renderer process NEVER receives raw API keys back after saving.
     */
    credentials: {
        isAvailable: () => ipcRenderer.invoke('credentials:isAvailable'),
        saveApiKey: (provider, key) => ipcRenderer.invoke('credentials:saveApiKey', { provider, key }),
        deleteApiKey: (provider) => ipcRenderer.invoke('credentials:deleteApiKey', { provider }),
        hasApiKey: (provider) => ipcRenderer.invoke('credentials:hasApiKey', { provider }),
        getStatus: (provider) => ipcRenderer.invoke('credentials:getStatus', { provider }),
        getAllStatuses: () => ipcRenderer.invoke('credentials:getAllStatuses'),
        verifyApiKey: (provider, rawKey) => ipcRenderer.invoke('credentials:verifyApiKey', { provider, rawKey }),
        testModelAvailability: (provider, rawKey, modelId) => ipcRenderer.invoke('credentials:testModelAvailability', { provider, rawKey, modelId }),
        callLLM: (params) => ipcRenderer.invoke('credentials:callLLM', params),
        callMultimodalLLM: (params) => ipcRenderer.invoke('credentials:callMultimodalLLM', params),
        transcribeGroq: (audioBase64, modelId, language, prompt) => ipcRenderer.invoke('credentials:transcribeGroq', { audioBase64, modelId, language, prompt }),
        syncModels: () => ipcRenderer.invoke('credentials:syncModels'),
    },
};
// Expose the api object on `window.api` in the renderer.
contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=preload.js.map