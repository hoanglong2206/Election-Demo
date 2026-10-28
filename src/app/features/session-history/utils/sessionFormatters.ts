import type {
  HistoryScreenshotQuestion,
  HistorySuggestion,
  HistoryTranscriptLine,
  MeetingSession,
} from '@/services/sessionHistory'

/**
 * Parses timestamp string "MM:SS" or "HH:MM:SS" into numeric seconds for sorting.
 * Supports decimal sub-seconds (e.g. "00:04.25").
 */
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0
  const parts = ts.trim().split(':').map((p) => parseFloat(p))
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  }
  return 0
}

export interface TimelineItem {
  id: string | number
  sortSec: number
  timestamp: string
  kind: 'interviewer' | 'user' | 'ai_suggestion' | 'screenshot'
  transcript?: HistoryTranscriptLine
  suggestion?: HistorySuggestion
  screenshot?: HistoryScreenshotQuestion
}

/**
 * Constructs a unified chronological timeline combining transcripts,
 * AI suggestions, and screenshot questions sorted by timestamp.
 */
export function buildChronologicalTimeline(session: MeetingSession | null): TimelineItem[] {
  if (!session) return []
  const items: TimelineItem[] = []

  // 1. Transcripts
  for (const t of session.transcripts || []) {
    const isInterviewer =
      t.speaker === 'Interviewer' ||
      t.speaker === 'Team Lead' ||
      t.speaker === 'Cuộc họp' ||
      t.isQuestion
    const sortSec =
      typeof t.timestampMs === 'number'
        ? t.timestampMs / 1000
        : parseTimestampToSeconds(t.timestamp)
    items.push({
      id: `t_${t.id}`,
      sortSec,
      timestamp: t.timestamp || '00:00',
      kind: isInterviewer ? 'interviewer' : 'user',
      transcript: t,
    })
  }

  // 2. AI Suggestions (offset by +0.1s to place immediately after triggering utterance)
  for (const s of session.suggestions || []) {
    const ts = s.timestamp || '00:00'
    const sortSec =
      typeof s.timestampMs === 'number'
        ? s.timestampMs / 1000 + 0.1
        : parseTimestampToSeconds(ts) + 0.1
    items.push({
      id: `s_${s.id}`,
      sortSec,
      timestamp: ts,
      kind: 'ai_suggestion',
      suggestion: s,
    })
  }

  // 3. Screenshot Questions (offset by +0.05s)
  for (const sq of session.screenshotQuestions || []) {
    const sortSec =
      typeof sq.timestampMs === 'number'
        ? sq.timestampMs / 1000 + 0.05
        : parseTimestampToSeconds(sq.timestamp) + 0.05
    items.push({
      id: `sq_${sq.id}`,
      sortSec,
      timestamp: sq.timestamp || '00:00',
      kind: 'screenshot',
      screenshot: sq,
    })
  }

  // Sort chronologically ascending
  items.sort((a, b) => a.sortSec - b.sortSec)
  return items
}

/**
 * Sorts transcripts chronologically by timestampMs or parsed timestamp string.
 */
export function sortTranscriptsChronologically(
  transcripts: HistoryTranscriptLine[] | undefined
): HistoryTranscriptLine[] {
  if (!transcripts || transcripts.length === 0) return []
  return [...transcripts].sort((a, b) => {
    const secA =
      typeof a.timestampMs === 'number'
        ? a.timestampMs / 1000
        : parseTimestampToSeconds(a.timestamp)
    const secB =
      typeof b.timestampMs === 'number'
        ? b.timestampMs / 1000
        : parseTimestampToSeconds(b.timestamp)
    return secA - secB
  })
}

/**
 * Computes human-readable display string for token count (e.g. 15.2k).
 */
export function formatTokenCount(tokens: number | undefined): string | null {
  if (tokens === undefined || tokens <= 0) return null
  return `${(tokens / 1000).toFixed(1)}k`
}

/**
 * Formats cost display based on cost status and estimated cost in USD.
 */
export function formatCost(
  estimatedCostUsd: number | undefined,
  costStatus?: string
): { label: string; isFree: boolean; isUnknown: boolean } | null {
  if (costStatus === 'free') {
    return { label: 'Free', isFree: true, isUnknown: false }
  }
  if (costStatus === 'unknown') {
    return { label: 'Unknown', isFree: false, isUnknown: true }
  }
  if (estimatedCostUsd !== undefined && estimatedCostUsd > 0) {
    const formatted =
      estimatedCostUsd < 0.01
        ? estimatedCostUsd.toFixed(4)
        : estimatedCostUsd.toFixed(3)
    return { label: `$${formatted}`, isFree: false, isUnknown: false }
  }
  return null
}

