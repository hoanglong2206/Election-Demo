/**
 * Common IPC Channels Contract
 * Shared between Main Process and Renderer Process
 * Strictly NO imports of React or Electron
 */

export const IPC_CHANNELS = {
  // ── Window Controls ──────────────────────────────────────────────────────────
  WINDOW: {
    MINIMIZE: 'window:minimize',
    RESTORED: 'window:restored',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    RESIZE: 'window:resize',
    HIDE: 'window:hide',
    SHOW: 'window:show',
    SHOW_INACTIVE: 'window:showInactive',
    SET_CONTENT_PROTECTION: 'window:setContentProtection',
    IS_CONTENT_PROTECTED: 'window:isContentProtected',
    SET_FOCUSABLE: 'window:setFocusable',
    SET_IGNORE_MOUSE_EVENTS: 'window:setIgnoreMouseEvents',
    SET_STEALTH_MODE: 'window:setStealthMode',
    TOGGLE_ALWAYS_ON_TOP: 'window:toggleAlwaysOnTop',
    MODE_TOGGLE: 'mode:toggle',
  },

  // ── Desktop Screen Capture ─────────────────────────────────────────────────
  CAPTURE: {
    GET_SOURCES: 'desktop:getSources',
    CAPTURE_SCREEN: 'desktop:captureScreen',
  },

  // ── Native Whisper Engine ──────────────────────────────────────────────────
  WHISPER: {
    STATE_CHANGE: 'nativeWhisper:stateChange',
    GET_STATUS: 'nativeWhisper:getStatus',
    GET_PROCESS_STATE: 'nativeWhisper:getProcessState',
    HEALTH_CHECK: 'nativeWhisper:healthCheck',
    RESTART_PROCESS: 'nativeWhisper:restartProcess',
    DOWNLOAD_MODEL: 'nativeWhisper:downloadModel',
    DOWNLOAD_PROGRESS: 'nativeWhisper:downloadProgress',
    TRANSCRIBE: 'nativeWhisper:transcribe',
    PREWARM: 'nativeWhisper:prewarm',
  },

  // ── Session Storage & Migration ────────────────────────────────────────────
  SESSIONS: {
    GET_ALL: 'sessions:getAll',
    GET_BY_ID: 'sessions:getById',
    SAVE: 'sessions:save',
    DELETE: 'sessions:delete',
    DELETE_MANY: 'sessions:deleteMany',
    DELETE_ALL: 'sessions:deleteAll',
    RENAME: 'sessions:rename',
    REBUILD_INDEX: 'sessions:rebuildIndex',
    GET_MIGRATION_STATUS: 'sessions:getMigrationStatus',
    START_MIGRATION: 'sessions:startMigration',
    IS_FIRST_RUN: 'sessions:isFirstRun',
    SET_FIRST_RUN_COMPLETED: 'sessions:setFirstRunCompleted',
  },

  // ── Crash Recovery Journal ─────────────────────────────────────────────────
  RECOVERY: {
    LIST: 'sessions:recovery:list',
    APPEND: 'sessions:recovery:append',
    CHECKPOINT: 'sessions:recovery:checkpoint',
    RECOVER: 'sessions:recovery:recover',
    COMPLETE: 'sessions:recovery:complete',
    FLUSH: 'sessions:recovery:flush',
  },

  // ── Usage Tracking & NDJSON Storage ────────────────────────────────────────
  USAGE: {
    APPEND: 'usage:append',
    QUERY: 'usage:query',
    MIGRATE: 'usage:migrate',
    GET_RECENT: 'usage:getRecent',
    LOAD_CURRENT_MONTH: 'usage:loadCurrentMonth',
    RESET: 'usage:reset',
  },

  // ── Secure OS Credentials ──────────────────────────────────────────────────
  CREDENTIALS: {
    IS_AVAILABLE: 'credentials:isAvailable',
    SAVE_API_KEY: 'credentials:saveApiKey',
    DELETE_API_KEY: 'credentials:deleteApiKey',
    HAS_API_KEY: 'credentials:hasApiKey',
    GET_STATUS: 'credentials:getStatus',
    GET_ALL_STATUSES: 'credentials:getAllStatuses',
    VERIFY_API_KEY: 'credentials:verifyApiKey',
    TEST_MODEL_AVAILABILITY: 'credentials:testModelAvailability',
    SYNC_MODELS: 'credentials:syncModels',
    TRANSCRIBE_GROQ: 'credentials:transcribeGroq',
    TRANSLATE_TEXT: 'credentials:translateText',
  },

  // ── Main Process LLM Egress & Streaming ────────────────────────────────────
  LLM: {
    CALL: 'credentials:callLLM',
    STREAM_START: 'credentials:streamLLM:start',
    STREAM_CANCEL: 'credentials:streamLLM:cancel',
    STREAM_FIRST_TOKEN: 'credentials:streamLLM:first-token',
    STREAM_DELTA: 'credentials:streamLLM:delta',
    STREAM_DONE: 'credentials:streamLLM:done',
    STREAM_ERROR: 'credentials:streamLLM:error',
    CALL_MULTIMODAL: 'credentials:callMultimodalLLM',
  },
} as const

export type IpcChannelCategory = keyof typeof IPC_CHANNELS
