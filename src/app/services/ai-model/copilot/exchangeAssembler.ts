/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXCHANGE ASSEMBLER (Deterministic, 0-token, < 5ms speech turn stitcher)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure TypeScript module without any LLM dependencies.
 *
 * Replaces LLM-based transcript scanning by deterministically assembling
 * fragmented real-time STT chunks, resolving boundary overlaps (e.g. from
 * Whisper audio window overlaps), handling abbreviations, decimals ("Node.js",
 * "3.14"), audio tags, and extracting both the latest question sentence and the
 * full multi-sentence turn.
 */
import type { AppMode } from '@/types/electron.d'

export interface AssemblerLine {
  id?: number
  speaker: string
  original: string
  translated?: string
  timestamp?: string
  continuation?: boolean
  sequenceId?: number
}

export interface AssemblerOptions {
  mode?: AppMode
  maxLookbackLines?: number
  maxTimeGapSeconds?: number
}

export interface AssembledExchange {
  /** Latest sentence (for UI display in "Trao đổi gần nhất") */
  original: string
  /** Full multi-sentence speech turn (for LLM context grounding) */
  fullTurnText: string
  /** The question sentence in the turn if detected, otherwise fallback to `original` */
  questionSentence: string
  /** Number of fragmented lines merged into this exchange */
  mergedLineCount: number
  /** Whether the exchange contains a question */
  isQuestion: boolean
  /** Speaker label */
  speaker: string
  /** Timestamp of the latest line */
  timestamp: string
  /** Source line count at assembly time (for stale-check detection) */
  sourceLineCount: number
  /** Whether STT continuation metadata was used for stitching */
  continuationStitched: boolean
}

/**
 * Common parenthetical/bracketed audio annotations from STT engines like Whisper
 */
export const AUDIO_TAGS_REGEX =
  /\((?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing|blank_audio)\)|\[(?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing|blank_audio)\]/gi

/**
 * Common abbreviations ending with a period that should NOT trigger a sentence split.
 */
export const ABBREVIATION_END_REGEX =
  /(?:^|\s)(?:Prof|Mr|Mrs|Ms|Dr|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|approx|No|Vol|Fig|dept|univ|e\.g|i\.e|al)\.$/i

/**
 * Valid naturally repeated words in English & Vietnamese that MUST NOT be pruned.
 * (e.g. "I think that that is true", "nó rất rất nhanh", "had had", "nhiều nhiều")
 */
const VALID_REPETITIONS = new Set([
  'that',
  'had',
  'do',
  'so',
  'rất',
  'nhiều',
  'quá',
  'có',
  'là',
  'đi',
  'lại',
  'nhanh',
  'chậm',
  'càng',
  'nhỏ',
  'to',
  'lớn',
])

/**
 * Strip parenthetical/bracketed audio tags and collapse whitespace.
 */
export function cleanAudioAnnotations(text: string): string {
  if (!text) return ''
  return text.replace(AUDIO_TAGS_REGEX, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Fast Levenshtein distance between two short words.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const row = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) {
    row[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    let prevDiag = row[0]
    row[0] = i
    const charA = a.charCodeAt(i - 1)
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prevDiag + cost)
      prevDiag = temp
    }
  }

  return row[b.length]
}

/**
 * Normalizes a word for overlap comparison (strip punctuation, lowercase).
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+/g, '')
    .replace(/[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+$/g, '')
}

/**
 * Compare two words with tolerance:
 * - If length >= 5: Levenshtein distance <= 1 is considered a match
 * - Otherwise: exact string equality required
 */
export function wordsMatch(w1: string, w2: string): boolean {
  const n1 = normalizeWord(w1)
  const n2 = normalizeWord(w2)
  if (!n1 || !n2) return false
  if (n1 === n2) return true
  if (n1.length >= 5 && n2.length >= 5) {
    if (Math.abs(n1.length - n2.length) <= 1) {
      return levenshteinDistance(n1, n2) <= 1
    }
  }
  return false
}

