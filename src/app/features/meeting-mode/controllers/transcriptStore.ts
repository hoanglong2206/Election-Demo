import type { TranscriptLine } from '../types'
import {
  stitchFragments,
  endsWithSentencePunctuation,
} from '@/services/ai-model/copilot/exchangeAssembler'
import { detectLanguage } from '@/services/ai-model/translation'
import { speechSegmentationTelemetry } from '@/core/audio'

export interface CommitSegmentPayload {
  result: {
    success: boolean
    text: string
    translatedVi?: string
  }
  speakerLabel?: string
  timestampStr?: string
  continuation?: boolean
  endOfSpeechTimestampMs?: number
}

export interface CommitResult {
  targetLineId: number
  textToTranslate: string
  isNew: boolean
}

/**
 * Strips 2-5 word overlaps from the beginning of nextText if it repeats the end of prevText.
 */
function stripLeadingOverlap(prevText: string, nextText: string): string {
  const prevClean = prevText.trim()
  const nextClean = nextText.trim()
  if (!prevClean || !nextClean) return nextClean

  const prevWords = prevClean.split(/\s+/)
  const nextWords = nextClean.split(/\s+/)
  const maxWindow = Math.min(prevWords.length, nextWords.length, 5)

  for (let k = maxWindow; k >= 2; k--) {
    const prevSlice = prevWords
      .slice(-k)
      .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))
      .join(' ')
    const nextSlice = nextWords
      .slice(0, k)
      .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))
      .join(' ')

    if (prevSlice && prevSlice === nextSlice) {
      return nextWords.slice(k).join(' ').trim()
    }
  }
  return nextClean
}

export class TranscriptStore {
  private lines: TranscriptLine[] = []
  private validLinesSnapshot: TranscriptLine[] = []
  private listeners = new Set<() => void>()

  constructor(initialLines: TranscriptLine[] = []) {
    this.lines = [...initialLines]
    this.recomputeValidLines()
  }

  private recomputeValidLines(): void {
    this.validLinesSnapshot = this.lines.filter((l): l is TranscriptLine => l != null)
  }

  private notify(): void {
    this.recomputeValidLines()
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('[TranscriptStore] Listener error:', err)
      }
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getSnapshot = (): TranscriptLine[] => {
    return this.lines
  }

  public getValidLines = (): TranscriptLine[] => {
    return this.validLinesSnapshot
  }

  public getLatestLine = (): TranscriptLine | null => {
    return this.validLinesSnapshot.length > 0
      ? this.validLinesSnapshot[this.validLinesSnapshot.length - 1]
      : null
  }

  public commitSegment(commit: CommitSegmentPayload): CommitResult | null {
    const { result, speakerLabel, timestampStr, continuation, endOfSpeechTimestampMs } = commit

    if (!result.success || !result.text || !result.text.trim()) {
      return null
    }

    if (endOfSpeechTimestampMs) {
      speechSegmentationTelemetry.recordCommitLatency(endOfSpeechTimestampMs)
    }

    const needsViTranslation = detectLanguage(result.text.trim()).shouldTranslateToVi
    const newLine: TranscriptLine = {
      id: Date.now() + Math.random(),
      timestamp: timestampStr || '00:00',
      original: result.text.trim(),
      translated: result.translatedVi || (needsViTranslation ? '' : result.text.trim()),
      speaker: speakerLabel || 'Speaker',
    }

    if (this.lines.length === 0) {
      this.lines = [newLine]
      this.notify()
      return {
        targetLineId: newLine.id,
        textToTranslate: newLine.original,
        isNew: true,
      }
    }

    const lastLine = this.lines[this.lines.length - 1]

    // 1. Continuation stitching (split at energy valley mid-sentence)
    // Only stitch onto previous bubble if the previous bubble did NOT complete a sentence
    // AND has not grown beyond a readable card threshold (<= 130 chars).
    const lastCompletedSentence = endsWithSentencePunctuation(lastLine.original)
    const lastTooLong = lastLine.original.trim().length >= 130

    if (
      continuation &&
      lastLine.speaker === newLine.speaker &&
      !lastCompletedSentence &&
      !lastTooLong
    ) {
      const combinedOriginal = stitchFragments([lastLine.original, newLine.original])
      const combinedTranslated =
        lastLine.translated && newLine.translated
          ? stitchFragments([lastLine.translated, newLine.translated])
          : (lastLine.translated || newLine.translated || '')
      const updatedLine: TranscriptLine = {
        ...lastLine,
        original: combinedOriginal,
        translated: combinedTranslated,
      }

      this.lines = [...this.lines.slice(0, -1), updatedLine]
      this.notify()
      return {
        targetLineId: lastLine.id,
        textToTranslate: combinedOriginal,
        isNew: false,
      }
    }

    // If starting a new line from the same speaker, clean any duplicate boundary overlap
    if (lastLine.speaker === newLine.speaker) {
      const cleanOriginal = stripLeadingOverlap(lastLine.original, newLine.original)
      if (cleanOriginal) {
        newLine.original = cleanOriginal
        if (newLine.translated && !needsViTranslation) {
          newLine.translated = cleanOriginal
        }
      }
    }

    // 2. Exact duplicate suppression
    if (lastLine.original.trim().toLowerCase() === newLine.original.trim().toLowerCase()) {
      return null
    }

    // 3. New segment append
    this.lines = [...this.lines, newLine]
    this.notify()
    return {
      targetLineId: newLine.id,
      textToTranslate: newLine.original,
      isNew: true,
    }
  }

  public patchTranslation(lineId: number, translated: string): boolean {
    if (!translated) return false

    let modified = false
    this.lines = this.lines.map((line) => {
      if (line.id === lineId && line.translated !== translated) {
        modified = true
        return { ...line, translated }
      }
      return line
    })

    if (modified) {
      this.notify()
    }
    return modified
  }

  public setLines(lines: TranscriptLine[]): void {
    this.lines = [...lines]
    this.notify()
  }

  public clear(): void {
    this.lines = []
    this.notify()
  }
}

export const transcriptStore = new TranscriptStore()
