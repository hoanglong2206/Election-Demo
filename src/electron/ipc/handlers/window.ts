import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../common/index.js'

export function registerWindowHandlers(win: BrowserWindow): void {
  ipcMain.on(IPC_CHANNELS.WINDOW.MINIMIZE, () => {
    if (!win.isDestroyed()) win.minimize()
  })

  // Notify renderer when window is restored to reverse the minimize animation
  win.on('restore', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.WINDOW.RESTORED)
  })

  // Notify renderer when window is maximized/unmaximized to reverse animations
  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.WINDOW.RESTORED)
  })

  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.WINDOW.RESTORED)
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
    if (!win.isDestroyed()) {
      if (win.isMaximized()) win.restore()
      else win.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.CLOSE, () => {
    if (!win.isDestroyed()) win.close()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.RESIZE, (_event, width: number, height: number) => {
    if (!win.isDestroyed() && !win.isMaximized()) {
      const bounds = win.getBounds()
      // Anchor to the right edge: shift X left by the amount the width is expanding
      const newX = bounds.x - (width - bounds.width)
      win.setBounds({ x: newX, y: bounds.y, width, height }, true)
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.HIDE, () => {
    if (!win.isDestroyed()) win.hide()
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.SHOW, (_event, inactive?: boolean) => {
    if (!win.isDestroyed()) {
      if (inactive) win.showInactive()
      else win.show()
    }
  })

  ipcMain.on(IPC_CHANNELS.WINDOW.SHOW_INACTIVE, () => {
    if (!win.isDestroyed()) win.showInactive()
  })

  // ── Screen Protection & Stealth Mode Controls ──────────────────────────────
  ipcMain.handle(IPC_CHANNELS.WINDOW.SET_CONTENT_PROTECTION, (_event, enable: boolean) => {
    if (!win.isDestroyed()) {
      win.setContentProtection(enable)
      return win.isContentProtected()
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.IS_CONTENT_PROTECTED, () => {
    return !win.isDestroyed() && win.isContentProtected()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.SET_FOCUSABLE, (_event, focusable: boolean) => {
    if (!win.isDestroyed()) {
      win.setFocusable(focusable)
      return true
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.SET_IGNORE_MOUSE_EVENTS, (_event, ignore: boolean, forward = true) => {
    if (!win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward })
      return true
    }
    return false
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW.SET_STEALTH_MODE, (_event, enabled: boolean) => {
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

  ipcMain.handle(IPC_CHANNELS.WINDOW.TOGGLE_ALWAYS_ON_TOP, () => {
    const current = win.isAlwaysOnTop()
    win.setAlwaysOnTop(!current, 'screen-saver')
    return !current
  })

  // ── Mode toggle ────────────────────────────────────────────────────────────
  ipcMain.on(IPC_CHANNELS.WINDOW.MODE_TOGGLE, (_event, mode: string) => {
    console.log('[Electron] Mode changed to:', mode)
  })
}
