import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../common/ipc/channels.js'
import { getWhisperProcessManager } from '../../services/whisperProcessManager.js'

export function registerWhisperHandlers(win: BrowserWindow): void {
  const whisperManager = getWhisperProcessManager()

  // Forward process state and telemetry updates to Renderer window
  whisperManager.onStateChange((state, telemetry) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.WHISPER.STATE_CHANGE, { state, telemetry })
    }
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.GET_STATUS, () => {
    return whisperManager.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.GET_PROCESS_STATE, () => {
    return {
      state: whisperManager.getState(),
      telemetry: whisperManager.getTelemetry(),
      logs: whisperManager.getLogs(),
    }
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.HEALTH_CHECK, async (_event, modelId?: string) => {
    return whisperManager.healthCheck(modelId)
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.RESTART_PROCESS, () => {
    whisperManager.restart()
    return true
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.DOWNLOAD_MODEL, async (_event, modelId: string) => {
    return whisperManager.downloadModel(modelId, (percent, loadedMb, totalMb) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.WHISPER.DOWNLOAD_PROGRESS, {
          modelId,
          percent,
          loadedMb,
          totalMb,
        })
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.TRANSCRIBE, async (_event, audioData: any, options?: any) => {
    return whisperManager.transcribe(audioData, options)
  })

  ipcMain.handle(IPC_CHANNELS.WHISPER.PREWARM, async () => {
    return whisperManager.prewarm()
  })
}
