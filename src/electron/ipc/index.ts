import type { BrowserWindow } from 'electron'
import { registerWindowHandlers } from './handlers/window.js'
import { registerCaptureHandlers } from './handlers/capture.js'
import { registerWhisperHandlers } from './handlers/whisper.js'
import { registerSessionHandlers, getActiveSessionRecoveryService } from './handlers/sessions.js'
import { registerAppStateHandlers } from './handlers/appState.js'
import { registerUsageHandlers, getActiveUsageStorageService } from './handlers/usage.js'
import { registerCredentialHandlers } from './handlers/credentials.js'
import { registerLlmHandlers } from './handlers/llm.js'

export { getActiveSessionRecoveryService, getActiveUsageStorageService }

/**
 * Registers all domain IPC handlers on application startup.
 */
export function registerAllHandlers(win: BrowserWindow): void {
  registerWindowHandlers(win)
  registerCaptureHandlers()
  registerWhisperHandlers(win)
  registerSessionHandlers()
  registerAppStateHandlers()
  registerUsageHandlers()
  registerCredentialHandlers()
  registerLlmHandlers()
}

/**
 * Backward compatibility alias for registerAllHandlers
 */
export const registerIpcHandlers = registerAllHandlers
