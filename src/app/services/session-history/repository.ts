import {
  getSessionEpoch,
  type ISessionRepository,
  type MeetingSession,
  type SessionFilterOptions,
} from './types'
import { SEED_SESSIONS } from './seeds'
import { IndexedDbSessionRepository } from './indexedDbRepository'

const STORAGE_KEY = 'meeting_copilot_session_history'
const BACKUP_STORAGE_KEY = 'meeting_copilot_session_backup'
const RETENTION_KEY = 'meeting_copilot_session_retention_days'
const LEGACY_MOCK_IDS = new Set(['session-01', 'session-02', 'session-03'])

let sessionsCache: MeetingSession[] | null = null
let isInitializing = false
let initPromise: Promise<MeetingSession[]> | null = null
let sessionMutationRevision = 0

type SessionsListener = (sessions: MeetingSession[]) => void
const listeners = new Set<SessionsListener>()

export function subscribeSessions(listener: SessionsListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners(): void {
  const current = sessionsCache || []
  listeners.forEach((listener) => {
    try {
      listener(current)
    } catch (err) {
      console.warn('[SessionHistory] Listener error:', err)
    }
  })
}

function isElectronIpcAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.api?.sessions
}


/**
 * Normalizes legacy, partial or corrupted session records into valid domain aggregates.
 */
export function normalizeSession(raw: any): MeetingSession {
  if (!raw || typeof raw !== 'object') {
    const fallbackId = `session_${Date.now()}`
    return {
      id: fallbackId,
      title: 'Buổi họp không tên',
      date: new Date().toLocaleString('vi-VN'),
      durationMinutes: 1,
      mode: 'interview',
      aiModel: 'Không xác định',
      audioSource: 'Default Microphone',
      contextApplied: false,
      transcripts: [],
      suggestions: [],
      screenshotQuestions: [],
      exportSchemaVersion: '2.0',
    }
  }

  const rawTranscripts = Array.isArray(raw.transcripts) ? raw.transcripts : []
  const rawSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : []
  const rawScreenshots = Array.isArray(raw.screenshotQuestions) ? raw.screenshotQuestions : []

  const transcripts = rawTranscripts.map((t: any, idx: number) => ({
    id: t.id ?? idx + 1,
    speaker: t.speaker || 'Speaker',
    timestamp: t.timestamp || '00:00',
    timestampMs: typeof t.timestampMs === 'number' ? t.timestampMs : undefined,
    original: String(t.original || ''),
    translated: String(t.translated || ''),
    isQuestion: Boolean(t.isQuestion),
  }))

  // Ensure strict chronological ordering even if STT arrived out-of-sequence
  transcripts.sort((a: (typeof transcripts)[number], b: (typeof transcripts)[number]) => {
    const getMs = (item: (typeof transcripts)[number]) => {
      if (typeof item.timestampMs === 'number') return item.timestampMs
      if (!item.timestamp) return 0
      const parts = String(item.timestamp).trim().split(':').map((p: string) => parseFloat(p) || 0)
      if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
      if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
      return (parseFloat(String(item.timestamp)) || 0) * 1000
    }
    return getMs(a) - getMs(b)
  })

  const suggestions = rawSuggestions.map((s: any, idx: number) => ({
    id: s.id ?? idx + 1,
    type: s.type === 'option' || s.type === 'analysis' ? s.type : 'answer',
    label: s.label,
    content: String(s.content || ''),
    confidence: typeof s.confidence === 'number' ? s.confidence : 95,
    timestamp: s.timestamp,
    timestampMs: typeof s.timestampMs === 'number' ? s.timestampMs : undefined,
    triggeredByTranscriptId: s.triggeredByTranscriptId,
    tokenUsage: s.tokenUsage
      ? {
          ...s.tokenUsage,
          // Older versions stored a heuristic estimate without a pricing source.
          costStatus:
            s.tokenUsage.costStatus ||
            (s.tokenUsage.estimatedCostUsd !== undefined ? 'unknown' : undefined),
        }
      : undefined,
  }))

  const screenshotQuestions = rawScreenshots.map((sq: any, idx: number) => ({
    id: String(sq.id || `sq_${idx}_${Date.now()}`),
    timestamp: sq.timestamp || '00:00',
    timestampMs: typeof sq.timestampMs === 'number' ? sq.timestampMs : undefined,
    imageMetadata: sq.imageMetadata,
    ocrText: sq.ocrText,
    contentType: sq.contentType,
    analysisResult: sq.analysisResult,
  }))

  const totalInteractions = transcripts.length + suggestions.length + screenshotQuestions.length
  const questionCount =
    transcripts.filter((t: any) => t.isQuestion).length + screenshotQuestions.length

  const metrics = raw.metrics
    ? {
        ...raw.metrics,
        // Legacy session estimates came from a fixed token-rate heuristic.
        costStatus:
          raw.metrics.costStatus ||
          (raw.metrics.estimatedCostUsd !== undefined ? 'unknown' : undefined),
      }
    : {
        totalInteractions,
        questionCount,
        aiResponseCount: suggestions.length,
        screenshotCount: screenshotQuestions.length,
        totalTokens: 0,
        estimatedCostUsd: undefined,
        costStatus: 'unknown' as const,
      }

  const fallbackStartedAt = getSessionEpoch(raw)

  return {
    id: String(raw.id || `session_${Date.now()}`),
    title: String(raw.title || 'Buổi họp không tên').trim(),
    profileId: raw.profileId,
    profileSnapshot: raw.profileSnapshot,
    companyName: raw.companyName || raw.profileSnapshot?.companyName,
    targetRole: raw.targetRole || raw.profileSnapshot?.role,
    startedAt: typeof raw.startedAt === 'number' && raw.startedAt > 0 ? raw.startedAt : fallbackStartedAt || undefined,
    endedAt: typeof raw.endedAt === 'number' && raw.endedAt > 0 ? raw.endedAt : undefined,
    date: raw.date || new Date().toLocaleString('vi-VN'),
    durationMinutes: Math.max(1, Number(raw.durationMinutes) || 1),
    durationSeconds: Number(raw.durationSeconds) || (Math.max(1, Number(raw.durationMinutes) || 1) * 60),
    mode: raw.mode === 'discussion' ? 'discussion' : 'interview',
    aiModel: raw.aiModel || 'Không xác định',
    audioSource: raw.audioSource || 'Default Microphone',
    contextApplied: Boolean(raw.contextApplied),
    candidateName: raw.candidateName,
    transcripts,
    suggestions,
    screenshotQuestions,
    metrics,
    exportSchemaVersion: raw.exportSchemaVersion || '2.0',
  }
}

