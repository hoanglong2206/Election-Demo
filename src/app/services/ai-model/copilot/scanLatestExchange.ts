import {
  assembleLatestExchange,
  takeLastSentence,
  stitchTwoChunks,
  isCandidateSpeaker,
  cleanAudioAnnotations,
} from './exchangeAssembler'
import type { AppMode } from '@/types/electron.d'

export { isCandidateSpeaker, takeLastSentence }
export { cleanAudioAnnotations as cleanAudioTags }

export interface ScannedExchangeResult {
  /** Nguyên văn transcript gốc (không dịch). */
  original: string
  speaker: string
  timestamp: string
  isQuestion: boolean
  isAiScanned?: boolean
  /** Số dòng transcript lúc quét — dùng để phát hiện kết quả đã cũ. */
  sourceLineCount?: number
  /** Toàn bộ lượt nói (giữ câu bối cảnh trước khi cắt last sentence) */
  fullTurnText?: string
  /** Câu hỏi được phát hiện trong lượt */
  questionSentence?: string
  /** Số dòng được ghép */
  mergedLineCount?: number
}

/**
 * Backward compatibility wrapper for stitchFragments.
 * Delegates to exchangeAssembler's overlap-aware stitcher.
 */
export function stitchFragments(fragments: string[]): string {
  if (!fragments || fragments.length === 0) return ''
  let result = ''
  for (const frag of fragments) {
    if (!frag.trim()) continue
    if (!result) {
      result = cleanAudioAnnotations(frag).trim()
    } else {
      result = stitchTwoChunks(result, frag)
    }
  }
  return result.trim()
}

/**
 * Fast, 0-latency deterministic extractor for the latest exchange in ORIGINAL language.
 * Unifies extraction using exchangeAssembler (0 tokens, < 5ms).
 */
export function extractHeuristicLatestExchange(
  lines: { speaker: string; original: string; translated?: string; timestamp?: string }[],
  mode: AppMode = 'interview'
): ScannedExchangeResult | null {
  if (!lines || lines.length === 0) return null

  const assembled = assembleLatestExchange(lines, mode)
  if (!assembled) return null

  return {
    original: assembled.original,
    speaker: assembled.speaker,
    timestamp: assembled.timestamp,
    isQuestion: assembled.isQuestion,
    isAiScanned: false,
    sourceLineCount: assembled.sourceLineCount,
    fullTurnText: assembled.fullTurnText,
    questionSentence: assembled.questionSentence,
    mergedLineCount: assembled.mergedLineCount,
  }
}

/** Hidden rollback flag (default: false) */
let legacyLlmScanRollbackEnabled = false

/**
 * Hidden configuration toggle for emergency rollback.
 * Defaults to false. Not used in normal operations.
 */
export function setLegacyLlmScanRollback(enabled: boolean): void {
  legacyLlmScanRollbackEnabled = enabled
}

export function isLegacyLlmScanRollbackEnabled(): boolean {
  return legacyLlmScanRollbackEnabled
}

/**
 * @deprecated Use `assembleLatestExchange` or `extractHeuristicLatestExchange` directly.
 *
 * LLM scan branch has been completely removed to achieve 0 token cost and sub-millisecond execution.
 * Retains signature for backward compatibility.
 */
export async function scanLatestExchangeWithAI(
  lines: { speaker: string; original: string; translated?: string; timestamp?: string }[],
  mode: AppMode = 'interview'
): Promise<ScannedExchangeResult | null> {
  // Deterministic 0-token assembly replacement
  return extractHeuristicLatestExchange(lines, mode)
}
