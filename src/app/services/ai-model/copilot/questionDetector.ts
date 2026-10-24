import type { AppMode } from '@/types/electron.d'
import type { TriggerMode } from '../../settings/schema'

export type { TriggerMode } from '../../settings/schema'

/**
 * Supported Intent categories for Copilot trigger decisions.
 */
export type CopilotIntent =
  | 'QUESTION'
  | 'DISCUSSION_POINT'
  | 'COMMAND'
  | 'SMALL_TALK'
  | 'UNKNOWN'

export type NormalizedIntent =
  | 'direct_question'
  | 'implicit_question'
  | 'coding_problem'
  | 'system_design_problem'
  | 'behavioral_question'
  | 'clarification_request'
  | 'follow_up_question'
  | 'challenge_or_objection'
  | 'normal_conversation'

export interface IntentClassifier {
  classify(input: {
    text: string
    language: 'en' | 'vi' | 'mixed'
    heuristicIntent: NormalizedIntent
  }): Promise<{
    intent: NormalizedIntent
    confidence: number
    topic?: string
    questionText?: string
    triggerReason?: string
  }>
}

export interface IntentDetectionResult {
  intent: CopilotIntent
  normalizedIntent?: NormalizedIntent
  questionText?: string
  triggerReason?: string
  topic?: string
  detectionTimestamp?: number
  confidence: number // 0.0 - 1.0
  normalizedText: string
  rawText: string
  speaker: string
  isQuestion: boolean
  shouldTriggerCopilot: boolean
  triggerDecisionReason: string
  isSplitFragment: boolean
  mergedLineCount: number
  matchedPatterns: string[]
  timestamp?: string
}

export interface QuestionDetectorConfig {
  mode?: AppMode
  triggerMode?: TriggerMode
  confidenceThreshold?: number
  debounceMs?: number
  maxLookbackLines?: number
  classifier?: IntentClassifier
  dedupeKey?: string
}

export function getAdaptiveDebounceMs(
  text: string,
  configuredMs = 500,
): number {
  if (isIncompleteSpeechFragment(text)) return Math.max(700, configuredMs + 200)
  if (text.trim().split(/\s+/).length <= 4) return Math.min(700, configuredMs + 100)
  return Math.max(300, Math.min(700, configuredMs))
}

export interface IntentMetrics {
  detectedQuestions: number
  falseTriggers: number
  classifierCalls: number
  averageDetectionLatency: number
}

const intentMetrics: IntentMetrics = {
  detectedQuestions: 0,
  falseTriggers: 0,
  classifierCalls: 0,
  averageDetectionLatency: 0,
}

export function getIntentMetrics(): IntentMetrics {
  return { ...intentMetrics }
}

export function resetIntentMetrics(): void {
  intentMetrics.detectedQuestions = 0
  intentMetrics.falseTriggers = 0
  intentMetrics.classifierCalls = 0
  intentMetrics.averageDetectionLatency = 0
}

export function recordFalseTrigger(): void {
  intentMetrics.falseTriggers += 1
}

let configuredIntentClassifier: IntentClassifier | undefined
export function configureIntentClassifier(classifier?: IntentClassifier): void {
  configuredIntentClassifier = classifier
}

const lastIntentByKey = new Map<string, string>()

export interface TriggerLogEntry {
  id: string
  timestamp: number
  timeStr: string
  text: string
  speaker: string
  intent: CopilotIntent
  confidence: number
  decision: 'triggered' | 'skipped'
  reason: string
  mode: AppMode
  triggerMode: TriggerMode
}

/**
 * Common parenthetical/bracketed audio annotations from STT engines like Whisper
 */
