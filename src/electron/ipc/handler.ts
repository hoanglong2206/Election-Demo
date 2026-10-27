import { app, ipcMain, BrowserWindow, desktopCapturer, screen } from 'electron'
import path from 'path'
import { getWhisperProcessManager } from '../services/whisperProcessManager.js'
import { ElectronSessionStorage } from '../services/sessionStorage.js'
import { getElectronCredentialStore } from '../services/credentialStore.js'
import { SessionRecoveryService } from '../services/sessionRecovery.js'

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

  ipcMain.on('window:show', (_event, inactive?: boolean) => {
    if (!win.isDestroyed()) {
      if (inactive) win.showInactive()
      else win.show()
    }
  })

  ipcMain.on('window:showInactive', () => {
    if (!win.isDestroyed()) win.showInactive()
  })

  // ── Screen Protection & Stealth Mode Controls ──────────────────────────────
  ipcMain.handle('window:setContentProtection', (_event, enable: boolean) => {
    if (!win.isDestroyed()) {
      win.setContentProtection(enable)
      return win.isContentProtected()
    }
    return false
  })

  ipcMain.handle('window:isContentProtected', () => {
    return !win.isDestroyed() && win.isContentProtected()
  })

  ipcMain.handle('window:setFocusable', (_event, focusable: boolean) => {
    if (!win.isDestroyed()) {
      win.setFocusable(focusable)
      return true
    }
    return false
  })

  ipcMain.handle('window:setIgnoreMouseEvents', (_event, ignore: boolean, forward = true) => {
    if (!win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward })
      return true
    }
    return false
  })

  ipcMain.handle('window:setStealthMode', (_event, enabled: boolean) => {
    if (win.isDestroyed()) return false
    try {
      win.setContentProtection(true)
      win.setFocusable(!enabled)
      win.setSkipTaskbar(true)
      return true
    } catch (err) {
      console.error('[Electron] setStealthMode error:', err)
      return false
    }
  })

  // ── Mode toggle ────────────────────────────────────────────────────────────
  // The renderer sends 'mode:toggle' with the new mode string.
  ipcMain.on('mode:toggle', (_event, mode: string) => {
    // Persist or react to mode change in the main process if needed.
    console.log('[Electron] Mode changed to:', mode)
  })

  // ── Desktop sources for audio capture ─────────────────────────────────────
  ipcMain.handle('desktop:getSources', async (_event, types?: ('screen' | 'window')[]) => {
    try {
      const sources = await desktopCapturer.getSources({ types: types || ['screen', 'window'] })
      return sources.map((s) => ({ id: s.id, name: s.name }))
    } catch (err) {
      console.error('[Electron] Error getting desktop sources:', err)
      return []
    }
  })

  // ── Native Screen Capture via Electron desktopCapturer (Pure & No External Files) ──
  ipcMain.handle(
    'desktop:captureScreen',
    async (_event, options?: { sourceType?: 'screen' | 'window'; sourceId?: string }) => {
      try {
        const primaryDisplay = screen.getPrimaryDisplay()
        const scale = primaryDisplay?.scaleFactor || 1
        const bounds = primaryDisplay?.bounds || { width: 1920, height: 1080 }
        const targetWidth = Math.min(Math.round((bounds.width || 1920) * scale), 1920)
        const targetHeight = Math.min(Math.round((bounds.height || 1080) * scale), 1080)

        let selected: Electron.DesktopCapturerSource | null = null

        const sourceType = options?.sourceType || 'window'

      // Select the requested source when the picker supplied a source id.
        try {
          const sources = await desktopCapturer.getSources({
            types: [sourceType],
            thumbnailSize: { width: targetWidth, height: targetHeight },
            fetchWindowIcons: false,
          })

        if (options?.sourceId) {
          selected = sources.find((s) => s.id === options.sourceId && !s.thumbnail.isEmpty()) || null
        } else if (sourceType === 'screen') {
          selected = sources.find((s) => !s.thumbnail.isEmpty()) || null
        } else {
          selected = sources.find(
            (s) =>
              !s.thumbnail.isEmpty() &&
              !s.name.toLowerCase().includes('copilot') &&
              !s.name.toLowerCase().includes('electron') &&
              !s.name.toLowerCase().includes('antigravity')
          ) || sources.find((s) => !s.thumbnail.isEmpty()) || null
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
    },
  )

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
    async (_event, audioData: any, options?: any) => {
      return whisperManager.transcribe(audioData, options)
    }
  )

  ipcMain.handle('nativeWhisper:prewarm', async () => {
    return whisperManager.prewarm()
  })

    // ── Session Storage (Local JSON files in userData/sessions/) ─────────────
    const sessionStorage = new ElectronSessionStorage()
    const sessionRecoveryService = new SessionRecoveryService(
      path.join(app.getPath('userData'), 'sessions', 'recovery')
    )

    ipcMain.handle('sessions:getAll', () => {
      return sessionStorage.getAll()
    })

    ipcMain.handle('sessions:getById', (_event, sessionId: string) => {
      return sessionStorage.getById(sessionId)
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

    ipcMain.handle('sessions:rebuildIndex', () => {
      return sessionStorage.rebuildIndex()
    })

    ipcMain.handle('sessions:getMigrationStatus', () => {
      return sessionStorage.getMigrationStatus()
    })

    ipcMain.handle('sessions:startMigration', () => {
      return sessionStorage.migrateLegacySessions()
    })

    // Run background migration and orphan image cleanup safely after idle delay
    setTimeout(() => {
      sessionStorage.migrateLegacySessions().catch((err) => {
        console.warn('[SessionStorage] Background migration warning:', err)
      })
      sessionStorage.cleanOrphanImages().catch((err) => {
        console.warn('[SessionStorage] Orphan image cleaner warning:', err)
      })
    }, 2500)

    ipcMain.handle('sessions:recovery:list', () => sessionRecoveryService.listUnfinished())
    ipcMain.handle('sessions:recovery:append', (_event, event) => sessionRecoveryService.append(event))
    ipcMain.handle('sessions:recovery:checkpoint', (_event, sessionId: string, snapshot: Record<string, unknown>) =>
      sessionRecoveryService.checkpoint(sessionId, snapshot)
    )
    ipcMain.handle('sessions:recovery:recover', (_event, sessionId: string) => sessionRecoveryService.recover(sessionId))
    ipcMain.handle('sessions:recovery:complete', (_event, sessionId: string, lifecycle: 'completed' | 'discarded') =>
      sessionRecoveryService.complete(sessionId, lifecycle)
    )

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

    const activeLLMStreams = new Map<string, AbortController>()

    ipcMain.handle('credentials:callLLM', async (_event, payload: any) => {
      return credentialStore.callLLM(payload)
    })

    ipcMain.on(
      'credentials:streamLLM:start',
      async (
        event,
        payload: { requestId: string; input: any }
      ) => {
        const { requestId, input } = payload
        if (!requestId) return

        // Cancel previous controller with same requestId if any exists
        const existing = activeLLMStreams.get(requestId)
        if (existing) {
          existing.abort()
          activeLLMStreams.delete(requestId)
        }

        const controller = new AbortController()
        activeLLMStreams.set(requestId, controller)

        credentialStore.streamLLM(
          input,
          {
            onFirstToken: (data) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send('credentials:streamLLM:first-token', { requestId, ...data })
              }
            },
            onDelta: (data) => {
              if (!event.sender.isDestroyed()) {
                event.sender.send('credentials:streamLLM:delta', { requestId, ...data })
              }
            },
            onDone: (data) => {
              activeLLMStreams.delete(requestId)
              if (!event.sender.isDestroyed()) {
                event.sender.send('credentials:streamLLM:done', { requestId, ...data })
              }
            },
            onError: (data) => {
              activeLLMStreams.delete(requestId)
              if (!event.sender.isDestroyed()) {
                event.sender.send('credentials:streamLLM:error', { requestId, ...data })
              }
            },
          },
          controller.signal
        )
      }
    )

    ipcMain.on('credentials:streamLLM:cancel', (_event, payload: { requestId: string }) => {
      if (!payload?.requestId) return
      const controller = activeLLMStreams.get(payload.requestId)
      if (controller) {
        controller.abort()
        activeLLMStreams.delete(payload.requestId)
      }
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
