import { ipcMain, desktopCapturer, screen } from 'electron'
import { IPC_CHANNELS } from '../../../common/ipc/channels.js'
import type { DesktopCaptureOptions, DesktopCaptureResult } from '../../../common/ipc/types.js'

export function registerCaptureHandlers(): void {
  // ── Desktop sources for audio/screen capture ──────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CAPTURE.GET_SOURCES, async (_event, types?: ('screen' | 'window')[]) => {
    try {
      const sources = await desktopCapturer.getSources({ types: types || ['screen', 'window'] })
      return sources.map((s) => ({ id: s.id, name: s.name }))
    } catch (err) {
      console.error('[Electron] Error getting desktop sources:', err)
      return []
    }
  })

  // ── Native Screen Capture via Electron desktopCapturer ─────────────────────
  ipcMain.handle(
    IPC_CHANNELS.CAPTURE.CAPTURE_SCREEN,
    async (_event, options?: DesktopCaptureOptions): Promise<DesktopCaptureResult> => {
      try {
        const primaryDisplay = screen.getPrimaryDisplay()
        const scale = primaryDisplay?.scaleFactor || 1
        const bounds = primaryDisplay?.bounds || { width: 1920, height: 1080 }
        const targetWidth = Math.min(Math.round((bounds.width || 1920) * scale), 1920)
        const targetHeight = Math.min(Math.round((bounds.height || 1080) * scale), 1080)

        let selected: Electron.DesktopCapturerSource | null = null
        const sourceType = options?.sourceType || 'window'

        // Select the requested source when the picker supplied a source id
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

        // Fall back to entire screen capture if no valid window source found
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
    }
  )
}
