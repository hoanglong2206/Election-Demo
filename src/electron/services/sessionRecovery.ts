import fs from 'fs'
import path from 'path'

export type RecoveryLifecycle = 'active' | 'recovering' | 'completed' | 'discarded'

export interface SessionEvent {
  eventId: string
  sessionId: string
  type: string
  timestamp: number
  payload: Record<string, unknown>
}

export interface RecoveryRecord {
  sessionId: string
  lifecycle: RecoveryLifecycle
  updatedAt: number
  snapshot?: Record<string, unknown>
  eventCount: number
}

interface RecoveryFiles {
  journal: string
  snapshot: string
}

function atomicWrite(filePath: string, content: string): void {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporary, content, 'utf8')
  fs.renameSync(temporary, filePath)
}

function sanitizePayloadForRecovery(payload: Record<string, unknown>): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return payload
  const cloned = { ...payload }

  for (const key of ['dataUrl', 'base64'] as const) {
    if (typeof cloned[key] === 'string' && (cloned[key] as string).startsWith('data:image')) {
      delete cloned[key]
    }
  }

  if (typeof cloned.thumbnailUrl === 'string' && cloned.thumbnailUrl.startsWith('data:image')) {
    cloned.thumbnailUrl = (cloned.imageUrl as string) || '[externalized_image]'
  }

  if (Array.isArray(cloned.screenshotQuestions)) {
    cloned.screenshotQuestions = cloned.screenshotQuestions.map((sq: any) => {
      if (!sq || typeof sq !== 'object') return sq
      const item = { ...sq }
      delete item.dataUrl
      delete item.base64
      if (typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.startsWith('data:image')) {
        item.thumbnailUrl = item.imageUrl || '[externalized_image]'
      }
      return item
    })
  }

  return cloned
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export class SessionRecoveryService {
  private readonly configuredDirectory: string

  constructor(directory: string) {
    this.configuredDirectory = directory
  }

  private getDirectory(): string {
    const directory = this.configuredDirectory
    fs.mkdirSync(directory, { recursive: true })
    return directory
  }

  private files(sessionId: string): RecoveryFiles {
    const id = safeId(sessionId)
    const directory = this.getDirectory()
    return {
      journal: path.join(directory, `${id}.journal.ndjson`),
      snapshot: path.join(directory, `${id}.snapshot.json`),
    }
  }

  append(event: SessionEvent): boolean {
    if (!event.sessionId || !event.eventId || !event.type) return false
    const files = this.files(event.sessionId)
    try {
      const sanitizedEvent = {
        ...event,
        payload: sanitizePayloadForRecovery(event.payload),
      }
      fs.appendFileSync(files.journal, `${JSON.stringify(sanitizedEvent)}\n`, 'utf8')
      return true
    } catch (error) {
      console.error('[SessionRecovery] Failed to append event:', error)
      return false
    }
  }

  checkpoint(sessionId: string, snapshot: Record<string, unknown>): boolean {
    if (!sessionId) return false
    try {
      const files = this.files(sessionId)
      const sanitizedSnapshot = sanitizePayloadForRecovery(snapshot)
      atomicWrite(files.snapshot, JSON.stringify({
        version: 1,
        sessionId,
        lifecycle: 'active',
        updatedAt: Date.now(),
        snapshot: sanitizedSnapshot,
      }, null, 2))
      return true
    } catch (error) {
      console.error('[SessionRecovery] Failed to write checkpoint:', error)
      return false
    }
  }

  complete(sessionId: string, lifecycle: 'completed' | 'discarded'): boolean {
    const files = this.files(sessionId)
    try {
      if (fs.existsSync(files.snapshot)) {
        const current = JSON.parse(fs.readFileSync(files.snapshot, 'utf8')) as Record<string, unknown>
        current.lifecycle = lifecycle
        current.updatedAt = Date.now()
        atomicWrite(files.snapshot, JSON.stringify(current, null, 2))
      }
      if (lifecycle === 'completed' || lifecycle === 'discarded') {
        if (fs.existsSync(files.journal)) fs.unlinkSync(files.journal)
        if (fs.existsSync(files.snapshot)) fs.unlinkSync(files.snapshot)
      }
      return true
    } catch (error) {
      console.error('[SessionRecovery] Failed to finalize recovery:', error)
      return false
    }
  }

  listUnfinished(): RecoveryRecord[] {
    const records: RecoveryRecord[] = []
    for (const file of fs.readdirSync(this.getDirectory())) {
      if (!file.endsWith('.snapshot.json')) continue
      try {
        const snapshot = JSON.parse(fs.readFileSync(path.join(this.getDirectory(), file), 'utf8')) as Record<string, unknown>
        if (snapshot.lifecycle !== 'active') continue
        const sessionId = String(snapshot.sessionId || file.replace('.snapshot.json', ''))
        const replayed = this.replay(sessionId, snapshot)
        records.push({
          sessionId,
          lifecycle: 'recovering',
          updatedAt: Number(snapshot.updatedAt) || 0,
          snapshot: replayed,
          eventCount: this.readEvents(sessionId).length,
        })
      } catch (error) {
        console.warn(`[SessionRecovery] Ignoring invalid snapshot ${file}:`, error)
      }
    }
    return records.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  recover(sessionId: string): RecoveryRecord | null {
    const files = this.files(sessionId)
    if (!fs.existsSync(files.snapshot)) return null
    try {
      const snapshot = JSON.parse(fs.readFileSync(files.snapshot, 'utf8')) as Record<string, unknown>
      const replayed = this.replay(sessionId, snapshot)
      return {
        sessionId,
        lifecycle: 'recovering',
        updatedAt: Number(snapshot.updatedAt) || 0,
        snapshot: replayed,
        eventCount: this.readEvents(sessionId).length,
      }
    } catch (error) {
      console.error('[SessionRecovery] Failed to recover session:', error)
      return null
    }
  }

  private readEvents(sessionId: string): SessionEvent[] {
    const file = this.files(sessionId).journal
    if (!fs.existsSync(file)) return []
    const seen = new Set<string>()
    const events: SessionEvent[] = []
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as SessionEvent
        if (!event.eventId || seen.has(event.eventId)) continue
        seen.add(event.eventId)
        events.push(event)
      } catch {
        break
      }
    }
    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  private replay(sessionId: string, snapshot: Record<string, unknown>): Record<string, unknown> {
    const base = (snapshot.snapshot && typeof snapshot.snapshot === 'object'
      ? { ...(snapshot.snapshot as Record<string, unknown>) }
      : {}) as Record<string, unknown>
    for (const event of this.readEvents(sessionId)) {
      if (event.type === 'meeting:metadata') Object.assign(base, event.payload)
      if (event.type === 'transcript:segment') {
        const transcripts = Array.isArray(base.transcripts) ? [...base.transcripts] : []
        if (!transcripts.some((item) => (item as { id?: unknown })?.id === event.payload.id)) transcripts.push(event.payload)
        base.transcripts = transcripts
      }
      if (event.type === 'suggestion' || event.type === 'visual:question' || event.type === 'usage') {
        const key = event.type === 'suggestion' ? 'suggestions' : event.type === 'visual:question' ? 'screenshotQuestions' : 'usageRecords'
        const items = Array.isArray(base[key]) ? [...base[key]] : []
        if (!items.some((item) => (item as { id?: unknown })?.id === event.payload.id)) items.push(event.payload)
        base[key] = items
      }
    }
    return base
  }
}
