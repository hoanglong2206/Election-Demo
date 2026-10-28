import type { AppMode } from '@/types/electron.d'
import type { TriggerMode, CopilotIntent, NormalizedIntent, IntentDetectionResult } from '../types'
import { isSmallTalkUtterance, cleanUtterance, stripLeadingFillers } from '../patterns/smallTalk'
import { triggerLogManager, isCandidateSpeaker } from '../triggerLog'

/**
 * Explicit command patterns (requests to summarize, explain, write code, etc.)
 */
export const COMMAND_PATTERNS: { regex: RegExp; pattern: string }[] = [
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
export const DISCUSSION_POINT_PATTERNS: { regex: RegExp; pattern: string }[] = [
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
export const QUESTION_PATTERNS: { regex: RegExp; pattern: string; score: number }[] = [
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

  // 7. Indirect / Implicit interview questions (Ambiguous Band: score 0.50 - 0.58)
  // Gated by Tier 2 Intent Gate to verify actionable question before rendering
  { regex: /\b(?:i'm\s+curious|i\s+am\s+curious|i'd\s+love\s+to\s+hear|i'd\s+love\s+to\s+know|i\s+wonder\s+how|i'm\s+interested\s+in|we\s+would\s+like\s+to\s+understand|we'd\s+like\s+to\s+know|i'd\s+like\s+to\s+see)\b/i, pattern: 'indirect question cues (en)', score: 0.55 },
  { regex: /\b(?:mình\s+muốn\s+nghe|mình\s+muốn\s+biết|mình\s+tò\s+mò\s+về|chia\s+sẻ\s+cho\s+mình|kể\s+cho\s+mình\s+nghe|thử\s+giải\s+thích|cho\s+mình\s+ví\s+dụ|muốn\s+biết\s+bạn)\b/i, pattern: 'indirect question cues (vi)', score: 0.55 },
  { regex: /\b(?:walk\s+me\s+through\s+how|give\s+me\s+an\s+example\s+of|describe\s+your\s+experience\s+with)\b/i, pattern: 'prompting cues (en)', score: 0.55 },
]

export const CODING_TERMS = /\b(?:algorithm|complexity|leetcode|function|code|coding|bug|debug|array|string|tree|graph|dp|dynamic programming|binary search|implementation|thuật toán|độ phức tạp|hàm|mảng|chuỗi|cây|đồ thị)\b/i
export const SYSTEM_DESIGN_TERMS = /\b(?:system design|architecture|scalab|distributed|microservice|kafka|redis|database|load balancer|kiến trúc|hệ thống phân tán|mở rộng|cơ sở dữ liệu)\b/i
export const BEHAVIORAL_TERMS = /\b(?:tell me about a time|describe a time|conflict|strength|weakness|leadership|teamwork|hãy kể|một lần|xung đột|điểm mạnh|điểm yếu|làm việc nhóm)\b/i
export const CLARIFICATION_TERMS = /(?:what do you mean|could you clarify|can you clarify|ý bạn là|ý bạn là gì|giải thích rõ|nói rõ hơn|chưa hiểu)/i
export const CHALLENGE_TERMS = /\b(?:but|however|disagree|are you sure|why not|concern|rủi ro|không đồng ý|nhưng|tại sao không|lo ngại)\b/i
export const FOLLOW_UP_TERMS = /\b(?:and what about|how about|what if|also|then|còn|thế còn|vậy còn|nếu vậy|tiếp theo)\b/i

export function detectNormalizedIntent(text: string, legacy: CopilotIntent): NormalizedIntent {
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

export function inferTopic(text: string): string | undefined {
  if (CODING_TERMS.test(text)) return 'coding'
  if (SYSTEM_DESIGN_TERMS.test(text)) return 'system_design'
  if (BEHAVIORAL_TERMS.test(text)) return 'behavioral'
  return undefined
}

export function detectLanguage(text: string): 'en' | 'vi' | 'mixed' {
  const vi = /(?:\b(?:và|có|không|là|bạn|anh|chị|em|hệ thống|giải thích|tại sao)\b|[ăâđêôơư])/i.test(text)
  const en = /\b(?:the|is|are|what|why|how|can|could|system|explain|please)\b/i.test(text)
  return vi && en ? 'mixed' : vi ? 'vi' : 'en'
}

/**
 * Fast, 0-latency heuristic classifier to detect Intent and Copilot Trigger Decision.
 */
export function detectHeuristicIntent(
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
