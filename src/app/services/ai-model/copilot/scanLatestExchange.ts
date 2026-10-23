import { callUniversalLLM } from './universalLlm'
import {
  isQuestionUtterance,
  detectIntentFromRecentLines,
  cleanUtterance,
  isCandidateSpeaker,
} from './questionDetector'
export { isCandidateSpeaker }
import { stripCodeFences } from './parseOptions'
import type { AppMode } from '@/types/electron.d'

export interface ScannedExchangeResult {
  /** Nguyên văn transcript gốc (không dịch). */
  original: string
  speaker: string
  timestamp: string
  isQuestion: boolean
  isAiScanned?: boolean
  /** Số dòng transcript lúc quét — dùng để phát hiện kết quả đã cũ. */
  sourceLineCount?: number
}

/** Từ viết tắt không được coi là kết thúc câu (Prof., Mr., e.g. ...). */
const ABBREVIATION_END =
  /(?:^|\s)(?:Prof|Mr|Mrs|Ms|Dr|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|approx|No|Vol|Fig|dept|univ|e\.g|i\.e)\.$/i

/**
 * Common parenthetical/bracketed audio annotations from STT engines like Whisper
 */
const AUDIO_TAG_REGEX =
  /\((?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\)|\[(?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\]/gi

export function cleanAudioTags(text: string): string {
  if (!text) return ''
  return text.replace(AUDIO_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Chỉ giữ lại CÂU CUỐI CÙNG của một lượt nói.
 *
 * Một lượt nói có thể gồm nhiều câu; ô "trao đổi gần nhất" chỉ cần câu mới nhất.
 * Không tách tại từ viết tắt (Prof. / Mr. / e.g. ...) để tránh cắt sai.
 */
export function takeLastSentence(text: string): string {
  const cleaned = cleanAudioTags(text || '').trim()
  if (!cleaned) return ''

  // Tách theo dòng mới nếu có
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const target = lines.length > 0 ? lines[lines.length - 1] : cleaned

  const tokens = target.split(/(\s+)/) // giữ lại khoảng trắng
  const sentences: string[] = []
  let buffer = ''

  for (const token of tokens) {
    buffer += token

    const isWhitespace = /^\s+$/.test(token)
    if (isWhitespace) continue

    const endsSentence = /[.!?…\u3002\uff01\uff1f]$/.test(token)
    if (!endsSentence) continue
    if (ABBREVIATION_END.test(buffer.trimEnd())) continue

    const sentence = buffer.trim()
    if (sentence) sentences.push(sentence)
    buffer = ''
  }

  const tail = buffer.trim()
  if (tail) sentences.push(tail)

  return sentences.length > 0 ? sentences[sentences.length - 1] : target
}

/**
 * Stitch multiple consecutive fragmented speech segments into a clean, coherent sentence.
 * Handles punctuation and overlaps from real-time audio chunking.
 */
export function stitchFragments(fragments: string[]): string {
  if (!fragments || fragments.length === 0) return ''
  let result = ''

  for (let frag of fragments) {
    frag = frag.trim()
    if (!frag) continue
    if (!result) {
      result = frag
      continue
    }

    // Check word-level overlap: e.g. "about your" + "your experience"
    const wordsResult = result.split(/\s+/)
    const wordsFrag = frag.split(/\s+/)
    let overlapFound = 0

    const maxCheck = Math.min(wordsResult.length, wordsFrag.length, 4)
    for (let len = maxCheck; len >= 1; len--) {
      const endWords = wordsResult.slice(-len).join(' ').toLowerCase()
      const startWords = wordsFrag.slice(0, len).join(' ').toLowerCase()
      if (endWords === startWords) {
        overlapFound = len
        break
      }
    }

    if (overlapFound > 0) {
      const remainingFrag = wordsFrag.slice(overlapFound).join(' ')
      if (remainingFrag) {
        result += ' ' + remainingFrag
      }
    } else if (/^[.,!?;:]/.test(frag)) {
      result += frag
    } else {
      result += ' ' + frag
    }
  }

  return result.trim()
}

/**
 * Fast, 0-latency heuristic to extract the latest conversational exchange in ORIGINAL language.
 * Gathers consecutive fragments from the same speaker to overcome real-time audio slicing.
 */
export function extractHeuristicLatestExchange(
  lines: { speaker: string; original: string; translated?: string; timestamp?: string }[],
  mode: AppMode = 'interview'
): ScannedExchangeResult | null {
  if (!lines || lines.length === 0) return null

  // Fast-path: use detectIntentFromRecentLines which already handles lookback and stitching!
  const intentDetection = detectIntentFromRecentLines(lines, { mode })
  if (intentDetection && intentDetection.normalizedText) {
    return {
      original: intentDetection.normalizedText,
      speaker: intentDetection.speaker,
      timestamp: intentDetection.timestamp || lines[lines.length - 1]?.timestamp || '',
      isQuestion: intentDetection.isQuestion,
      isAiScanned: false,
      sourceLineCount: lines.length,
    }
  }

  // Fallback if needed
  let targetIdx = lines.length - 1
  if (mode === 'interview') {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!isCandidateSpeaker(lines[i].speaker)) {
        targetIdx = i
        break
      }
    }
  }

  const targetSpeaker = lines[targetIdx].speaker || 'Speaker'
  const cleaned = cleanUtterance(lines[targetIdx].original)
  if (!cleaned.trim()) return null

  return {
    original: cleaned,
    speaker: targetSpeaker,
    timestamp: lines[targetIdx].timestamp || '',
    isQuestion: isQuestionUtterance(lines[targetIdx].original),
    isAiScanned: false,
    sourceLineCount: lines.length,
  }
}

/**
 * AI Transcript Scanner:
 * Uses the configured LLM to automatically scan recent fragmented transcript lines,
 * identify the exact latest exchange / question, and reconstruct the full sentence
 * in its ORIGINAL LANGUAGE without translating to Vietnamese.
 */
export async function scanLatestExchangeWithAI(
  lines: { speaker: string; original: string; translated?: string; timestamp?: string }[],
  mode: AppMode = 'interview'
): Promise<ScannedExchangeResult | null> {
  const heuristic = extractHeuristicLatestExchange(lines, mode)
  if (!lines || lines.length === 0) return null

  // Fast-skip: If intent detection is confident (>= 0.85) or detected small talk,
  // skip expensive LLM scan completely! (0ms latency, zero API cost, no noise)
  const intentDetection = detectIntentFromRecentLines(lines, { mode })
  if (
    intentDetection &&
    (intentDetection.intent === 'SMALL_TALK' ||
      intentDetection.confidence >= 0.85 ||
      (!intentDetection.isQuestion && mode === 'interview'))
  ) {
    return heuristic
  }

  // Take recent lines (up to last 15 lines) to keep prompt fast and focused
  const recentLines = lines.slice(-15)
  const formattedTranscript = recentLines
    .map((l) => `[${l.timestamp || '--:--'}] ${l.speaker}: ${l.original}`)
    .join('\n')

  const prompt = `Bạn là AI phân tích hội thoại theo thời gian thực (Real-time Conversation Copilot).
Dưới đây là các mẩu transcript gần nhất từ phiên ${
    mode === 'interview' ? 'Phỏng vấn (Interview)' : 'Thảo luận cuộc họp (Meeting Discussion)'
  }.
Do hệ thống nhận diện giọng nói (STT) thu âm ngắt quãng theo từng giây, lời nói của người tham gia BỊ TÁCH THÀNH NHIỀU MẨU NGẮN (fragments).

Transcript các câu thoại gần nhất:
${formattedTranscript}

Nhiệm vụ của bạn:
Quét toàn bộ transcript gần nhất ở trên và xác định chính xác NỘI DUNG TRAO ĐỔI GẦN NHẤT ${
    mode === 'interview'
      ? '(ưu tiên câu hỏi gần nhất của người phỏng vấn/Interviewer)'
      : '(câu hỏi hoặc ý kiến phát biểu gần nhất của người đang trao đổi)'
  }.

QUY TẮC BẮT BUỘC:
1. LẤY NGUYÊN VĂN BẰNG NGÔN NGỮ GỐC (ORIGINAL LANGUAGE):
   - Người nói phát biểu bằng tiếng Anh thì trả về TIẾNG ANH GỐC.
   - Người nói phát biểu bằng tiếng Việt thì trả về TIẾNG VIỆT GỐC.
   - TUYỆT ĐỐI KHÔNG DỊCH sang tiếng Việt nếu phát biểu gốc là tiếng Anh.
2. GHÉP NỐI ĐOẠN NGẮT QUÃNG VÀ LOẠI BỎ THẺ TIẾNG ỒN:
   - Tự động ghép nối các mẩu ngắt quãng liên tiếp của cùng một câu/lượt nói thành một câu hoàn chỉnh, liền mạch, có nghĩa.
   - Loại bỏ các từ lặp lại do STT bắt trùng giữa hai lần ngắt âm.
   - Loại bỏ các thẻ âm thanh như (laughing), (cười), [applause], (music)...
3. CHỈ TRẢ VỀ DUY NHẤT MỘT CÂU:
   - TEXT phải là ĐÚNG MỘT CÂU duy nhất — câu mới nhất vừa được nói.
   - KHÔNG gộp nhiều câu, KHÔNG tóm tắt, KHÔNG thêm bình luận.
   - KHÔNG dịch: nếu người nói dùng tiếng Anh thì giữ nguyên tiếng Anh.
4. PHÂN BIỆT CÂU HỎI VÀ CÂU CHIA SẺ (IS_QUESTION):
   - Trả về "true": nếu nội dung là câu hỏi, câu chào hỏi thăm (vd: "How are you?", "Bạn khỏe không?"), câu hỏi xin ý kiến/làm rõ, hoặc câu nói cần người nghe phản hồi.
   - Trả về "false": nếu nội dung là câu phát biểu, chia sẻ thông tin, nhận định, giải thích, thông báo (vd: "Tôi nghĩ nên dùng Redis", "Hệ thống đã triển khai xong").
5. ĐỊNH DẠNG TRẢ VỀ (chỉ 3 dòng sau, không thêm markdown hay giải thích):
SPEAKER: <tên người nói trong transcript>
IS_QUESTION: <true hoặc false>
TEXT: <đúng một câu, nguyên văn ngôn ngữ gốc>`

  try {
    const rawRes = await callUniversalLLM(prompt, {
      maxTokens: 250,
      temperature: 0.1,
      systemPrompt:
        'You are a real-time conversation analyst. Always extract the latest exchange in its exact original language without translating. Output in the specified key-value format.',
    })

    if (!rawRes || !rawRes.text) {
      return heuristic
    }

    const clean = stripCodeFences(rawRes.text).trim()
    const speakerMatch = clean.match(/SPEAKER:\s*([^\n\r]+)/i)
    const isQMatch = clean.match(/IS_QUESTION:\s*(true|false)/i)
    const textMatch = clean.match(/TEXT:\s*([\s\S]*?)(?=\n\s*[A-Z_]+:|$)/i)

    let extractedText = ''
    let speaker = heuristic?.speaker || 'Speaker'
    let isQuestion = heuristic?.isQuestion ?? false

    if (textMatch && textMatch[1].trim()) {
      // Vẫn cắt về đúng 1 câu phòng khi model trả nhiều câu.
      extractedText = takeLastSentence(textMatch[1])
      if (speakerMatch && speakerMatch[1].trim()) {
        speaker = speakerMatch[1].trim()
      }
      const ruleBasedIsQ = isQuestionUtterance(extractedText)
      if (ruleBasedIsQ) {
        // Nếu cú pháp hoặc dấu câu thể hiện câu hỏi -> chắc chắn true,
        // không để phán đoán nhầm "false" của LLM ghi đè.
        isQuestion = true
      } else if (isQMatch) {
        // Nếu cú pháp không phát hiện được (câu hỏi gián tiếp), dùng phán đoán ngữ cảnh của LLM.
        isQuestion = isQMatch[1].toLowerCase() === 'true'
      } else {
        isQuestion = false
      }
    } else {
      // LLM returned raw text without the key tags
      extractedText = takeLastSentence(
        clean
          .replace(/^SPEAKER:.*$/im, '')
          .replace(/^IS_QUESTION:.*$/im, '')
          .trim()
      )
      isQuestion = isQuestionUtterance(extractedText)
    }

    if (extractedText) {
      return {
        original: extractedText,
        speaker: speaker || heuristic?.speaker || 'Speaker',
        timestamp: heuristic?.timestamp || '',
        isQuestion,
        isAiScanned: true,
        sourceLineCount: lines.length,
      }
    }
  } catch (err) {
    console.warn('[scanLatestExchangeWithAI] LLM scan failed, using heuristic:', err)
  }

  return heuristic
}
