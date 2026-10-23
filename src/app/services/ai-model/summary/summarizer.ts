import { callUniversalLLM } from '../copilot/universalLlm'
import type { AppMode } from '@/types/electron.d'
import type { SummaryTranscriptItem } from './types'
import {
  languageInstruction,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '../language'

/**
 * Summarize meeting transcripts using the configured LLM
 * (Groq, Gemini, OpenAI).
 *
 * Returns `null` when the LLM is unreachable (missing/invalid API key,
 * offline...). No local mock summary is produced.
 */
export async function summarizeMeetingTranscripts(
  lines: SummaryTranscriptItem[],
  mode: AppMode,
  language?: ResponseLanguage
): Promise<string | null> {
  if (!lines || lines.length === 0) return null

  const lang = normalizeResponseLanguage(language)
  const english = lang !== 'vi'

  // Format transcript conversation
  const conversation = lines
    .map(
      (l) =>
        `[${l.timestamp}] ${l.speaker}: ${l.original}${
          l.translated && l.translated !== l.original ? ` -> ${l.translated}` : ''
        }`
    )
    .join('\n')

  const headings = english
    ? {
        intro: `You are a professional AI meeting secretary (Meeting Copilot).
Read the whole transcript below and produce a concise, insightful summary for a ${
          mode === 'interview' ? 'job interview' : 'technical discussion'
        } session.`,
        core: '📌 Core summary:',
        coreHint: '(1-2 sentences capturing the main topic and problem discussed)',
        points: '🎯 Key points:',
        p1: '(Most important point discussed, or the standout question/answer)',
        p2: '(Second point, or analysis of a solution / real-world experience)',
        p3: '(Third point, or a technical caveat / risk worth flagging)',
        next: '⚡ Conclusions & Next steps:',
        nextHint: '(What was agreed, or what should happen next)',
        transcript: 'Meeting transcript:',
      }
    : {
        intro: `Bạn là trợ lý AI thư ký cuộc họp chuyên nghiệp (Meeting Copilot).
Hãy đọc kỹ toàn bộ transcript sau và tạo bản tóm tắt nội dung súc tích, chuyên sâu, đúng trọng tâm cho phiên ${
          mode === 'interview' ? 'Phỏng vấn (Interview)' : 'Thảo luận kỹ thuật (Discussion)'
        }.`,
        core: '📌 Tóm lược cốt lõi:',
        coreHint: '(1-2 câu ngắn gọn khái quát nội dung và vấn đề chính của cuộc trao đổi)',
        points: '🎯 Các luận điểm chính:',
        p1: '(Ý quan trọng thứ nhất được thảo luận hoặc câu hỏi/câu trả lời nổi bật)',
        p2: '(Ý quan trọng thứ hai hoặc phân tích giải pháp/kinh nghiệm thực tế)',
        p3: '(Ý quan trọng thứ ba hoặc lưu ý kỹ thuật/rủi ro cần chú ý)',
        next: '⚡ Kết luận & Hành động (Next steps):',
        nextHint: '(Thống nhất chốt lại hoặc điểm cần làm tiếp theo)',
        transcript: 'Transcript cuộc họp:',
      }

  const prompt = `${headings.intro}

${languageInstruction(lang)}

Định dạng trả về bắt buộc / Required output format:
${headings.core}
${headings.coreHint}

${headings.points}
• ${headings.p1}
• ${headings.p2}
• ${headings.p3}

${headings.next}
• ${headings.nextHint}

${headings.transcript}
${conversation}`

  // Call the universal LLM (respects user's active provider selection)
  const llmRes = await callUniversalLLM(prompt, {
    maxTokens: 700,
    temperature: 0.3,
    systemPrompt: english
      ? 'You are an excellent AI meeting secretary. Always return the summary in the required format, with no extra greetings.'
      : 'Bạn là AI thư ký cuộc họp xuất sắc. Luôn trả về tóm tắt đúng định dạng chuẩn, không kèm lời chào hỏi thừa.',
  })

  if (llmRes && llmRes.text.trim()) return llmRes.text.trim()

  return null
}
