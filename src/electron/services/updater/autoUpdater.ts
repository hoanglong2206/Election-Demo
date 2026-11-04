import { app } from 'electron'
import { createRequire } from 'node:module'
import type { AppUpdater } from 'electron-updater'

const require = createRequire(import.meta.url)

/**
 * Initializes the background auto-updater service for production builds.
 * Communicates with GitHub Releases to check for and download app updates.
 */
export function initializeAutoUpdater(): void {
  // Only check for updates in packaged production builds
  if (!app.isPackaged && process.env['NODE_ENV'] === 'development') {
    console.log('[AutoUpdater] Development mode detected - skipping update check')
    return
  }

  try {
    const updaterModule = require('electron-updater')
    const autoUpdater: AppUpdater = updaterModule.autoUpdater || updaterModule.default?.autoUpdater

    if (!autoUpdater) {
      console.warn('[AutoUpdater] autoUpdater instance not found in electron-updater module')
      return
    }

    // Automatically download update in background once detected
    autoUpdater.autoDownload = true
    // Automatically install when the user quits the application
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates on GitHub Releases...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log(`[AutoUpdater] New update found: version ${info.version}. Downloading in background...`)
    })

    autoUpdater.on('update-not-available', () => {
      console.log(`[AutoUpdater] Application is up to date (current version: ${app.getVersion()})`)
    })

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Error during update check/download:', err?.message || err)
    })

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(
        `[AutoUpdater] Downloaded ${progressObj.percent.toFixed(1)}% (${(progressObj.transferred / 1024 / 1024).toFixed(1)}MB / ${(progressObj.total / 1024 / 1024).toFixed(1)}MB)`
      )
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[AutoUpdater] Update ${info.version} downloaded. It will be installed automatically on exit.`)
    })

    // Delay check 5 seconds after launch to ensure startup and UI rendering complete smoothly
    setTimeout(() => {
      try {
        void autoUpdater.checkForUpdatesAndNotify()
      } catch (err) {
        console.error('[AutoUpdater] Failed to initiate update check:', err)
      }
    }, 5000)
  } catch (err) {
    console.error('[AutoUpdater] Failed to initialize AutoUpdater:', err)
  }
}