/**
 * Cleans up temporary artifacts/files associated with deleted sessions.
 */
function cleanupSessionArtifacts(sessionId: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    const keysToRemove: string[] = []
    const artifactStoragePrefix = `artifact_session_${sessionId}`
    const screenshotPrefix = `screenshot_${sessionId}_`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(artifactStoragePrefix) || key.startsWith(screenshotPrefix))) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch (err) {
    console.warn(`[SessionStorage] Failed to cleanup artifacts for session ${sessionId}:`, err)
  }
}

function saveToLocalStorageBackup(sessions: MeetingSession[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    const backupList = sessions.slice(0, 50)
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backupList))
  } catch {
    // Ignore quota issues
  }
}

export function getSavedRetentionDays(): number {
  if (typeof localStorage === 'undefined') return 0
  try {
    const raw = localStorage.getItem(RETENTION_KEY)
    return raw ? parseInt(raw, 10) || 0 : 0
  } catch {
    return 0
  }
}

export function saveRetentionDays(days: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RETENTION_KEY, String(days))
  } catch (err) {
    console.warn('[SessionStorage] Failed to save retention days:', err)
  }
}

export class HybridSessionRepository implements ISessionRepository {
  private indexedDbRepo = new IndexedDbSessionRepository()

  public async init(): Promise<MeetingSession[]> {
    if (initPromise) return initPromise
    const initRevision = sessionMutationRevision

    initPromise = (async () => {
      try {
        let loaded: MeetingSession[] = []

        if (isElectronIpcAvailable()) {
          // 1. Try loading from Electron IPC (userData/sessions/*.json)
          const electronSessions = await window.api.sessions!.getAll()
          if (Array.isArray(electronSessions) && electronSessions.length > 0) {
            loaded = electronSessions.map(normalizeSession)
          }
        } else {
          // 2. Try loading from IndexedDB
          const idbSessions = await this.indexedDbRepo.getAll()
          if (Array.isArray(idbSessions) && idbSessions.length > 0) {
            loaded = idbSessions.map(normalizeSession)
          }
        }

        // 3. Migrate from legacy localStorage if present
        try {
          const raw = initRevision === sessionMutationRevision && typeof localStorage !== 'undefined'
            ? localStorage.getItem(STORAGE_KEY)
            : null
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              const cleaned = parsed.filter((s) => s && s.id && !LEGACY_MOCK_IDS.has(s.id))
              const existingIds = new Set(loaded.map((s) => s.id))
              const toMigrate = cleaned.filter((s) => !existingIds.has(s.id)).map(normalizeSession)

              if (toMigrate.length > 0) {
                console.log(
                  `[SessionStorage] Migrating ${toMigrate.length} sessions from localStorage to persistent storage...`
                )
                for (const session of toMigrate) {
                  loaded.push(session)
                  if (isElectronIpcAvailable()) {
                    window.api.sessions!.save(session).catch(console.error)
                  } else {
                    this.indexedDbRepo.save(session).catch(console.error)
                  }
                }
              }
              // Clear legacy localStorage to avoid 5MB quota errors
              localStorage.removeItem(STORAGE_KEY)
              console.log('[SessionStorage] Successfully cleared legacy localStorage session key.')
            }
          }
        } catch (migErr) {
          console.warn('[SessionStorage] Error during localStorage migration:', migErr)
        }

        // 4. Try loading from web backup storage if still empty
        if (loaded.length === 0 && initRevision === sessionMutationRevision) {
          try {
            const rawBackup = typeof localStorage !== 'undefined' ? localStorage.getItem(BACKUP_STORAGE_KEY) : null
            if (rawBackup) {
              const parsed = JSON.parse(rawBackup)
              if (Array.isArray(parsed) && parsed.length > 0) {
                loaded = parsed.filter((s) => s && s.id && !LEGACY_MOCK_IDS.has(s.id)).map(normalizeSession)
              }
            }
          } catch {
            // Ignore
          }
        }

        // 5. Fallback to seed sessions if completely empty
        if (loaded.length === 0 && (!sessionsCache || sessionsCache.length === 0) && initRevision === sessionMutationRevision) {
          loaded = SEED_SESSIONS.map(normalizeSession)
        }

        // A delete/save can happen while Electron or IndexedDB is still loading.
        // Preserve the newer in-memory list instead of restoring the stale snapshot.
        if (initRevision !== sessionMutationRevision && sessionsCache) {
          loaded = [...sessionsCache]
        }

        // Always sort newest-first
        loaded.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
        sessionsCache = loaded

        // 6. Apply retention policy if enabled (> 0 days)
        const retentionDays = getSavedRetentionDays()
        if (retentionDays > 0) {
          this.applyRetentionPolicy(retentionDays)
        }

        saveToLocalStorageBackup(sessionsCache)
        notifyListeners()
        return sessionsCache
      } catch (err) {
        console.error('[SessionStorage] Initialization failed:', err)
        sessionsCache = sessionsCache || SEED_SESSIONS.map(normalizeSession)
        return sessionsCache
      }
    })()

    return initPromise
  }

  public getAll(): MeetingSession[] {
    if (sessionsCache) {
      return sessionsCache
    }

    // Trigger async init in background if not yet initialized
    if (!isInitializing) {
      isInitializing = true
      this.init().finally(() => {
        isInitializing = false
      })
    }

    // Temporary fallback while async init completes
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BACKUP_STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          sessionsCache = parsed.filter((s) => s && !LEGACY_MOCK_IDS.has(s.id)).map(normalizeSession)
          sessionsCache.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
          return sessionsCache
        }
      }
    } catch {
      // Ignore
    }

    sessionsCache = SEED_SESSIONS.map(normalizeSession)
    return sessionsCache
  }

  public getById(id: string): MeetingSession | null {
    const list = this.getAll()
    return list.find((s) => s.id === id) || null
  }

  public save(session: MeetingSession): void {
    const normalized = normalizeSession(session)
    const current = this.getAll()
    sessionMutationRevision++
    const filtered = current.filter((s) => s.id !== normalized.id)
    const updated = [normalized, ...filtered]
    updated.sort((a, b) => getSessionEpoch(b) - getSessionEpoch(a))
    sessionsCache = updated
    saveToLocalStorageBackup(updated)
    notifyListeners()

    // Persist asynchronously
    if (isElectronIpcAvailable()) {
      window.api.sessions!.save(normalized).catch((err) => {
        console.error('[SessionStorage] Electron save error:', err)
      })
    } else {
      this.indexedDbRepo.save(normalized).catch((err) => {
        console.error('[SessionStorage] IndexedDB save error:', err)
      })
    }
  }

  public delete(sessionId: string): MeetingSession[] {
    const current = this.getAll()
    sessionMutationRevision++
    const updated = current.filter((s) => s.id !== sessionId)
    sessionsCache = updated
    saveToLocalStorageBackup(updated)
    notifyListeners()

    cleanupSessionArtifacts(sessionId)

    // Persist asynchronously
    if (isElectronIpcAvailable()) {
      window.api.sessions!.delete(sessionId).catch((err) => {
        console.error('[SessionStorage] Electron delete error:', err)
      })
    } else {
      this.indexedDbRepo.delete(sessionId).catch((err) => {
        console.error('[SessionStorage] IndexedDB delete error:', err)
      })
    }

    return updated
  }

  public deleteMany(sessionIds: string[]): MeetingSession[] {
    const toDelete = new Set(sessionIds)
    const current = this.getAll()
    sessionMutationRevision++
    const updated = current.filter((s) => !toDelete.has(s.id))
    sessionsCache = updated
    saveToLocalStorageBackup(updated)
    notifyListeners()

    for (const id of sessionIds) {
      cleanupSessionArtifacts(id)
    }

    // Persist asynchronously
    if (isElectronIpcAvailable()) {
      window.api.sessions!.deleteMany(sessionIds).catch((err) => {
        console.error('[SessionStorage] Electron deleteMany error:', err)
      })
    } else {
      this.indexedDbRepo.deleteMany(sessionIds).catch((err) => {
        console.error('[SessionStorage] IndexedDB deleteMany error:', err)
      })
    }

    return updated
  }

  public deleteAll(): MeetingSession[] {
    const current = this.getAll()
    sessionMutationRevision++
    for (const s of current) {
      cleanupSessionArtifacts(s.id)
    }

    sessionsCache = []
    saveToLocalStorageBackup([])
    notifyListeners()

    // Persist asynchronously
    if (isElectronIpcAvailable()) {
      window.api.sessions!.deleteAll().catch((err) => {
        console.error('[SessionStorage] Electron deleteAll error:', err)
      })
    } else {
      this.indexedDbRepo.deleteAll().catch((err) => {
        console.error('[SessionStorage] IndexedDB deleteAll error:', err)
      })
    }

    return []
  }

  public rename(sessionId: string, newTitle: string): MeetingSession[] {
    const trimmed = newTitle.trim()
    if (!trimmed) return this.getAll()

    const current = this.getAll()
    sessionMutationRevision++
    const updated = current.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
    sessionsCache = updated
    saveToLocalStorageBackup(updated)
    notifyListeners()

    // Persist asynchronously
    if (isElectronIpcAvailable()) {
      window.api.sessions!.rename(sessionId, trimmed).catch((err) => {
        console.error('[SessionStorage] Electron rename error:', err)
      })
    } else {
      this.indexedDbRepo.rename(sessionId, trimmed).catch((err) => {
        console.error('[SessionStorage] IndexedDB rename error:', err)
      })
    }

    return updated
  }

  /**
   * Performs high-speed multi-attribute filtering & full-text search across transcripts,
   * suggestions, screenshot questions, profile names, company and roles.
   */
  public searchAndFilter(options: SessionFilterOptions): MeetingSession[] {
    const all = this.getAll()
    const query = (options.searchTerm || '').trim().toLowerCase()
    const mode = options.mode || 'all'
    const profileId = options.profileId
    const dateRange = options.dateRange || 'all'
    const companyOrRole = (options.companyOrRole || '').trim().toLowerCase()

    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000

    return all.filter((s) => {
      // 1. Mode check
      if (mode !== 'all' && s.mode !== mode) return false

      // 2. Profile check
      if (profileId && profileId !== 'all') {
        const matchesProfile =
          s.profileId === profileId ||
          s.profileSnapshot?.presetId === profileId ||
          s.profileSnapshot?.name?.toLowerCase().includes(profileId.toLowerCase())
        if (!matchesProfile) return false
      }

      // 3. Company or Role check
      if (companyOrRole) {
        const matchesCompany =
          (s.companyName && s.companyName.toLowerCase().includes(companyOrRole)) ||
          (s.profileSnapshot?.companyName && s.profileSnapshot.companyName.toLowerCase().includes(companyOrRole))
        const matchesRole =
          (s.targetRole && s.targetRole.toLowerCase().includes(companyOrRole)) ||
          (s.profileSnapshot?.role && s.profileSnapshot.role.toLowerCase().includes(companyOrRole)) ||
          (s.candidateName && s.candidateName.toLowerCase().includes(companyOrRole))
        if (!matchesCompany && !matchesRole) return false
      }

      // 4. Date range filter
      if (dateRange !== 'all') {
        const epoch = getSessionEpoch(s)
        if (epoch <= 0) return false // Reject sessions with unparseable epoch when an explicit date filter is selected

        const ageMs = now - epoch
        if (ageMs < 0) {
          // Future or clock skew: if same calendar day, allow in 'today'
          if (dateRange === 'today') {
            const dSession = new Date(epoch)
            const dNow = new Date(now)
            if (
              dSession.getFullYear() !== dNow.getFullYear() ||
              dSession.getMonth() !== dNow.getMonth() ||
              dSession.getDate() !== dNow.getDate()
            ) {
              return false
            }
          }
        } else {
          if (dateRange === 'today' && ageMs > oneDayMs) return false
          if (dateRange === 'last_7_days' && ageMs > 7 * oneDayMs) return false
          if (dateRange === 'last_30_days' && ageMs > 30 * oneDayMs) return false
        }
      }

      // 5. Full-text search
      if (query) {
        const matchTitle = s.title.toLowerCase().includes(query)
        const matchModel = s.aiModel.toLowerCase().includes(query)
        const matchProfile =
          s.profileSnapshot?.name?.toLowerCase().includes(query) ||
          s.profileSnapshot?.role?.toLowerCase().includes(query) ||
          s.profileSnapshot?.companyName?.toLowerCase().includes(query) ||
          (s.profileSnapshot?.keywords && s.profileSnapshot.keywords.some((k) => k.toLowerCase().includes(query)))
        const matchCompanyRole =
          (s.companyName && s.companyName.toLowerCase().includes(query)) ||
          (s.targetRole && s.targetRole.toLowerCase().includes(query)) ||
          (s.candidateName && s.candidateName.toLowerCase().includes(query))
        const matchTranscripts = (s.transcripts || []).some(
          (t) => (t.original && t.original.toLowerCase().includes(query)) || (t.translated && t.translated.toLowerCase().includes(query))
        )
        const matchSuggestions = (s.suggestions || []).some((sg) => sg.content && sg.content.toLowerCase().includes(query))
        const matchScreenshots =
          (s.screenshotQuestions || []).some(
            (sq) =>
              (sq.ocrText && sq.ocrText.toLowerCase().includes(query)) ||
              (sq.analysisResult?.questionSummary && sq.analysisResult.questionSummary.toLowerCase().includes(query)) ||
              (sq.analysisResult?.suggestedAnswer && sq.analysisResult.suggestedAnswer.toLowerCase().includes(query))
          )

        if (
          !matchTitle &&
          !matchModel &&
          !matchProfile &&
          !matchCompanyRole &&
          !matchTranscripts &&
          !matchSuggestions &&
          !matchScreenshots
        ) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Enforces local storage retention limits: auto-prunes sessions older than N days.
   */
  public applyRetentionPolicy(days: number): { deletedCount: number; remainingSessions: MeetingSession[] } {
    if (days <= 0) {
      return { deletedCount: 0, remainingSessions: this.getAll() }
    }

    const now = Date.now()
    const maxAgeMs = days * 24 * 60 * 60 * 1000
    const all = this.getAll()

    const toDeleteIds: string[] = []
    const remaining: MeetingSession[] = []

    for (const session of all) {
      const epoch = getSessionEpoch(session)
      if (epoch > 0 && now - epoch > maxAgeMs) {
        toDeleteIds.push(session.id)
      } else {
        remaining.push(session)
      }
    }

    if (toDeleteIds.length > 0) {
      console.log(
        `[SessionStorage] Retention policy (${days} days) pruned ${toDeleteIds.length} expired sessions.`
      )
      this.deleteMany(toDeleteIds)
    }

    return { deletedCount: toDeleteIds.length, remainingSessions: remaining }
  }
}

export const defaultSessionRepository = new HybridSessionRepository()

export function initSessionStorage(): Promise<MeetingSession[]> {
  return defaultSessionRepository.init()
}

export function getSavedSessions(): MeetingSession[] {
  return defaultSessionRepository.getAll()
}

export function getSessionById(id: string): MeetingSession | null {
  return defaultSessionRepository.getById(id)
}

export function saveSessionToHistory(session: MeetingSession): void {
  defaultSessionRepository.save(session)
}

export function deleteSessionFromHistory(sessionId: string): MeetingSession[] {
  return defaultSessionRepository.delete(sessionId)
}

export function deleteMultipleSessionsFromHistory(sessionIds: string[]): MeetingSession[] {
  return defaultSessionRepository.deleteMany(sessionIds)
}

export function clearAllSessionsFromHistory(): MeetingSession[] {
  return defaultSessionRepository.deleteAll()
}

export function renameSessionInHistory(sessionId: string, newTitle: string): MeetingSession[] {
  return defaultSessionRepository.rename(sessionId, newTitle)
}

export function searchAndFilterSessions(options: SessionFilterOptions): MeetingSession[] {
  return defaultSessionRepository.searchAndFilter(options)
}

export function applySessionRetention(days: number) {
  return defaultSessionRepository.applyRetentionPolicy(days)
}
