import { app } from 'electron'
import fs from 'fs'
import path from 'path'

function getSessionEpoch(session: any): number {
  if (!session) return 0
  if (typeof session.startedAt === 'number' && session.startedAt > 0) return session.startedAt
  if (typeof session.endedAt === 'number' && session.endedAt > 0) return session.endedAt
  if (typeof session.id === 'string') {
    const match = session.id.match(/(?:session_|session-live-|audiotest_|^)(\d{10,13})/i)
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed < 10000000000 ? parsed * 1000 : parsed
      }
    }
  }
  if (typeof session.date === 'string' && session.date.trim()) {
    const m = session.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
    if (m) {
      const day = parseInt(m[1], 10)
      const month = parseInt(m[2], 10) - 1
      const year = parseInt(m[3], 10)
      const hour = parseInt(m[4] || '0', 10)
      const min = parseInt(m[5] || '0', 10)
      const sec = parseInt(m[6] || '0', 10)
      const dt = new Date(year, month, day, hour, min, sec)
      if (!isNaN(dt.getTime())) return dt.getTime()
    }
    const dateParsed = Date.parse(session.date)
    if (!isNaN(dateParsed) && dateParsed > 0) return dateParsed
  }
  return 0
}

export class ElectronSessionStorage {
  private sessionsDir: string

  constructor() {
    this.sessionsDir = path.join(app.getPath('userData'), 'sessions')
    this.ensureDir()
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true })
      }
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to create sessions directory:', err)
    }
  }

  private getSafeFilename(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${safe}.json`
  }

  public getAll(): any[] {
    this.ensureDir()
    try {
      const files = fs.readdirSync(this.sessionsDir)
      const sessions: any[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const filePath = path.join(this.sessionsDir, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          const parsed = JSON.parse(content)
          if (parsed && parsed.id) {
            sessions.push(parsed)
          }
        } catch (readErr) {
          console.warn(`[ElectronSessionStorage] Failed to parse file ${file}:`, readErr)
        }
      }

      // Sort sessions: newest first
      sessions.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))

      return sessions
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to read sessions:', err)
      return []
    }
  }

  public save(session: any): boolean {
    this.ensureDir()
    if (!session || !session.id) return false
    try {
      const filePath = path.join(this.sessionsDir, this.getSafeFilename(session.id))
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
      return true
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to save session ${session.id}:`, err)
      return false
    }
  }

  public delete(sessionId: string): boolean {
    this.ensureDir()
    try {
      const filePath = path.join(this.sessionsDir, this.getSafeFilename(sessionId))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return true
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to delete session ${sessionId}:`, err)
      return false
    }
  }

  public deleteMany(sessionIds: string[]): boolean {
    this.ensureDir()
    try {
      for (const id of sessionIds) {
        const filePath = path.join(this.sessionsDir, this.getSafeFilename(id))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
      return true
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to delete multiple sessions:', err)
      return false
    }
  }

  public deleteAll(): boolean {
    this.ensureDir()
    try {
      const files = fs.readdirSync(this.sessionsDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.sessionsDir, file))
        }
      }
      return true
    } catch (err) {
      console.error('[ElectronSessionStorage] Failed to delete all sessions:', err)
      return false
    }
  }

  public rename(sessionId: string, newTitle: string): boolean {
    this.ensureDir()
    const trimmed = newTitle.trim()
    if (!trimmed) return false
    try {
      const filePath = path.join(this.sessionsDir, this.getSafeFilename(sessionId))
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const session = JSON.parse(content)
        session.title = trimmed
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
        return true
      }
      return false
    } catch (err) {
      console.error(`[ElectronSessionStorage] Failed to rename session ${sessionId}:`, err)
      return false
    }
  }
}