/**
 * Check if a text ends with sentence-terminating punctuation.
 * Ignores decimals ("3.14"), abbreviations ("Dr."), versions ("Node.js", "v1.2"),
 * and ellipses ("...").
 */
export function endsWithSentencePunctuation(text: string): boolean {
  const t = cleanAudioAnnotations(text).trim()
  if (!t) return false

  // Ellipsis is NOT a completed sentence
  if (/(?:\.\.\.|…)$/.test(t)) return false

  // Ends with question mark or exclamation mark
  if (/[!?\uff01\uff1f]$/.test(t)) return true

  // Ends with period or full-width period: verify it's not a decimal, version, or abbreviation
  if (/[.\u3002]$/.test(t)) {
    if (ABBREVIATION_END_REGEX.test(t)) return false
    // Decimal or version at the end: e.g. "Node.js" or "v1.2."
    if (/(?:node\.js|\bv\d+(?:\.\d+)*)\.?$/i.test(t)) return false
    return true
  }

  return false
}

/**
 * Extracts sentences from a text while strictly respecting:
 * - Abbreviations (e.g., "Dr. Smith", "e.g.", "Prof.")
 * - Decimals and version numbers (e.g., "3.14", "Node.js", "v18.0", "Vue.js")
 * - Ellipses ("...")
 * - East Asian full-width punctuation (。, ！, ？)
 */
export function extractSentences(text: string): string[] {
  const cleaned = cleanAudioAnnotations(text || '').trim()
  if (!cleaned) return []

  const sentences: string[] = []
  let current = ''

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    current += char

    // Check if char is sentence terminating punctuation: . ! ? … 。 ！ ？
    if (/[.!?…\u3002\uff01\uff1f]/.test(char)) {
      // 1. Check ellipsis: e.g. ... or …
      if (char === '.' && (cleaned[i + 1] === '.' || cleaned[i - 1] === '.')) {
        continue
      }
      if (char === '…') {
        continue
      }

      // 2. Check decimal: digit before and digit after (e.g. 3.14)
      if (char === '.' && /\d/.test(cleaned[i - 1] || '') && /\d/.test(cleaned[i + 1] || '')) {
        continue
      }

      // 3. Check domain/extension: e.g. Node.js, Vue.js, .com, .net
      if (char === '.' && /(?:node|vue|react)\.$/i.test(current) && /^js\b/i.test(cleaned.slice(i + 1))) {
        continue
      }
      if (char === '.' && /\.(?:com|org|net|io|ai|vn)\b/i.test(cleaned.slice(Math.max(0, i - 4), i + 4))) {
        continue
      }

      // 4. Check abbreviation (Dr., Mr., e.g., i.e., Prof., etc.)
      if (char === '.' && ABBREVIATION_END_REGEX.test(current.trimEnd())) {
        continue
      }

      // 5. Must be followed by whitespace, end of string, or East Asian char/quote
      const nextChar = cleaned[i + 1]
      const isEastAsianPunct = /[。\uff01\uff1f]/.test(char)
      if (nextChar === undefined || /\s/.test(nextChar) || isEastAsianPunct || /['"”’)]/.test(nextChar)) {
        const trimmed = current.trim()
        if (trimmed) {
          sentences.push(trimmed)
          current = ''
        }
      }
    }
  }

  const remainder = current.trim()
  if (remainder) {
    sentences.push(remainder)
  }

  return sentences.filter((s) => s.length > 0)
}

/**
 * Extract the LAST sentence of a turn cleanly.
 */
export function takeLastSentence(text: string): string {
  const sentences = extractSentences(text)
  if (sentences.length === 0) return ''
  return sentences[sentences.length - 1]
}

/**
 * Deduplicate word-level boundary overlap between two contiguous STT chunks.
 *
 * Rules:
 * - Window up to 6 words.
 * - ONLY deduplicate if:
 *   1. prevText does NOT end with sentence-terminating punctuation (. ! ?)
 *   2. AND (matched >= 2 words OR matched 1 word of length >= 4)
 * - DO NOT remove legitimate consecutive word repetitions (e.g. "that that", "rất rất").
 */
