import { app, BrowserWindow, session, desktopCapturer } from 'electron';
import { createOverlayWindow } from './window/overlay-window.js';
import { registerIpcHandlers } from './ipc/handler.js';
import { getWhisperProcessManager } from './services/whisperProcessManager.js';
// Disable security warnings in development
if (process.env['NODE_ENV'] === 'development') {
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}
// ── Globals ──────────────────────────────────────────────────────────────────
let mainWindow = null;
// ── Prevent multiple instances ────────────────────────────────────────────────
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) {
    app.quit();
    process.exit(0);
}
app.on('second-instance', () => {
    // Focus the existing window when a second instance is launched
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    try {
        // Enable system audio loopback capture for navigator.mediaDevices.getDisplayMedia
        session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
            desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
                if (sources && sources.length > 0) {
                    const validSource = sources.find((s) => !s.thumbnail.isEmpty()) || sources[0];
                    callback({
                        video: validSource,
                        audio: 'loopback',
                    });
                }
                else {
                    callback({ video: undefined, audio: 'loopback' });
                }
            }).catch((err) => {
                console.error('[Electron] desktopCapturer.getSources error:', err);
                try {
                    callback({ video: undefined, audio: 'loopback' });
                }
                catch { }
            });
        });
        mainWindow = createOverlayWindow();
        registerIpcHandlers(mainWindow);
        // macOS: re-create window when dock icon is clicked and no windows exist
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                mainWindow = createOverlayWindow();
                if (mainWindow)
                    registerIpcHandlers(mainWindow);
            }
        });
    }
    catch (err) {
        console.error('[Electron] Failed to create window:', err);
        app.quit();
    }
});
// ── Quit behaviour ────────────────────────────────────────────────────────────
// On Windows/Linux: quit when all windows are closed.
// On macOS: keep app running (handled by 'activate').
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// ── Graceful shutdown ─────────────────────────────────────────────────────────
app.on('before-quit', () => {
    // Clean up native whisper processes
    try {
        getWhisperProcessManager().destroy();
    }
    catch (err) {
        console.error('[Electron] Error destroying WhisperProcessManager:', err);
    }
    mainWindow = null;
});
// ── Unhandled promise rejections ──────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error('[Electron] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[Electron] Uncaught exception:', err);
    // Don't crash the process for non-fatal errors in dev; in prod you may
    // want to show a native error dialog and restart.
});
//# sourceMappingURL=main.js.map