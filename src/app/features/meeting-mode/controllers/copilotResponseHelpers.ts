import type { HistorySuggestion } from '@/services/session-history'
import type { TranscriptLine } from '../types'
import {
  validateAnswerGrounding,
  validateAnswerGroundingAsync,
} from '@/services/ai-model/grounding'
import { sessionsPort } from '@/infrastructure/ipc'
import type { InterviewVariation, AISuggestion } from '../types'

export interface GroundingTaskParams {
  answerId: number
  content: string
  activeCV: string
  activeCvBg: string
  lines: TranscriptLine[]
  isMounted: () => boolean
  updateAnswer: (updater: (prev: InterviewVariation | null) => InterviewVariation | null) => void
}

/**
 * Executes Tier 1 (sync) and Tier 2 (async) grounding validation
 * and updates the custom interview answer state safely.
 */
export async function runGroundingValidation({
  answerId,
  content,
  activeCV,
  activeCvBg,
  lines,
  isMounted,
  updateAnswer,
}: GroundingTaskParams): Promise<void> {
  try {
    const groundingInput = {
      answer: content,
      cv: activeCV,
      profile: activeCV,
      transcript: lines.map((l) => `${l.speaker}: ${l.original}`).join('\n'),
      session: [activeCvBg].filter(Boolean).join('\n\n'),
      mode: 'balanced' as const,
    }

    const syncGrounding = validateAnswerGrounding(groundingInput)
    if (isMounted()) {
      updateAnswer((prev) =>
        prev && prev.id === answerId ? { ...prev, grounding: syncGrounding } : prev
      )
    }

    const asyncGrounding = await validateAnswerGroundingAsync(groundingInput)
    if (isMounted()) {
      updateAnswer((prev) =>
        prev && prev.id === answerId ? { ...prev, grounding: asyncGrounding } : prev
      )
    }
  } catch (gErr) {
    console.warn('[copilotResponseHelpers] Grounding error:', gErr)
  }
}

export interface JournalInterviewParams {
  sessionId: string
  answerId: number
  lines: TranscriptLine[]
  res: {
    label?: string
    content: string
    confidence?: number
    retrieval?: any
    routing?: any
    failover?: any
  }
  aiSuggestionsHistoryRef: React.MutableRefObject<HistorySuggestion[]>
}

/**
 * Journals an interview answer to the session recovery port and updates history ref.
 */
export function journalInterviewSuggestion({
  sessionId,
  answerId,
  lines,
  res,
  aiSuggestionsHistoryRef,
}: JournalInterviewParams): void {
  void sessionsPort.recovery.append({
    eventId: `suggestion:${sessionId}:${answerId}`,
    sessionId,
    type: 'suggestion',
    timestamp: Date.now(),
    payload: {
      id: answerId,
      type: 'answer',
      label: res.label,
      content: res.content,
      confidence: res.confidence,
      retrieval: res.retrieval,
      routing: res.routing,
      failover: res.failover,
    },
  })

  const lastLine = lines[lines.length - 1]
  aiSuggestionsHistoryRef.current.push({
    id: answerId,
    type: 'answer',
    label: res.label,
    content: res.content,
    confidence: res.confidence,
    retrieval: res.retrieval,
    routing: res.routing,
    failover: res.failover,
    timestamp: lastLine?.timestamp || '00:00',
    timestampMs: Date.now(),
    triggeredByTranscriptId: lastLine?.id,
  })
}

export interface JournalDiscussionParams {
  lines: TranscriptLine[]
  options: AISuggestion[]
  aiSuggestionsHistoryRef: React.MutableRefObject<HistorySuggestion[]>
}

/**
 * Appends discussion options to history ref.
 */
export function journalDiscussionSuggestions({
  lines,
  options,
  aiSuggestionsHistoryRef,
}: JournalDiscussionParams): void {
  const lastLine = lines[lines.length - 1]
  const nowMs = Date.now()
  for (const opt of options) {
    aiSuggestionsHistoryRef.current.push({
      id: opt.id || nowMs + Math.random(),
      type: opt.type || 'option',
      label: opt.label,
      content: opt.content,
      confidence: opt.confidence,
      timestamp: lastLine?.timestamp || '00:00',
      timestampMs: nowMs,
      triggeredByTranscriptId: lastLine?.id,
    })
  }
}