export function stitchTwoChunks(prevText: string, nextText: string): string {
  const prevClean = cleanAudioAnnotations(prevText).trim()
  let nextClean = cleanAudioAnnotations(nextText).trim()

  if (!prevClean) return nextClean
  if (!nextClean) return prevClean

  // Strip leading/trailing ellipsis that STT engines often emit on split fragments
  const prevWithoutEllipsis = prevClean.replace(/(?:\.\.\.|…)+$/, '').trimEnd()
  nextClean = nextClean.replace(/^(?:\.\.\.|…)+/, '').trimStart()

  if (!nextClean) return prevWithoutEllipsis

  // If next chunk starts with punctuation like ',', '.', '?', attach directly
  if (/^[.,!?;:]/.test(nextClean)) {
    return `${prevWithoutEllipsis}${nextClean}`
  }

  // If prevText ended with a clean sentence terminator (. ! ?), no overlap removal across sentence boundary!
  if (endsWithSentencePunctuation(prevWithoutEllipsis)) {
    return `${prevWithoutEllipsis} ${nextClean}`
  }

  const prevWords = prevWithoutEllipsis.split(/\s+/)
  const nextWords = nextClean.split(/\s+/)

  const maxWindow = Math.min(prevWords.length, nextWords.length, 6)
  let overlapFound = 0

  for (let k = maxWindow; k >= 1; k--) {
    const prevSlice = prevWords.slice(-k)
    const nextSlice = nextWords.slice(0, k)

    let match = true
    for (let i = 0; i < k; i++) {
      if (!wordsMatch(prevSlice[i], nextSlice[i])) {
        match = false
        break
      }
    }

    if (match) {
      // Check valid repetition guard:
      // If k === 1, and the matched word is in VALID_REPETITIONS, verify whether it's
      // a natural repeated word (e.g., "I think that" + "that is right")
      const firstWordNormalized = normalizeWord(nextSlice[0])
      if (k === 1) {
        if (VALID_REPETITIONS.has(firstWordNormalized)) {
          // Do not treat as overlap; let both words stay!
          overlapFound = 0
          break
        }
        // Only consider 1-word overlap if word is >= 4 characters
        if (firstWordNormalized.length < 4) {
          overlapFound = 0
          break
        }
      }

      overlapFound = k
      break
    }
  }

  if (overlapFound > 0) {
    const prefixPrev = prevWords.slice(0, prevWords.length - overlapFound).join(' ')
    return prefixPrev ? `${prefixPrev} ${nextClean}` : nextClean
  }

  return `${prevWithoutEllipsis} ${nextClean}`
}

/**
 * Check if a speaker string belongs to the candidate (interview mode).
 */
export function isCandidateSpeaker(speaker?: string): boolean {
  const s = (speaker || '').toLowerCase()
  return s.includes('you') || s.includes('bạn') || s.includes('ứng viên') || s.includes('candidate')
}

/**
 * Check if a sentence is a question based on fast regex patterns.
 */
export function isQuestionSentence(text: string): boolean {
  if (!text) return false
  const t = cleanAudioAnnotations(text).trim()
  if (/[?？]/.test(t)) return true

  // Common question starters
  if (
    /^(?:what|why|how|when|where|who|which|can|could|should|would|will|do|does|did|is|are|have|has)\b/i.test(
      t
    )
  ) {
    return true
  }
  if (
    /\b(?:tại sao|vì sao|như thế nào|làm sao|là gì|cái gì|cho mình hỏi|cho em hỏi|có thể giải thích|phải không|đúng không|được không)\b/i.test(
      t
    )
  ) {
    return true
  }
  return false
}

/**
 * Parses timestamp string "MM:SS" or "HH:MM:SS" into total seconds.
 */
function parseTimestampSeconds(ts?: string): number | null {
  if (!ts) return null
  const parts = ts.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return null
}

