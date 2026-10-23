import { ipcMain, BrowserWindow, desktopCapturer, screen } from 'electron'
import { getWhisperProcessManager } from '../services/whisperProcessManager.js'
import { ElectronSessionStorage } from '../services/sessionStorage.js'
import { getElectronCredentialStore } from '../services/credentialStore.js'

export function registerIpcHandlers(win: BrowserWindow): void {
  // ── Window controls ────────────────────────────────────────────────────────

  ipcMain.on('window:minimize', () => {
    if (!win.isDestroyed()) win.minimize()
  })

  // Notify renderer when window is restored to reverse the minimize animation
  win.on('restore', () => {
    if (!win.isDestroyed()) win.webContents.send('window:restored')
  })

  // Notify renderer when window is maximized/unmaximized to reverse animations
  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send('window:restored')
  })
  
  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send('window:restored')
  })

  ipcMain.on('window:maximize', () => {
    if (!win.isDestroyed()) {
      if (win.isMaximized()) win.restore()
      else win.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    if (!win.isDestroyed()) win.close()
  })

  ipcMain.on('window:resize', (_event, width: number, height: number) => {
    if (!win.isDestroyed() && !win.isMaximized()) {
      const bounds = win.getBounds()
      // Anchor to the right edge: shift X left by the amount the width is expanding
      const newX = bounds.x - (width - bounds.width)
      win.setBounds({ x: newX, y: bounds.y, width, height }, true)
    }
  })

  ipcMain.on('window:hide', () => {
    if (!win.isDestroyed()) win.hide()
  })

  ipcMain.on('window:show', () => {
    if (!win.isDestroyed()) win.show()
  })

  // ── Mode toggle ────────────────────────────────────────────────────────────
  // The renderer sends 'mode:toggle' with the new mode string.
  ipcMain.on('mode:toggle', (_event, mode: string) => {
    // Persist or react to mode change in the main process if needed.
    console.log('[Electron] Mode changed to:', mode)
  })

  // ── Desktop sources for audio capture ─────────────────────────────────────
  ipcMain.handle('desktop:getSources', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      return sources.map((s) => ({ id: s.id, name: s.name }))
    } catch (err) {
      console.error('[Electron] Error getting desktop sources:', err)
      return []
    }
  })

  // ── Native Screen Capture via Electron desktopCapturer (Pure & No External Files) ──
  ipcMain.handle('desktop:captureScreen', async () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scale = primaryDisplay?.scaleFactor || 1
      const bounds = primaryDisplay?.bounds || { width: 1920, height: 1080 }
      const targetWidth = Math.min(Math.round((bounds.width || 1920) * scale), 1920)
      const targetHeight = Math.min(Math.round((bounds.height || 1080) * scale), 1080)

      let selected: Electron.DesktopCapturerSource | null = null

      // Step 1: Capture open application windows (fastest & highly reliable, ~100-150ms, immune to error 170)
      try {
        const windowSources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: targetWidth, height: targetHeight },
          fetchWindowIcons: false,
        })

        // Prioritize active non-Copilot application window (e.g. Chrome, Zoom, IDE, Docs)
        const nonSelfWindow = windowSources.find(
          (s) =>
            !s.thumbnail.isEmpty() &&
            !s.name.toLowerCase().includes('copilot') &&
            !s.name.toLowerCase().includes('electron') &&
            !s.name.toLowerCase().includes('antigravity')
        )

        if (nonSelfWindow) {
          selected = nonSelfWindow
        } else {
          // If all are self-windows, find any non-empty window
          selected = windowSources.find((s) => !s.thumbnail.isEmpty()) || null
        }
      } catch {
        // Fall through to screen capture
      }

      // Step 2: Fall back to entire screen capture if no valid window source found
      if (!selected) {
        try {
          const screenSources = await Promise.race([
            desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: { width: targetWidth, height: targetHeight },
              fetchWindowIcons: false,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Screen capture timeout sau 2000ms')), 2000)
            ),
          ])
          selected = screenSources.find((s) => !s.thumbnail.isEmpty()) || null
        } catch {
          // Fall through
        }
      }

      if (!selected || selected.thumbnail.isEmpty()) {
        throw new Error('Không thể thu thập hình ảnh màn hình từ desktopCapturer.')
      }

      const jpegBuffer = selected.thumbnail.toJPEG(85)
      const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`
      const size = selected.thumbnail.getSize()

      return {
        success: true,
        dataUrl,
        width: size.width || targetWidth,
        height: size.height || targetHeight,
        sourceName: selected.name,
      }
    } catch (err: unknown) {
      console.error('[ScreenCapture:Main] desktop:captureScreen error:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  // ── Always-on-top toggle ───────────────────────────────────────────────────
  ipcMain.handle('window:toggleAlwaysOnTop', () => {
    const current = win.isAlwaysOnTop()
    win.setAlwaysOnTop(!current, 'screen-saver')
    return !current
  })

  // ── Native Whisper Process Manager Handlers ──────────────────────────────
  const whisperManager = getWhisperProcessManager()

  // Forward process state and telemetry updates to Renderer window
  whisperManager.onStateChange((state, telemetry) => {
    if (!win.isDestroyed()) {
      win.webContents.send('nativeWhisper:stateChange', { state, telemetry })
    }
  })

  ipcMain.handle('nativeWhisper:getStatus', () => {
    return whisperManager.getStatus()
  })

  ipcMain.handle('nativeWhisper:getProcessState', () => {
    return {
      state: whisperManager.getState(),
      telemetry: whisperManager.getTelemetry(),
      logs: whisperManager.getLogs(),
    }
  })

  ipcMain.handle('nativeWhisper:healthCheck', async (_event, modelId?: string) => {
    return whisperManager.healthCheck(modelId)
  })

  ipcMain.handle('nativeWhisper:restartProcess', () => {
    whisperManager.restart()
    return true
  })

  ipcMain.handle('nativeWhisper:downloadModel', async (_event, modelId: string) => {
    return whisperManager.downloadModel(modelId, (percent, loadedMb, totalMb) => {
      if (!win.isDestroyed()) {
        win.webContents.send('nativeWhisper:downloadProgress', {
          modelId,
          percent,
          loadedMb,
          totalMb,
        })
      }
    })
  })

  ipcMain.handle(
    'nativeWhisper:transcribe',
    async (_event, audioData: string, options?: any) => {
      return whisperManager.transcribe(audioData, options)
    }
  )

    // ── Session Storage (Local JSON files in userData/sessions/) ─────────────
    const sessionStorage = new ElectronSessionStorage()

    ipcMain.handle('sessions:getAll', () => {
      return sessionStorage.getAll()
    })

    ipcMain.handle('sessions:save', (_event, session: any) => {
      return sessionStorage.save(session)
    })

    ipcMain.handle('sessions:delete', (_event, sessionId: string) => {
      return sessionStorage.delete(sessionId)
    })

    ipcMain.handle('sessions:deleteMany', (_event, sessionIds: string[]) => {
      return sessionStorage.deleteMany(sessionIds)
    })

    ipcMain.handle('sessions:deleteAll', () => {
      return sessionStorage.deleteAll()
    })

    ipcMain.handle('sessions:rename', (_event, sessionId: string, newTitle: string) => {
      return sessionStorage.rename(sessionId, newTitle)
    })

    // ── Secure OS Credential Store Handlers ──────────────────────────────────
    const credentialStore = getElectronCredentialStore()

    ipcMain.handle('credentials:isAvailable', () => {
      return credentialStore.isAvailable()
    })

    ipcMain.handle('credentials:saveApiKey', (_event, payload: { provider: string; key: string }) => {
      return credentialStore.saveApiKey(payload.provider, payload.key)
    })

    ipcMain.handle('credentials:deleteApiKey', (_event, payload: { provider: string }) => {
      return credentialStore.deleteApiKey(payload.provider)
    })

    ipcMain.handle('credentials:hasApiKey', (_event, payload: { provider: string }) => {
      return credentialStore.hasApiKey(payload.provider)
    })

    ipcMain.handle('credentials:getStatus', (_event, payload: { provider: string }) => {
      return credentialStore.getStatus(payload.provider)
    })

    ipcMain.handle('credentials:getAllStatuses', () => {
      return credentialStore.getAllStatuses()
    })

    ipcMain.handle(
      'credentials:verifyApiKey',
      async (_event, payload: { provider: string; rawKey?: string }) => {
        return credentialStore.verifyApiKey(payload.provider, payload.rawKey)
      }
    )

    ipcMain.handle(
      'credentials:testModelAvailability',
      async (_event, payload: { provider: string; rawKey: string; modelId: string }) =>
        credentialStore.testModelAvailability(payload.provider, payload.rawKey, payload.modelId)
    )

    ipcMain.handle('credentials:callLLM', async (_event, payload: any) => {
      return credentialStore.callLLM(payload)
    })

    ipcMain.handle('credentials:callMultimodalLLM', async (_event, payload: any) => {
      return credentialStore.callMultimodalLLM(payload)
    })

    ipcMain.handle(
      'credentials:transcribeGroq',
      async (
        _event,
        payload: { audioBase64: string; modelId?: string; language?: string; prompt?: string }
      ) => {
        return credentialStore.transcribeGroq(
          payload.audioBase64,
          payload.modelId,
          payload.language,
          payload.prompt
        )
      }
    )

    ipcMain.handle('credentials:syncModels', async () => {
      return credentialStore.syncModels()
    })
  }
