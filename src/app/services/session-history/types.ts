import type { ProfilePresetSnapshot } from '../profile-preset/types'
import type {
  GroundingResult,
  RetrievalCitation,
  RetrievalDiagnostics,
} from '../ai-model/copilot'
import type { RoutingDecision } from '../ai-model/model-router'

export interface HistoryTranscriptLine {
  id: number | string
  speaker: string
  timestamp: string // "MM:SS" or "HH:MM:SS"
  timestampMs?: number
  original: string
  translated: string
  isQuestion?: boolean
}

export interface HistorySuggestionTokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  estimatedCostUsd?: number
  costStatus?: 'calculated' | 'unknown' | 'free'
}

export interface HistorySuggestion {
  id: number | string
  type: 'answer' | 'option' | 'analysis'
  label?: string
  content: string
  confidence?: number
  timestamp?: string
  timestampMs?: number
  triggeredByTranscriptId?: number | string
  tokenUsage?: HistorySuggestionTokenUsage
  grounding?: GroundingResult
  retrieval?: {
    citations: RetrievalCitation[]
    diagnostics: RetrievalDiagnostics
  }
  routing?: RoutingDecision
  failover?: {
    switched: boolean
    fromProvider?: string
    toProvider?: string
    reason?: string
  }
}

export interface HistoryScreenshotQuestion {
  id: string
  timestamp: string
  timestampMs?: number
  imageMetadata?: {
    width?: number
    height?: number
    fileName?: string
    sizeBytes?: number
    file?: string
    thumbnailFile?: string
    bytes?: number
    hash?: string
  }
  imageUrl?: string
  thumbnailUrl?: string
  ocrText?: string
  contentType?: string
  analysisResult?: {
    questionSummary: string
    questionType?: string
    suggestedAnswer: string
    keyPoints?: string[]
    codeSnippet?: string
  }
}

export interface SessionMetrics {
  totalInteractions: number
  questionCount: number
  aiResponseCount: number
  screenshotCount: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  audioDurationSeconds?: number
  estimatedCostUsd?: number
  costStatus?: 'free' | 'calculated' | 'unknown'
}

/**
 * Core Domain Aggregate: MeetingSession
 * Represents the complete persistent record of an interview or meeting session.
 */
export interface MeetingSession {
  id: string
  title: string
  profileId?: string
  profileSnapshot?: ProfilePresetSnapshot
  companyName?: string
  targetRole?: string
  startedAt?: number // epoch ms
  endedAt?: number // epoch ms
  date: string // human readable string e.g. "19/10/2026, 14:30"
  durationMinutes: number
  durationSeconds?: number
  mode: 'interview' | 'discussion'
  aiModel: string
  audioSource: string
  contextApplied: boolean
  candidateName?: string
  transcripts: HistoryTranscriptLine[]
  suggestions: HistorySuggestion[]
  screenshotQuestions?: HistoryScreenshotQuestion[]
  screenshotSummaries?: Array<{
    id: string
    file: string
    thumbnailFile: string
    width?: number
    height?: number
    summary?: string
  }>
  searchSnippet?: string
  metrics?: SessionMetrics
  exportSchemaVersion?: string // e.g. "2.0"
  _isFullyLoaded?: boolean
  isSample?: boolean
}

export type SessionDateFilter = 'all' | 'today' | 'last_7_days' | 'last_30_days'

export interface SessionFilterOptions {
  searchTerm?: string
  mode?: 'all' | 'interview' | 'discussion'
  profileId?: string
  dateRange?: SessionDateFilter
  companyOrRole?: string
}

export interface ISessionRepository {
  getAll(): MeetingSession[]
  getById(id: string): MeetingSession | null
  loadFullSession?(id: string): Promise<MeetingSession | null>
  save(session: MeetingSession): void
  delete(sessionId: string): MeetingSession[]
  deleteMany(sessionIds: string[]): MeetingSession[]
  deleteAll(): MeetingSession[]
  rename(sessionId: string, newTitle: string): MeetingSession[]
  searchAndFilter(options: SessionFilterOptions): MeetingSession[]
  applyRetentionPolicy(days: number): { deletedCount: number; remainingSessions: MeetingSession[] }
}

/**
 * Parses approximate epoch timestamp of session creation across various formats:
 * - startedAt (epoch ms)
 * - endedAt (epoch ms)
 * - id timestamp: session_(\d+), session-live-(\d+), audiotest_(\d+)
 * - date string: Vietnamese "DD/MM/YYYY, HH:mm[:ss]" or ISO 8601
 */
export function getSessionEpoch(session: {
  startedAt?: number
  endedAt?: number
  id?: string
  date?: string
}): number {
  if (!session) return 0
  if (typeof session.startedAt === 'number' && session.startedAt > 0) {
    return session.startedAt
  }
  if (typeof session.endedAt === 'number' && session.endedAt > 0) {
    return session.endedAt
  }
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
    // 1. Try Vietnamese locale format: "DD/MM/YYYY, HH:mm[:ss]"
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
    // 2. Try standard ISO / Date.parse format
    const dateParsed = Date.parse(session.date)
    if (!isNaN(dateParsed) && dateParsed > 0) {
      return dateParsed
    }
  }
  return 0
}
