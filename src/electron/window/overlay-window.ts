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
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: true,

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
    },
  })

  // Set a high always-on-top level after window creation
  const level = (process.env.ALWAYS_ON_TOP_LEVEL || 'screen-saver') as any
  win.setAlwaysOnTop(true, level)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // ── Load the UI ────────────────────────────────────────────────────────────
  if (isDev) {
    const devUrl = process.env.DEV_SERVER_URL || 'http://localhost:5173'
    void win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // ── Window event handlers ──────────────────────────────────────────────────
  win.on('closed', () => {
    // Allow GC — reference is cleared by caller via app.quit()
  })

  return win
}