/**
 * Assemble the latest conversational exchange from recent transcript lines.
 *
 * Guaranteed characteristics:
 * - 0 LLM calls (deterministic execution).
 * - < 5ms execution time.
 * - Extracts `original` (last sentence for display) and `fullTurnText` (whole turn).
 * - Resolves chunk overlaps and respects audio tags & punctuation.
 */
export function assembleLatestExchange(
  lines: AssemblerLine[],
  mode: AppMode = 'interview',
  options?: AssemblerOptions
): AssembledExchange | null {
  if (!lines || lines.length === 0) return null

  const maxLookback = options?.maxLookbackLines ?? 6
  const maxTimeGapSeconds = options?.maxTimeGapSeconds ?? 15

  // 1. Identify target line:
  // In interview mode: prioritize latest non-candidate line.
  // In discussion mode: latest line.
  let targetIdx = lines.length - 1
  if (mode === 'interview') {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!isCandidateSpeaker(lines[i].speaker)) {
        targetIdx = i
        break
      }
    }
  }

  const targetLine = lines[targetIdx]
  const targetSpeaker = targetLine.speaker || 'Speaker'

  // 2. Lookback and group contiguous chunks from the same speaker
  let startIdx = targetIdx
  let continuationUsed = false

  while (startIdx > 0 && targetIdx - startIdx < maxLookback) {
    const prevLine = lines[startIdx - 1]
    const currLine = lines[startIdx]

    // Same speaker check
    if (prevLine.speaker !== targetSpeaker) break

    // Timestamp gap check if available
    const prevSec = parseTimestampSeconds(prevLine.timestamp)
    const currSec = parseTimestampSeconds(currLine.timestamp)
    if (prevSec !== null && currSec !== null && currSec - prevSec > maxTimeGapSeconds) {
      break
    }

    // SequenceId check: if gap in sequence ID is > 1 and not marked continuation
    if (
      currLine.sequenceId !== undefined &&
      prevLine.sequenceId !== undefined &&
      currLine.sequenceId - prevLine.sequenceId > 1 &&
      !currLine.continuation
    ) {
      break
    }

    if (currLine.continuation) {
      continuationUsed = true
    }

    startIdx--
  }

  const group = lines.slice(startIdx, targetIdx + 1)
  if (group.length === 0) return null

  // 3. Incrementally stitch group fragments using overlap-aware stitching
  let assembledFullTurn = ''
  for (let i = 0; i < group.length; i++) {
    const chunkText = group[i].original || group[i].translated || ''
    if (i === 0) {
      assembledFullTurn = cleanAudioAnnotations(chunkText).trim()
    } else {
      assembledFullTurn = stitchTwoChunks(assembledFullTurn, chunkText)
    }
  }

  assembledFullTurn = cleanAudioAnnotations(assembledFullTurn).trim()
  if (!assembledFullTurn) return null

  // 4. Split sentences
  const sentences = extractSentences(assembledFullTurn)
  const lastSentence = sentences.length > 0 ? sentences[sentences.length - 1] : assembledFullTurn

  // Check for question inside the turn: prioritize last question
  let questionSentence = ''
  let hasQuestion = false
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (isQuestionSentence(sentences[i])) {
      questionSentence = sentences[i]
      hasQuestion = true
      break
    }
  }

  if (!questionSentence) {
    questionSentence = lastSentence
    hasQuestion = isQuestionSentence(lastSentence)
  }

  const lastLineInGroup = group[group.length - 1]

  return {
    original: lastSentence,
    fullTurnText: assembledFullTurn,
    questionSentence,
    mergedLineCount: group.length,
    isQuestion: hasQuestion,
    speaker: targetSpeaker,
    timestamp: lastLineInGroup.timestamp || lines[lines.length - 1]?.timestamp || '',
    sourceLineCount: lines.length,
    continuationStitched: continuationUsed,
  }
}


/**
 * Overlap-aware fragment stitcher for transcript lines.
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
