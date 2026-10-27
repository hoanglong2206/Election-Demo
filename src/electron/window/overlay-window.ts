import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


const isDev = process.env['NODE_ENV'] === 'development'

export function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  const width = parseInt(process.env.OVERLAY_WIDTH || '980', 10)
  const height = parseInt(process.env.OVERLAY_HEIGHT || '700', 10)
  const marginRight = parseInt(process.env.OVERLAY_MARGIN_RIGHT || '20', 10)
  const yPos = parseInt(process.env.OVERLAY_MARGIN_TOP || '40', 10)

  const win = new BrowserWindow({
    // ── Sizing & position ──────────────────────────────────────────────────
    width,
    height,
    x: screenWidth - width - marginRight,
    y: yPos,

    // ── Overlay appearance ─────────────────────────────────────────────────
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // Prevents DWM white flash on window focus / click
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false, // Prevents Windows DWM native border/shadow white repaint on focus
    show: false, // Don't show immediately to prevent stealing focus on startup

    // ── Always-on-top level (above most apps, including meeting clients) ───
    // 'screen-saver' is the highest stable level for Windows
    // Set via setAlwaysOnTop after creation for cross-platform support

    // ── Security ───────────────────────────────────────────────────────────
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,       // MUST stay false
      contextIsolation: true,       // MUST stay true
      sandbox: false,               // Allow preload to use Node built-ins
      webSecurity: true,            // NEVER disable web security
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
    },
  })

  // Explicitly enforce transparent root buffer to eliminate white flashes on Windows composition
  win.setBackgroundColor('#00000000')

  // ── Screen Protection & Always-on-top ────────────────────────────────────
  // Ẩn hoàn toàn khỏi screen capture / screen share / WebRTC (kể cả Entire Screen)
  // Trên Windows 10 (2004+) & Windows 11: Electron tự gọi SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
  // Trên macOS: NSWindowSharingNone
  try {
    win.setContentProtection(true)
    console.log('[Electron] Content protection enabled (WDA_EXCLUDEFROMCAPTURE):', win.isContentProtected())
  } catch (err) {
    console.error('[Electron] Failed to enable content protection:', err)
  }

  // Set a high always-on-top level after window creation
  const level = (process.env.ALWAYS_ON_TOP_LEVEL || 'screen-saver') as any
  win.setAlwaysOnTop(true, level)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // ── Show without stealing focus ───────────────────────────────────────────
  // Tránh kích hoạt window.onblur trên các trang web toàn màn hình
  win.once('ready-to-show', () => {
    win.showInactive()
  })

  // ── Load the UI ────────────────────────────────────────────────────────────
  if (isDev) {
    const devUrl = process.env.DEV_SERVER_URL || 'http://localhost:5173'
    void win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach', activate: false })
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // ── Window event handlers ──────────────────────────────────────────────────
  win.on('closed', () => {
    // Allow GC — reference is cleared by caller via app.quit()
  })

  return win
}
