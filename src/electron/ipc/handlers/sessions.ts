import { app, ipcMain } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '../../../common/index.js'
import { ElectronSessionStorage, SessionRecoveryService } from '../../services/sessions/index.js'
import { getAppStateManager } from '../../services/appState.js'

let activeSessionRecoveryService: SessionRecoveryService | null = null

export function getActiveSessionRecoveryService(): SessionRecoveryService | null {
  return activeSessionRecoveryService
}

export function registerSessionHandlers(): void {
  const sessionStorage = new ElectronSessionStorage()
  const sessionRecoveryService = new SessionRecoveryService(
    path.join(app.getPath('userData'), 'sessions', 'recovery')
  )
  activeSessionRecoveryService = sessionRecoveryService

  ipcMain.handle(IPC_CHANNELS.SESSIONS.GET_ALL, () => {
    return sessionStorage.getAll()
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.GET_BY_ID, (_event, sessionId: string) => {
    return sessionStorage.getById(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.SAVE, async (_event, session: any) => {
    try {
      const success = await sessionStorage.save(session)
      return { success: Boolean(success), id: String(session?.id || '') }
    } catch (err: any) {
      return { success: false, id: String(session?.id || ''), error: String(err?.message || err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.DELETE, (_event, sessionId: string) => {
    getAppStateManager().setFirstRunCompleted(true)
    sessionRecoveryService.complete(sessionId, 'discarded')
    return sessionStorage.delete(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.DELETE_MANY, (_event, sessionIds: string[]) => {
    getAppStateManager().setFirstRunCompleted(true)
    for (const sid of sessionIds) {
      sessionRecoveryService.complete(sid, 'discarded')
    }
    return sessionStorage.deleteMany(sessionIds)
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.DELETE_ALL, async () => {
    getAppStateManager().setFirstRunCompleted(true)
    return sessionStorage.deleteAll()
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.RENAME, (_event, sessionId: string, newTitle: string) => {
    return sessionStorage.rename(sessionId, newTitle)
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.REBUILD_INDEX, () => {
    return sessionStorage.rebuildIndex()
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.GET_MIGRATION_STATUS, () => {
    return sessionStorage.getMigrationStatus()
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.START_MIGRATION, () => {
    return sessionStorage.migrateLegacySessions()
  })

  // Run background migration and orphan image cleanup safely after idle delay
  setTimeout(() => {
    sessionStorage.migrateLegacySessions().catch((err: unknown) => {
      console.warn('[SessionStorage] Background migration warning:', err)
    })
    sessionStorage.cleanOrphanImages().catch((err: unknown) => {
      console.warn('[SessionStorage] Orphan image cleaner warning:', err)
    })
  }, 2500)

  // ── Crash Recovery Handlers ───────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.RECOVERY.LIST, (_event, options?: any) =>
    sessionRecoveryService.listUnfinished(options)
  )

  ipcMain.handle(IPC_CHANNELS.RECOVERY.APPEND, (_event, event) =>
    sessionRecoveryService.append(event)
  )

  ipcMain.handle(IPC_CHANNELS.RECOVERY.CHECKPOINT, (_event, sessionId: string, snapshot?: Record<string, unknown>) =>
    sessionRecoveryService.checkpoint(sessionId, snapshot)
  )

  ipcMain.handle(IPC_CHANNELS.RECOVERY.RECOVER, (_event, sessionId: string) =>
    sessionRecoveryService.recover(sessionId)
  )

  ipcMain.handle(IPC_CHANNELS.RECOVERY.COMPLETE, (_event, sessionId: string, lifecycle: 'completed' | 'discarded') =>
    sessionRecoveryService.complete(sessionId, lifecycle)
  )

  ipcMain.handle(IPC_CHANNELS.RECOVERY.FLUSH, (_event, sessionId?: string) => {
    sessionRecoveryService.flushSync(sessionId)
    return true
  })
}
