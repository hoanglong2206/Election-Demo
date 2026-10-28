import type { IntentDetectionResult, QuestionDetectorConfig } from './types'
import { assembleLatestExchange } from '../copilot/exchangeAssembler'
import { cleanUtterance } from './patterns/smallTalk'
import { detectIntent } from './detector'

export const lastIntentByKey = new Map<string, string>()

/**
 * Analyzes recent transcript lines, automatically stitches fragmented split chunks
 * (e.g. Whisper chunk 1: "Can you explain..." + chunk 2: "...how Redis handles expiration?"),
 * and returns the coherent IntentDetectionResult.
 */
export function detectIntentFromRecentLines(
  lines: { id?: number; speaker: string; original: string; translated?: string; timestamp?: string; continuation?: boolean; sequenceId?: number }[],
  config?: QuestionDetectorConfig
): IntentDetectionResult | null {
  if (!lines || lines.length === 0) return null

  const mode = config?.mode || 'interview'
  const triggerMode = config?.triggerMode || 'auto'
  const threshold = config?.confidenceThreshold ?? 0.65
  const maxLookback = config?.maxLookbackLines ?? 6

  // 1. Assemble exchange using unified deterministic assembler
  const assembled = assembleLatestExchange(lines, mode, {
    maxLookbackLines: maxLookback,
  })

  if (!assembled) return null

  const mergedText = assembled.original
  const targetSpeaker = assembled.speaker
  const isSplit = assembled.mergedLineCount > 1

  // 2. Classify merged sentence
  const detection = detectIntent(mergedText, {
    speaker: targetSpeaker,
    mode,
    triggerMode,
    confidenceThreshold: threshold,
  })

  const lastLine = lines[lines.length - 1]
  const dedupeKey = config?.dedupeKey || `${mode}:${targetSpeaker}`
  const signature = `${lastLine?.id ?? assembled.timestamp ?? lines.length}:${cleanUtterance(mergedText)}`
  if (lastIntentByKey.get(dedupeKey) === signature) {
    return {
      ...detection,
      shouldTriggerCopilot: false,
      triggerDecisionReason: 'Skipped: duplicate STT chunks belong to the same utterance',
      triggerReason: 'Skipped: duplicate STT chunks belong to the same utterance',
    }
  }
  lastIntentByKey.set(dedupeKey, signature)

  return {
    ...detection,
    isSplitFragment: isSplit,
    mergedLineCount: assembled.mergedLineCount,
    timestamp: assembled.timestamp,
  }
}

/**
 * 100% backward compatible boolean checker.
 */
export function isQuestionUtterance(text: string): boolean {
  if (!text) return false
  const res = detectIntent(text)
  return res.intent === 'QUESTION' || res.isQuestion
}
