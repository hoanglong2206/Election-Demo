import * as electron from 'electron'
import fs from 'fs'
import path from 'path'

const electronObj = (electron as any)?.default?.app ? (electron as any).default : (electron as any)
const app = electronObj?.app

export interface AppStateData {
  firstRunCompleted: boolean
  schemaVersion: number
  updatedAt: number
}

const DEFAULT_APP_STATE: AppStateData = {
  firstRunCompleted: false,
  schemaVersion: 1,
  updatedAt: Date.now(),
}

export class AppStateManager {
  private readonly stateFilePath: string
  private cachedState: AppStateData | null = null

  constructor(customPath?: string) {
    if (customPath) {
      this.stateFilePath = customPath
    } else if (app && typeof app.getPath === 'function') {
      this.stateFilePath = path.join(app.getPath('userData'), 'app-state.json')
    } else {
      this.stateFilePath = path.join(process.cwd(), 'userData', 'app-state.json')
    }
  }

  public getState(): AppStateData {
    if (this.cachedState) return { ...this.cachedState }
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf8')
        const parsed = JSON.parse(raw)
        this.cachedState = {
          firstRunCompleted: Boolean(parsed.firstRunCompleted),
          schemaVersion: Number(parsed.schemaVersion) || 1,
          updatedAt: Number(parsed.updatedAt) || Date.now(),
        }
        return { ...this.cachedState }
      }
    } catch (err) {
      console.warn('[AppStateManager] Failed to read app-state.json:', err)
    }

    this.cachedState = { ...DEFAULT_APP_STATE }
    return { ...this.cachedState }
  }

  public setFirstRunCompleted(completed: boolean): boolean {
    const current = this.getState()
    current.firstRunCompleted = completed
    current.updatedAt = Date.now()
    return this.saveState(current)
  }

  public isFirstRunCompleted(): boolean {
    return this.getState().firstRunCompleted
  }

  private saveState(state: AppStateData): boolean {
    try {
      const dir = path.dirname(this.stateFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const tmp = `${this.stateFilePath}.${process.pid}.${Date.now()}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
      try {
        fs.renameSync(tmp, this.stateFilePath)
      } catch (renameErr: any) {
        if (renameErr?.code === 'EPERM' || renameErr?.code === 'EBUSY' || renameErr?.code === 'EACCES') {
          fs.copyFileSync(tmp, this.stateFilePath)
          try { fs.unlinkSync(tmp) } catch {}
        } else {
          throw renameErr
        }
      }
      this.cachedState = { ...state }
      return true
    } catch (err) {
      console.error('[AppStateManager] Failed to persist app-state.json:', err)
      return false
    }
  }
}

let defaultAppStateManager: AppStateManager | null = null
export function getAppStateManager(): AppStateManager {
  if (!defaultAppStateManager) {
    defaultAppStateManager = new AppStateManager()
  }
  return defaultAppStateManager
}
