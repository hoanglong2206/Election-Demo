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

export interface ListUnfinishedOptions {
  activeSessionId?: string
  minEventsThreshold?: number
  maxAgeDays?: number
}

function atomicWriteWithFsync(filePath: string, content: string): void {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  const fd = fs.openSync(temporary, 'w')
  try {
    fs.writeFileSync(fd, content, 'utf8')
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
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
  private readonly pendingQueues = new Map<string, SessionEvent[]>()
  private readonly flushTimers = new Map<string, NodeJS.Timeout>()
  private readonly writeChains = new Map<string, Promise<void>>()
  private readonly batchWindowMs: number = 250

  constructor(directory: string, batchWindowMs: number = 250) {
    this.configuredDirectory = directory
    this.batchWindowMs = batchWindowMs
  }

  private getDirectory(): string {
    const directory = this.configuredDirectory
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }
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

  /**
   * Appends an event to the batch write queue (~250ms batching).
   */
  append(event: SessionEvent): boolean {
    if (!event.sessionId || !event.eventId || !event.type) return false
    const sanitizedEvent: SessionEvent = {
      ...event,
      payload: sanitizePayloadForRecovery(event.payload),
    }

    const sid = event.sessionId
    if (!this.pendingQueues.has(sid)) {
      this.pendingQueues.set(sid, [])
    }
    this.pendingQueues.get(sid)!.push(sanitizedEvent)

    if (!this.flushTimers.has(sid)) {
      const timer = setTimeout(() => {
        this.flushTimers.delete(sid)
        void this.flushQueueAsync(sid)
      }, this.batchWindowMs)
      this.flushTimers.set(sid, timer)
    }

    return true
  }

  /**
   * Asynchronously flushes queued events to the journal file sequentially.
   */
  private async flushQueueAsync(sessionId: string): Promise<void> {
    const events = this.pendingQueues.get(sessionId)
    if (!events || events.length === 0) {
      this.pendingQueues.delete(sessionId)
      return
    }

    this.pendingQueues.delete(sessionId)
    const files = this.files(sessionId)
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'

    const currentChain = this.writeChains.get(sessionId) || Promise.resolve()
    const nextChain = currentChain
      .then(async () => {
        await fs.promises.appendFile(files.journal, lines, 'utf8')
      })
      .catch((error) => {
        console.error('[SessionRecovery] Async journal append failed:', error)
      })

    this.writeChains.set(sessionId, nextChain)
    await nextChain
  }

  /**
   * Synchronously flushes any in-memory queued events to disk (used on checkpoint / shutdown).
   */
  public flushSync(sessionId?: string): void {
    const targetSessionIds = sessionId ? [sessionId] : Array.from(this.pendingQueues.keys())

    for (const sid of targetSessionIds) {
      const timer = this.flushTimers.get(sid)
      if (timer) {
        clearTimeout(timer)
        this.flushTimers.delete(sid)
      }

      const events = this.pendingQueues.get(sid)
      if (events && events.length > 0) {
        this.pendingQueues.delete(sid)
        const files = this.files(sid)
        try {
          const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
          fs.appendFileSync(files.journal, lines, 'utf8')
        } catch (err) {
          console.error('[SessionRecovery] Sync flush failed:', err)
        }
      }
    }
  }

  /**
   * Main performs checkpoint compaction:
   * Merges journal events into snapshot (storing lastEventId),
   * atomically truncates/rotates journal, writes compact JSON (no pretty-print), fsyncs.
   */
  checkpoint(sessionId: string, snapshotMetadata?: Record<string, unknown>): boolean {
    if (!sessionId) return false
    try {
      this.flushSync(sessionId)
      const files = this.files(sessionId)

      let currentSnapshotObj: Record<string, unknown> = {}
      let lastEventId: string | undefined = undefined

      if (fs.existsSync(files.snapshot)) {
        try {
          const raw = fs.readFileSync(files.snapshot, 'utf8')
          currentSnapshotObj = JSON.parse(raw) as Record<string, unknown>
          lastEventId = typeof currentSnapshotObj.lastEventId === 'string'
            ? currentSnapshotObj.lastEventId
            : undefined
        } catch (err) {
          console.warn('[SessionRecovery] Failed reading existing snapshot during checkpoint, creating new:', err)
        }
      }

      // Read journal events
      const allEvents = this.readEvents(sessionId)

      // Find uncompacted events after lastEventId
      let newEvents: SessionEvent[] = allEvents
      if (lastEventId) {
        const lastIdx = allEvents.findIndex((e) => e.eventId === lastEventId)
        if (lastIdx !== -1) {
          newEvents = allEvents.slice(lastIdx + 1)
        }
      }

      // Base snapshot state
      const baseSnapshot = (currentSnapshotObj.snapshot && typeof currentSnapshotObj.snapshot === 'object'
        ? { ...(currentSnapshotObj.snapshot as Record<string, unknown>) }
        : {}) as Record<string, unknown>

      if (snapshotMetadata) {
        const sanitizedMeta = sanitizePayloadForRecovery(snapshotMetadata)
        // Exclude huge transcripts from snapshotMetadata if provided; journal is single source of truth
        const { transcripts: _ignored, ...metadataOnly } = sanitizedMeta
        Object.assign(baseSnapshot, metadataOnly)
      }

      // Merge new events idempotently into base snapshot
      this.applyEventsToSnapshot(baseSnapshot, newEvents)

      const latestEventId = allEvents.length > 0 ? allEvents[allEvents.length - 1].eventId : lastEventId

      const compactSnapshotRecord = {
        version: 1,
        sessionId,
        lifecycle: 'active',
        updatedAt: Date.now(),
        lastEventId: latestEventId,
        snapshot: baseSnapshot,
      }

      // Write compact JSON (no indentation) with fsync
      atomicWriteWithFsync(files.snapshot, JSON.stringify(compactSnapshotRecord))

      // Atomic journal rotation/compaction:
      // Since all events up to latestEventId are now durably committed to the snapshot,
      // truncate journal or keep only any late-arriving events
      if (allEvents.length > 0) {
        try {
          atomicWriteWithFsync(files.journal, '')
        } catch (rotateErr) {
          console.warn('[SessionRecovery] Failed to rotate journal:', rotateErr)
        }
      }

      return true
    } catch (error) {
      console.error('[SessionRecovery] Failed to write checkpoint:', error)
      return false
    }
  }

  complete(sessionId: string, lifecycle: 'completed' | 'discarded'): boolean {
    const sid = sessionId
    const timer = this.flushTimers.get(sid)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(sid)
    }
    this.pendingQueues.delete(sid)

    const files = this.files(sessionId)
    try {
      if (fs.existsSync(files.snapshot)) {
        try {
          const current = JSON.parse(fs.readFileSync(files.snapshot, 'utf8')) as Record<string, unknown>
          current.lifecycle = lifecycle
          current.updatedAt = Date.now()
          atomicWriteWithFsync(files.snapshot, JSON.stringify(current))
        } catch {}
      }

      if (lifecycle === 'completed' || lifecycle === 'discarded') {
        if (fs.existsSync(files.journal)) {
          try {
            fs.unlinkSync(files.journal)
          } catch {}
        }
        if (fs.existsSync(files.snapshot)) {
          try {
            fs.unlinkSync(files.snapshot)
          } catch {}
        }
      }
      return true
    } catch (error) {
      console.error('[SessionRecovery] Failed to finalize recovery:', error)
      return false
    }
  }

  /**
   * Scans both *.snapshot.json AND *.journal.ndjson.
   * If a session has only a journal, reconstructs snapshot from metadata and events.
   * Skips active session, skips journals below threshold, and cleans up expired orphans (> 7 days).
   */
  listUnfinished(options?: ListUnfinishedOptions): RecoveryRecord[] {
    const activeSessionId = options?.activeSessionId
    const minEventsThreshold = options?.minEventsThreshold ?? 1
    const maxAgeDays = options?.maxAgeDays ?? 7
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const now = Date.now()

    this.flushSync()

    const directory = this.getDirectory()
    let filesInDir: string[] = []
    try {
      filesInDir = fs.readdirSync(directory)
    } catch (err) {
      console.warn('[SessionRecovery] Failed to read recovery dir:', err)
      return []
    }

    const sessionIds = new Set<string>()
    for (const file of filesInDir) {
      if (file.endsWith('.snapshot.json')) {
        sessionIds.add(file.slice(0, -'.snapshot.json'.length))
      } else if (file.endsWith('.journal.ndjson')) {
        sessionIds.add(file.slice(0, -'.journal.ndjson'.length))
      }
    }

    const records: RecoveryRecord[] = []

    for (const rawSessionId of sessionIds) {
      if (activeSessionId && (rawSessionId === activeSessionId || safeId(rawSessionId) === safeId(activeSessionId))) {
        continue
      }

      const files = this.files(rawSessionId)
      let snapshotMtime = 0
      let journalMtime = 0

      if (fs.existsSync(files.snapshot)) {
        try {
          snapshotMtime = fs.statSync(files.snapshot).mtimeMs
        } catch {}
      }
      if (fs.existsSync(files.journal)) {
        try {
          journalMtime = fs.statSync(files.journal).mtimeMs
        } catch {}
      }

      const latestMtime = Math.max(snapshotMtime, journalMtime)
      // Clean up orphaned recovery files older than retention policy
      if (latestMtime > 0 && now - latestMtime > maxAgeMs) {
        try {
          if (fs.existsSync(files.snapshot)) fs.unlinkSync(files.snapshot)
          if (fs.existsSync(files.journal)) fs.unlinkSync(files.journal)
        } catch {}
        continue
      }

      // Read events once per session to avoid reading journal twice
      const events = this.readEvents(rawSessionId)

      if (fs.existsSync(files.snapshot)) {
        try {
          const raw = fs.readFileSync(files.snapshot, 'utf8')
          const snapshotObj = JSON.parse(raw) as Record<string, unknown>
          if (snapshotObj.lifecycle !== 'active') continue

          const actualSessionId = String(snapshotObj.sessionId || rawSessionId)
          const baseSnapshot = (snapshotObj.snapshot && typeof snapshotObj.snapshot === 'object'
            ? { ...(snapshotObj.snapshot as Record<string, unknown>) }
            : {}) as Record<string, unknown>

          // Replay unmerged events
          const lastEventId = typeof snapshotObj.lastEventId === 'string' ? snapshotObj.lastEventId : undefined
          let newEvents = events
          if (lastEventId) {
            const idx = events.findIndex((e) => e.eventId === lastEventId)
            if (idx !== -1) newEvents = events.slice(idx + 1)
          }
          this.applyEventsToSnapshot(baseSnapshot, newEvents)

          const snapshotUpdatedAt = Number(snapshotObj.updatedAt) || 0
          const lastEventTimestamp = events.length > 0 ? events[events.length - 1].timestamp : 0
          const updatedAt = Math.max(snapshotUpdatedAt, lastEventTimestamp, Math.round(latestMtime))

          records.push({
            sessionId: actualSessionId,
            lifecycle: 'recovering',
            updatedAt,
            snapshot: baseSnapshot,
            eventCount: events.length,
          })
        } catch (error) {
          console.warn(`[SessionRecovery] Ignoring invalid snapshot ${files.snapshot}:`, error)
        }
      } else if (fs.existsSync(files.journal)) {
        // Journal-only recovery: reconstruct session aggregate from events
        if (events.length < minEventsThreshold) {
          continue
        }

        const metaEvent = events.find((e) => e.type === 'meeting:metadata')
        const title = (metaEvent?.payload?.title as string) || 'Cuộc họp chưa lưu'
        const mode = (metaEvent?.payload?.mode as string) || 'interview'
        const startedAt = Number(metaEvent?.payload?.startedAt) || events[0]?.timestamp || Math.round(journalMtime)

        const reconstructed: Record<string, unknown> = {
          id: rawSessionId,
          title,
          mode,
          startedAt,
          lifecycle: 'active',
          transcripts: [],
          suggestions: [],
          screenshotQuestions: [],
          usageRecords: [],
        }

        if (metaEvent?.payload) {
          Object.assign(reconstructed, metaEvent.payload)
        }

        this.applyEventsToSnapshot(reconstructed, events)

        const lastEventTime = events.length > 0 ? events[events.length - 1].timestamp : 0
        const updatedAt = Math.max(lastEventTime, Math.round(journalMtime))

        records.push({
          sessionId: rawSessionId,
          lifecycle: 'recovering',
          updatedAt,
          snapshot: reconstructed,
          eventCount: events.length,
        })
      }
    }

    return records.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  recover(sessionId: string): RecoveryRecord | null {
    this.flushSync(sessionId)
    const files = this.files(sessionId)
    const events = this.readEvents(sessionId)

    if (fs.existsSync(files.snapshot)) {
      try {
        const snapshotObj = JSON.parse(fs.readFileSync(files.snapshot, 'utf8')) as Record<string, unknown>
        const baseSnapshot = (snapshotObj.snapshot && typeof snapshotObj.snapshot === 'object'
          ? { ...(snapshotObj.snapshot as Record<string, unknown>) }
          : {}) as Record<string, unknown>

        const lastEventId = typeof snapshotObj.lastEventId === 'string' ? snapshotObj.lastEventId : undefined
        let newEvents = events
        if (lastEventId) {
          const idx = events.findIndex((e) => e.eventId === lastEventId)
          if (idx !== -1) newEvents = events.slice(idx + 1)
        }
        this.applyEventsToSnapshot(baseSnapshot, newEvents)

        return {
          sessionId,
          lifecycle: 'recovering',
          updatedAt: Number(snapshotObj.updatedAt) || Date.now(),
          snapshot: baseSnapshot,
          eventCount: events.length,
        }
      } catch (error) {
        console.error('[SessionRecovery] Failed to recover session from snapshot:', error)
      }
    }

    if (fs.existsSync(files.journal)) {
      if (events.length === 0) return null
      const metaEvent = events.find((e) => e.type === 'meeting:metadata')
      const reconstructed: Record<string, unknown> = {
        id: sessionId,
        title: (metaEvent?.payload?.title as string) || 'Cuộc họp chưa lưu',
        mode: (metaEvent?.payload?.mode as string) || 'interview',
        startedAt: Number(metaEvent?.payload?.startedAt) || events[0]?.timestamp || Date.now(),
        lifecycle: 'active',
        transcripts: [],
        suggestions: [],
        screenshotQuestions: [],
        usageRecords: [],
      }
      if (metaEvent?.payload) Object.assign(reconstructed, metaEvent.payload)
      this.applyEventsToSnapshot(reconstructed, events)

      return {
        sessionId,
        lifecycle: 'recovering',
        updatedAt: events[events.length - 1]?.timestamp || Date.now(),
        snapshot: reconstructed,
        eventCount: events.length,
      }
    }

    return null
  }

  /**
   * Reads journal events tolerating truncated trailing line,
   * skips corrupted middle lines (counting and logging count without logging content).
   */
  readEvents(sessionId: string): SessionEvent[] {
    const file = this.files(sessionId).journal
    if (!fs.existsSync(file)) return []

    let raw = ''
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      return []
    }

    const lines = raw.split(/\r?\n/)
    // Find index of last non-empty line
    let lastNonEmptyIndex = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) {
        lastNonEmptyIndex = i
        break
      }
    }

    const seen = new Set<string>()
    const events: SessionEvent[] = []
    let corruptedMiddleCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const event = JSON.parse(line) as SessionEvent
        if (!event || !event.eventId || !event.type) {
          if (i === lastNonEmptyIndex) {
            // Incomplete trailing line, safely skip
            continue
          }
          corruptedMiddleCount++
          continue
        }
        if (seen.has(event.eventId)) continue
        seen.add(event.eventId)
        events.push(event)
      } catch {
        if (i === lastNonEmptyIndex) {
          // Truncated last line from a crash, ignore
          continue
        }
        // Corrupted line in the middle: skip and continue, do NOT break
        corruptedMiddleCount++
      }
    }

    if (corruptedMiddleCount > 0) {
      console.warn(
        `[SessionRecovery] Skipped ${corruptedMiddleCount} corrupted journal lines in session ${safeId(sessionId)}`
      )
    }

    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Applies journal events into a snapshot aggregate idempotently.
   * Supports metadata, transcript:segment, transcript:patch (for late translations),
   * suggestion, visual:question, usage.
   */
  private applyEventsToSnapshot(base: Record<string, unknown>, events: SessionEvent[]): void {
    for (const event of events) {
      if (event.type === 'meeting:metadata') {
        Object.assign(base, event.payload)
      } else if (event.type === 'transcript:segment') {
        const transcripts = Array.isArray(base.transcripts) ? [...base.transcripts] : []
        const existingIdx = transcripts.findIndex((item) => (item as any)?.id === event.payload.id)
        if (existingIdx === -1) {
          transcripts.push(event.payload)
        } else {
          // Update if new info
          transcripts[existingIdx] = { ...(transcripts[existingIdx] as any), ...event.payload }
        }
        base.transcripts = transcripts
      } else if (event.type === 'transcript:patch') {
        // Late translations or edits applied by ID
        const transcripts = Array.isArray(base.transcripts) ? [...base.transcripts] : []
        const lineId = event.payload.id
        const existingIdx = transcripts.findIndex((item) => (item as any)?.id === lineId)
        if (existingIdx !== -1) {
          transcripts[existingIdx] = { ...(transcripts[existingIdx] as any), ...event.payload }
          base.transcripts = transcripts
        }
      } else if (event.type === 'suggestion' || event.type === 'visual:question' || event.type === 'usage') {
        const key =
          event.type === 'suggestion'
            ? 'suggestions'
            : event.type === 'visual:question'
            ? 'screenshotQuestions'
            : 'usageRecords'
        const items = Array.isArray(base[key]) ? [...base[key]] : []
        const existingIdx = items.findIndex((item) => (item as any)?.id === event.payload.id)
        if (existingIdx === -1) {
          items.push(event.payload)
        } else {
          items[existingIdx] = { ...(items[existingIdx] as any), ...event.payload }
        }
        base[key] = items
      }
    }
  }
}
