import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../common'
import { getAppStateManager } from '../../services/appState.js'

export function registerAppStateHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SESSIONS.IS_FIRST_RUN, () => {
    return !getAppStateManager().isFirstRunCompleted()
  })

  ipcMain.handle(IPC_CHANNELS.SESSIONS.SET_FIRST_RUN_COMPLETED, (_event, completed: boolean = true) => {
    return getAppStateManager().setFirstRunCompleted(completed)
  })
}