export const AUDIO_TAGS_REGEX =
  /\((?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\)|\[(?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\]/gi

/**
 * Leading filler words, conversational openers, or symbols
 */
export const LEADING_FILLER_REGEX =
  /^(?:[\s\-_–—•*~,.;:!?()\[\]"']|so|well|okay|ok|hey|hi|hello|um|uh|yeah|yes|no|now|and|or|but|please|by the way|anyway|à|ừ|ừm|vâng|dạ|thế|vậy|cho hỏi|em cho anh hỏi|anh cho em hỏi|nhân tiện|ủa)+\s*[,:;-]*\s*/i

/**
 * Pure small-talk phrases in English and Vietnamese that should NEVER trigger LLM Copilot.
 */
const SMALL_TALK_TOKENS = new Set([
  'ok', 'okay', 'k', 'oke', 'oki', 'okie', 'alright', 'all right', 'i see', 'right',
  'yeah', 'yep', 'yes', 'nope', 'no', 'sure', 'cool', 'fine', 'great', 'awesome', 'perfect',
  'nice', 'good', 'thank you', 'thanks', 'thanks a lot', 'thank you very much', 'got it',
  'understood', 'sounds good', 'makes sense', 'no problem', 'youre welcome', 'you\'re welcome',
  'welcome', 'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'bye',
  'goodbye', 'see you', 'take care', 'vâng', 'dạ', 'dạ vâng', 'vâng ạ', 'ừ', 'ừm', 'ờ',
  'dạ được', 'được rồi', 'rõ rồi', 'hiểu rồi', 'chuẩn rồi', 'chính xác', 'đúng rồi', 'cảm ơn',
  'cảm ơn bạn', 'cảm ơn anh', 'cảm ơn chị', 'cảm ơn em', 'cảm ơn nhiều', 'cảm ơn nhé',
  'xin cảm ơn', 'chào bạn', 'xin chào', 'tạm biệt', 'hẹn gặp lại', 'vậy thôi', 'thế thôi',
  'không có chi', 'không sao', 'ok anh', 'ok em', 'dạ vâng ạ', 'được rồi ạ', 'rõ rồi ạ',
  'dạ được rồi ạ', 'dạ rõ rồi ạ', 'vâng được rồi ạ', 'dạ cảm ơn ạ', 'vâng cảm ơn ạ',
  'dạ vâng cảm ơn', 'rồi ạ', 'xong rồi ạ', 'xong rồi', 'được ạ', 'dạ được ạ'
])

export function isSmallTalkUtterance(cleaned: string): boolean {
  if (!cleaned) return false
  // Never treat text with explicit question mark as pure small talk
  if (/[?？]/.test(cleaned)) return false

  const normalized = cleaned
    .toLowerCase()
    .replace(/[.,!?;:…\-_'"()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return false
  if (SMALL_TALK_TOKENS.has(normalized)) return true

  // Strip polite particles and check core
  let core = normalized
  // Strip trailing particles: ạ, nhé, nha, nghen, bạn, anh, chị, em, nhiều
  core = core.replace(/\s+(?:ạ|nhé|nha|nghen|nhá|bạn|anh|chị|em|nhiều|nữa)$/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  // Strip leading openers: dạ, vâng, ừ, ừm, ok, okay, right
  core = core.replace(/^(?:dạ|vâng|ừ|ừm|ok|okay|right|yeah|yes)\s+/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  // Re-check trailing after leading strip (e.g. "dạ được rồi ạ" -> "được rồi")
  core = core.replace(/\s+(?:ạ|nhé|nha|nghen|nhá|bạn|anh|chị|em|nhiều)$/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  return false
}

/**
 * Explicit command patterns (requests to summarize, explain, write code, etc.)
 */
const COMMAND_PATTERNS: { regex: RegExp; pattern: string }[] = [
  { regex: /\b(?:hãy\s+)?tóm\s+tắt\b/i, pattern: 'tóm tắt' },
  { regex: /\b(?:giải\s+thích\s+ngắn\s+gọn|giải\s+thích\s+giúp)\b/i, pattern: 'giải thích ngắn gọn' },
  { regex: /\b(?:viết\s+code\s+cho|tạo\s+function|viết\s+hàm)\b/i, pattern: 'viết code' },
  { regex: /\b(?:so\s+sánh\s+giúp|hãy\s+so\s+sánh)\b/i, pattern: 'so sánh' },
  { regex: /\b(?:đưa\s+ra\s+gợi\s+ý|hãy\s+đề\s+xuất|tìm\s+lỗi\s+giúp)\b/i, pattern: 'đề xuất' },
  { regex: /\b(?:summarize\s+this|give\s+a\s+summary)\b/i, pattern: 'summarize' },
  { regex: /\b(?:explain\s+briefly|explain\s+in\s+short)\b/i, pattern: 'explain briefly' },
  { regex: /\b(?:write\s+code\s+for|write\s+a\s+function\s+to)\b/i, pattern: 'write code' },
  { regex: /\b(?:suggest\s+a\s+solution|give\s+suggestions)\b/i, pattern: 'suggest solution' },
  { regex: /\b(?:compare\s+these|find\s+bugs\s+in)\b/i, pattern: 'compare / find bugs' },
]

/**
 * Discussion point patterns (opinions, problem statements, architectures, proposals)
 */
const DISCUSSION_POINT_PATTERNS: { regex: RegExp; pattern: string }[] = [
  { regex: /\b(?:theo\s+tôi|theo\s+quan\s+điểm\s+của\s+tôi|tôi\s+nghĩ\s+là)\b/i, pattern: 'theo quan điểm' },
  { regex: /\b(?:vấn\s+đề\s+ở\s+đây\s+là|điểm\s+mấu\s+chốt\s+là)\b/i, pattern: 'vấn đề ở đây là' },
  { regex: /\b(?:chúng\s+ta\s+nên|chúng\s+ta\s+cần\s+cân\s+nhắc)\b/i, pattern: 'chúng ta nên' },
  { regex: /\b(?:giải\s+pháp\s+khả\s+thi\s+là|phương\s+án\s+là)\b/i, pattern: 'giải pháp là' },
  { regex: /\b(?:thách\s+thức\s+lớn\s+nhất|khó\s+khăn\s+là)\b/i, pattern: 'thách thức lớn nhất' },
  { regex: /\b(?:tôi\s+đề\s+xuất|ý\s+kiến\s+của\s+tôi\s+là)\b/i, pattern: 'tôi đề xuất' },
  { regex: /\b(?:in\s+my\s+opinion|from\s+my\s+perspective|i\s+believe\s+that)\b/i, pattern: 'in my opinion' },
  { regex: /\b(?:the\s+main\s+issue\s+is|the\s+problem\s+is|the\s+core\s+challenge\s+is)\b/i, pattern: 'the main issue is' },
  { regex: /\b(?:we\s+should\s+consider|my\s+proposal\s+is|i\s+suggest\s+that)\b/i, pattern: 'we should consider' },
  { regex: /\b(?:the\s+viable\s+solution\s+is|an\s+alternative\s+approach\s+is)\b/i, pattern: 'solution is' },
  { regex: /\b(?:what\s+we\s+need\s+is|what\s+if\s+we\s+use)\b/i, pattern: 'what if we' },
]

/**
 * Question patterns in English & Vietnamese
 */
const QUESTION_PATTERNS: { regex: RegExp; pattern: string; score: number }[] = [
  // 1. Direct punctuation mark
  { regex: /[?？][)"'”’\s]*$/, pattern: 'trailing question mark (?)', score: 0.95 },

  // 2. English Wh-question starters
  { regex: /^(?:what|why|how|when|where|who|which|whom|whose)\b/i, pattern: 'wh-starter', score: 0.9 },

  // 3. Prompting interview/meeting phrases
  { regex: /\b(?:can\s+you\s+explain|could\s+you\s+explain|explain\s+how|explain\s+why)\b/i, pattern: 'explain how/why', score: 0.95 },
  { regex: /\b(?:tell\s+me\s+about|walk\s+me\s+through|describe\s+a\s+time)\b/i, pattern: 'tell me about / walk through', score: 0.95 },
  { regex: /\b(?:how\s+would\s+you|how\s+do\s+you\s+handle|how\s+does\s+it\s+work)\b/i, pattern: 'how would you', score: 0.92 },
  { regex: /\b(?:what\s+is\s+the\s+difference|what\s+are\s+the\s+trade-offs)\b/i, pattern: 'difference / trade-offs', score: 0.92 },
  { regex: /\b(?:have\s+you\s+ever|what\s+happens\s+if|what\s+are\s+your\s+thoughts)\b/i, pattern: 'what happens if / have you ever', score: 0.9 },
  { regex: /\b(?:could\s+you\s+elaborate|would\s+you\s+mind|any\s+questions|any\s+feedback)\b/i, pattern: 'elaborate / feedback', score: 0.88 },

  // 4. Inverted auxiliaries (Yes/No questions)
  { regex: /^(?:can|could|should|would|will|do|does|did|is|are|was|were)\s+(?:you|we|i|they|he|she|it|there|this|that)\b/i, pattern: 'auxiliary inversion', score: 0.88 },
  { regex: /^(?:have|has|had)\s+(?:you|we|they|he|she|it)\b/i, pattern: 'have/has inversion', score: 0.85 },

  // 5. English Tag questions
  { regex: /(?:,\s*|\s+)(?:right|correct|isn't it|aren't you|don't you|doesn't it|won't it|can't we)[.?!…\s]*$/i, pattern: 'tag question', score: 0.85 },

  // 6. Vietnamese question markers & phrases
  { regex: /\b(?:tại\s+sao|vì\s+sao|sao\s+lại)\b/i, pattern: 'tại sao', score: 0.92 },
  { regex: /\b(?:như\s+thế\s+nào|làm\s+thế\s+nào|bằng\s+cách\s+nào|ra\s+sao)\b/i, pattern: 'như thế nào', score: 0.92 },
  { regex: /\b(?:là\s+gì|cái\s+gì|vấn\s+đề\s+gì|gì\s+thế|gì\s+vậy)\b/i, pattern: 'là gì', score: 0.9 },
  { regex: /\b(?:cho\s+mình\s+hỏi|cho\s+em\s+hỏi|cho\s+anh\s+hỏi|xin\s+hỏi)\b/i, pattern: 'cho mình hỏi', score: 0.95 },
  { regex: /\b(?:có\s+thể\s+giải\s+thích|bạn\s+có\s+thể\s+chia\s+sẻ)\b/i, pattern: 'có thể giải thích', score: 0.92 },
  { regex: /\b(?:ở\s+đâu|nơi\s+nào|khi\s+nào|bao\s+giờ|lúc\s+nào|bao\s+nhiêu|bao\s+lâu)\b/i, pattern: 'khi nào / bao lâu', score: 0.9 },
  { regex: /\b(?:liệu\s+có|liệu\s+rằng|ý\s+bạn\s+là)\b/i, pattern: 'liệu có', score: 0.88 },
  { regex: /\bcó\b.+\b(?:không|k|ko)\b/i, pattern: 'có ... không', score: 0.9 },
  { regex: /(?:phải\s+không|đúng\s+không|được\s+không|ổn\s+không)[.?!…\s]*$/i, pattern: 'phải/đúng không', score: 0.88 },
  { regex: /(?:không|k|ko|hả|hở|nhỉ|à|chăng|đúng chưa)[.?!…\s]*$/i, pattern: 'ending particle (hả, không, nhỉ)', score: 0.82 },
  { regex: /\bchưa[.?!…\s]*$/i, pattern: 'ending chưa', score: 0.8 },
]

/**
 * Checks if a string looks like an incomplete chunk that needs stitching with the next one.
 */
export function isIncompleteSpeechFragment(text: string): boolean {
  if (!text) return false
  const t = text.trim()
  if (!t) return false

  // Trailing ellipsis or dashes or commas
  if (/(?:\.\.\.|…|--|-|,)$/.test(t)) return true

  // Does NOT end with sentence-terminating punctuation (. ! ?)
  if (!/[.!?\u3002\uff01\uff1f]$/.test(t)) {
    // Check if ends with dangling connector or preposition
    const words = t.split(/\s+/)
    const lastWord = (words[words.length - 1] || '').toLowerCase()
    const dangling = [
      'that',
      'how',
      'why',
      'what',
      'if',
      'when',
      'where',
      'about',
      'with',
      'for',
      'and',
      'or',
      'to',
      'is',
      'are',
      'can',
      'could',
      'tell',
      'explain',
      'là',
      'về',
      'với',
      'cho',
      'và',
      'hoặc',
      'thì',
      'nếu',
      'khi',
      'ở',
      'tại',
      'như',
      'giải thích',
      'hỏi',
    ]
    if (dangling.includes(lastWord)) return true
    // Sentences shorter than 4 words without period are likely incomplete
    if (words.length <= 4) return true
  }

  return false
}

/**
 * Clean audio annotations and normalize whitespace.
 */
export function cleanUtterance(text: string): string {
  if (!text) return ''
  return text.replace(AUDIO_TAGS_REGEX, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Strip leading conversational fillers (so, well, okay, à, ừ, etc.)
 */
export function stripLeadingFillers(text: string): string {
  let cleaned = text.trim()
  let prev = ''
  while (cleaned !== prev) {
    prev = cleaned
    cleaned = cleaned.replace(LEADING_FILLER_REGEX, '').trim()
  }
  return cleaned
}

/**
 * Checks if speaker is the candidate (candidate speech does not trigger interview Copilot).
 */
export function isCandidateSpeaker(speaker?: string): boolean {
  const s = (speaker || '').toLowerCase()
  return s.includes('you') || s.includes('bạn') || s.includes('ứng viên')
}

/**
 * In-memory circular buffer for false-trigger monitoring & rule tuning.
 */
class TriggerLogManager {
  private logs: TriggerLogEntry[] = []
  private maxLogs = 50

  public logDecision(entry: Omit<TriggerLogEntry, 'id' | 'timestamp' | 'timeStr'>): TriggerLogEntry {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const fullEntry: TriggerLogEntry = {
      id: `trig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeStr,
      ...entry,
    }

    this.logs.unshift(fullEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }

    return fullEntry
  }

  public getLogs(): TriggerLogEntry[] {
    return [...this.logs]
  }

  public clearLogs(): void {
    this.logs = []
  }
}

export const triggerLogManager = new TriggerLogManager()

/**
 * Fast, 0-latency heuristic classifier to detect Intent and Copilot Trigger Decision.
 */
function detectHeuristicIntent(
  rawText: string,
  options?: {
    speaker?: string
    mode?: AppMode
    triggerMode?: TriggerMode
    confidenceThreshold?: number
  }
): IntentDetectionResult {

  const mode = options?.mode || 'interview'
  const triggerMode = options?.triggerMode || 'auto'
  const threshold = options?.confidenceThreshold ?? 0.65
  const speaker = options?.speaker || 'Speaker'

  const cleaned = cleanUtterance(rawText)
  if (!cleaned) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      normalizedText: '',
      rawText,
      speaker,
      isQuestion: false,
      shouldTriggerCopilot: false,
      triggerDecisionReason: 'Skipped: Empty audio text',
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns: [],
    }
  }

  const matchedPatterns: string[] = []

  // ── Step 1: Detect SMALL_TALK (Priority 1: instant skip) ──────────────────
  if (isSmallTalkUtterance(cleaned)) {
    matchedPatterns.push('small_talk')
    const result: IntentDetectionResult = {
      intent: 'SMALL_TALK',
      confidence: 0.95,
      normalizedText: cleaned,
      rawText,
      speaker,
      isQuestion: false,
      shouldTriggerCopilot: false,
      triggerDecisionReason: `Skipped: Small talk utterance ("${cleaned}")`,
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns,
    }
    triggerLogManager.logDecision({
      text: cleaned,
      speaker,
      intent: result.intent,
      confidence: result.confidence,
      decision: 'skipped',
      reason: result.triggerDecisionReason,
      mode,
      triggerMode,
    })
    return result
  }

  // Strip leading fillers for deeper analysis
  const stripped = stripLeadingFillers(cleaned)

  // If after stripping fillers the text is empty or matched small talk
  if (!stripped || isSmallTalkUtterance(stripped)) {
    matchedPatterns.push('filler_only')
    const result: IntentDetectionResult = {
      intent: 'SMALL_TALK',
      confidence: 0.9,
      normalizedText: cleaned,
      rawText,
      speaker,
      isQuestion: false,
      shouldTriggerCopilot: false,
      triggerDecisionReason: `Skipped: Conversational filler only ("${cleaned}")`,
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns,
    }
    triggerLogManager.logDecision({
      text: cleaned,
      speaker,
      intent: result.intent,
      confidence: result.confidence,
      decision: 'skipped',
      reason: result.triggerDecisionReason,
      mode,
      triggerMode,
    })
    return result
  }

  // ── Step 2: Detect COMMAND ────────────────────────────────────────────────
  for (const item of COMMAND_PATTERNS) {
    if (item.regex.test(stripped)) {
      matchedPatterns.push(`cmd:${item.pattern}`)
      const shouldTrigger = triggerMode !== 'manual'
      const reason =
        triggerMode === 'manual'
          ? 'Manual Mode: Copilot trigger withheld until requested'
          : `Triggered: Command detected ("${item.pattern}")`

      const result: IntentDetectionResult = {
        intent: 'COMMAND',
        confidence: 0.9,
        normalizedText: stripped,
        rawText,
        speaker,
        isQuestion: true, // Commands also benefit from Copilot generation
        shouldTriggerCopilot: shouldTrigger,
        triggerDecisionReason: reason,
        isSplitFragment: false,
        mergedLineCount: 1,
        matchedPatterns,
      }
      triggerLogManager.logDecision({
        text: stripped,
        speaker,
        intent: result.intent,
        confidence: result.confidence,
        decision: shouldTrigger ? 'triggered' : 'skipped',
        reason,
        mode,
        triggerMode,
      })
      return result
    }
  }

  // ── Step 3: Detect QUESTION ───────────────────────────────────────────────
  let maxQuestionScore = 0
  for (const item of QUESTION_PATTERNS) {
    if (item.regex.test(stripped) || item.regex.test(cleaned)) {
      matchedPatterns.push(`q:${item.pattern}`)
      if (item.score > maxQuestionScore) {
        maxQuestionScore = item.score
      }
    }
  }

  if (maxQuestionScore > 0) {
    const isCandidate = mode === 'interview' && isCandidateSpeaker(speaker)
    const shouldTrigger =
      triggerMode !== 'manual' &&
      !isCandidate &&
      maxQuestionScore >= threshold
    const reason =
      triggerMode === 'manual'
        ? 'Manual Mode: Copilot auto-trigger disabled by user'
        : isCandidate
          ? 'Skipped: Candidate speech in Interview Mode'
          : shouldTrigger
            ? `Triggered: Question detected with confidence ${(maxQuestionScore * 100).toFixed(0)}%`
            : `Skipped: Question confidence (${(maxQuestionScore * 100).toFixed(0)}%) below threshold (${(threshold * 100).toFixed(0)}%)`

    const result: IntentDetectionResult = {
      intent: 'QUESTION',
      confidence: maxQuestionScore,
      normalizedText: stripped,
      rawText,
      speaker,
      isQuestion: true,
      shouldTriggerCopilot: shouldTrigger,
      triggerDecisionReason: reason,
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns,
    }
    triggerLogManager.logDecision({
      text: stripped,
      speaker,
      intent: result.intent,
      confidence: result.confidence,
      decision: shouldTrigger ? 'triggered' : 'skipped',
      reason,
      mode,
      triggerMode,
    })
    return result
  }

  // ── Step 4: Detect DISCUSSION_POINT ───────────────────────────────────────
  let maxDiscussionScore = 0
  for (const item of DISCUSSION_POINT_PATTERNS) {
    if (item.regex.test(stripped)) {
      matchedPatterns.push(`disc:${item.pattern}`)
      maxDiscussionScore = 0.85
      break
    }
  }

  if (maxDiscussionScore > 0) {
    const shouldTrigger =
      triggerMode !== 'manual' &&
      mode === 'discussion' &&
      maxDiscussionScore >= threshold
    const reason =
      triggerMode === 'manual'
        ? 'Manual Mode: Copilot auto-trigger disabled by user'
        : mode === 'discussion'
          ? shouldTrigger
            ? `Triggered: Discussion point detected in Discussion Mode (${(maxDiscussionScore * 100).toFixed(0)}%)`
            : 'Skipped: Discussion point confidence below threshold'
          : 'Skipped: Discussion point not actionable in Interview Mode'

    const result: IntentDetectionResult = {
      intent: 'DISCUSSION_POINT',
      confidence: maxDiscussionScore,
      normalizedText: stripped,
      rawText,
      speaker,
      isQuestion: false,
      shouldTriggerCopilot: shouldTrigger,
      triggerDecisionReason: reason,
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns,
    }
    triggerLogManager.logDecision({
      text: stripped,
      speaker,
      intent: result.intent,
      confidence: result.confidence,
      decision: shouldTrigger ? 'triggered' : 'skipped',
      reason,
      mode,
      triggerMode,
    })
    return result
  }

  // ── Step 5: UNKNOWN / Non-actionable statement ─────────────────────────────
  const result: IntentDetectionResult = {
    intent: 'UNKNOWN',
    confidence: 0.25,
    normalizedText: stripped,
    rawText,
    speaker,
    isQuestion: false,
    shouldTriggerCopilot: false,
    triggerDecisionReason: 'Skipped: General statement / Non-actionable intent',
    isSplitFragment: false,
    mergedLineCount: 1,
    matchedPatterns,
  }
  triggerLogManager.logDecision({
    text: stripped,
    speaker,
    intent: result.intent,
    confidence: result.confidence,
    decision: 'skipped',
    reason: result.triggerDecisionReason,
    mode,
    triggerMode,
  })
  return result
}

const CODING_TERMS = /\b(?:algorithm|complexity|leetcode|function|code|coding|bug|debug|array|string|tree|graph|dp|dynamic programming|binary search|implementation|thuật toán|độ phức tạp|hàm|mảng|chuỗi|cây|đồ thị)\b/i
const SYSTEM_DESIGN_TERMS = /\b(?:system design|architecture|scalab|distributed|microservice|kafka|redis|database|load balancer|kiến trúc|hệ thống phân tán|mở rộng|cơ sở dữ liệu)\b/i
const BEHAVIORAL_TERMS = /\b(?:tell me about a time|describe a time|conflict|strength|weakness|leadership|teamwork|hãy kể|một lần|xung đột|điểm mạnh|điểm yếu|làm việc nhóm)\b/i
const CLARIFICATION_TERMS = /(?:what do you mean|could you clarify|can you clarify|ý bạn là|ý bạn là gì|giải thích rõ|nói rõ hơn|chưa hiểu)/i
const CHALLENGE_TERMS = /\b(?:but|however|disagree|are you sure|why not|concern|rủi ro|không đồng ý|nhưng|tại sao không|lo ngại)\b/i
const FOLLOW_UP_TERMS = /\b(?:and what about|how about|what if|also|then|còn|thế còn|vậy còn|nếu vậy|tiếp theo)\b/i

function detectNormalizedIntent(text: string, legacy: CopilotIntent): NormalizedIntent {
  if (legacy === 'SMALL_TALK') return 'normal_conversation'
  if (CLARIFICATION_TERMS.test(text)) return 'clarification_request'
  if (CHALLENGE_TERMS.test(text)) return 'challenge_or_objection'
  if (FOLLOW_UP_TERMS.test(text)) return 'follow_up_question'
  if (CODING_TERMS.test(text)) return 'coding_problem'
  if (SYSTEM_DESIGN_TERMS.test(text)) return 'system_design_problem'
  if (BEHAVIORAL_TERMS.test(text)) return 'behavioral_question'
  if (legacy === 'UNKNOWN' && /\b(?:would be useful|need to understand|it would help|cần biết|muốn hiểu|sẽ hữu ích)\b/i.test(text)) {
    return SYSTEM_DESIGN_TERMS.test(text) ? 'system_design_problem' : 'implicit_question'
  }
  if (legacy === 'UNKNOWN') return 'normal_conversation'
  if (legacy === 'QUESTION') {
    return /[?？]/.test(text) || /^(?:what|why|how|when|where|who|which|is|are|do|does|can|could|should|có|tại sao|làm sao|vì sao|bạn|anh|chị|em)\b/i.test(text)
      ? 'direct_question'
      : 'implicit_question'
  }
  return 'normal_conversation'
}

function inferTopic(text: string): string | undefined {
  if (CODING_TERMS.test(text)) return 'coding'
  if (SYSTEM_DESIGN_TERMS.test(text)) return 'system_design'
  if (BEHAVIORAL_TERMS.test(text)) return 'behavioral'
  return undefined
}

function detectLanguage(text: string): 'en' | 'vi' | 'mixed' {
  const vi = /(?:\b(?:và|có|không|là|bạn|anh|chị|em|hệ thống|giải thích|tại sao)\b|[ăâđêôơư])/i.test(text)
  const en = /\b(?:the|is|are|what|why|how|can|could|system|explain|please)\b/i.test(text)
  return vi && en ? 'mixed' : vi ? 'vi' : 'en'
}

export function detectIntent(
  rawText: string,
  options?: Parameters<typeof detectHeuristicIntent>[1] & { dedupeKey?: string },
): IntentDetectionResult {
  const startedAt = performance.now()
  const result = detectHeuristicIntent(rawText, options)
  const enriched: IntentDetectionResult = {
    ...result,
    normalizedIntent: detectNormalizedIntent(`${result.rawText} ${result.normalizedText}`, result.intent),
    questionText: result.isQuestion ? result.normalizedText : '',
    triggerReason: result.triggerDecisionReason,
    topic: inferTopic(result.normalizedText),
    detectionTimestamp: Date.now(),
  }
  if (enriched.isQuestion || enriched.shouldTriggerCopilot) intentMetrics.detectedQuestions += 1
  const count = Math.max(1, intentMetrics.detectedQuestions)
  intentMetrics.averageDetectionLatency =
    ((intentMetrics.averageDetectionLatency * (count - 1)) + (performance.now() - startedAt)) / count
  return enriched
}

export async function classifyIntent(
  result: IntentDetectionResult,
  classifier?: IntentClassifier,
): Promise<IntentDetectionResult> {
  const activeClassifier = classifier || configuredIntentClassifier
  const threshold = 0.65
  if (!activeClassifier || result.confidence >= threshold) return result
  intentMetrics.classifierCalls += 1
  const classified = await activeClassifier.classify({
    text: result.normalizedText,
    language: detectLanguage(result.normalizedText),
    heuristicIntent: result.normalizedIntent || 'normal_conversation',
  })
  return {
    ...result,
    normalizedIntent: classified.intent,
    questionText: classified.questionText ?? result.questionText,
    triggerReason: classified.triggerReason ?? result.triggerReason,
    topic: classified.topic ?? result.topic,
    confidence: Math.max(0, Math.min(1, classified.confidence)),
    isQuestion: classified.intent !== 'normal_conversation',
    shouldTriggerCopilot: result.shouldTriggerCopilot || classified.confidence >= threshold,
  }
}

/**
 * Analyzes recent transcript lines, automatically stitches fragmented split chunks
 * (e.g. Whisper chunk 1: "Can you explain..." + chunk 2: "...how Redis handles expiration?"),
 * and returns the coherent IntentDetectionResult.
 */
export function detectIntentFromRecentLines(
  lines: { id?: number; speaker: string; original: string; translated?: string; timestamp?: string }[],
  config?: QuestionDetectorConfig
): IntentDetectionResult | null {
  if (!lines || lines.length === 0) return null

  const mode = config?.mode || 'interview'
  const triggerMode = config?.triggerMode || 'auto'
  const threshold = config?.confidenceThreshold ?? 0.65
  const maxLookback = config?.maxLookbackLines ?? 4

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

  // 2. Lookback and stitch preceding chunks from the same speaker if incomplete
  let startIdx = targetIdx
  while (
    startIdx > 0 &&
    targetIdx - startIdx < maxLookback &&
    lines[startIdx - 1].speaker === targetSpeaker
  ) {
    const prevText = cleanUtterance(lines[startIdx - 1].original || '')
    // Stop lookback if the preceding line ended cleanly with a full sentence (. ? !)
    // UNLESS it ended with trailing ellipsis ...
    if (/[.!?\u3002\uff01\uff1f]$/.test(prevText) && !/\.\.\.$/.test(prevText)) {
      break
    }
    startIdx--
  }

  const group = lines.slice(startIdx, targetIdx + 1)
  const isSplit = group.length > 1

  // 3. Assemble fragments cleanly:
  // e.g. "Can you explain..." + "...how Redis handles expiration?" -> "Can you explain how Redis handles expiration?"
  const cleanedParts = group.map((l) => {
    let t = cleanUtterance(l.original || l.translated || '')
    // Strip leading/trailing ellipsis during stitching
    t = t.replace(/^\.{2,3}\s*/, '').replace(/\s*\.{2,3}$/, '')
    return t.trim()
  }).filter(Boolean)

  const mergedText = cleanedParts.join(' ').replace(/\s+/g, ' ').trim()

  // 4. Classify merged sentence
  const detection = detectIntent(mergedText || targetLine.original, {
    speaker: targetSpeaker,
    mode,
    triggerMode,
    confidenceThreshold: threshold,
  })

  const dedupeKey = config?.dedupeKey || `${mode}:${targetSpeaker}`
  const signature = `${targetLine.id ?? targetLine.timestamp ?? lines.length}:${cleanUtterance(mergedText)}`
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
    mergedLineCount: group.length,
    timestamp: targetLine.timestamp,
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
