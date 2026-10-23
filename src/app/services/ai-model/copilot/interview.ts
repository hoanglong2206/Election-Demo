import type { CopilotInterviewResult } from './types'
import { callUniversalLLM } from './universalLlm'
import { looksLikeJson, stripCodeFences } from './parseOptions'
import {
  languageInstruction,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '../language'
import { tieredContextManager, TieredContextManager } from './contextManager'

/**
 * Generates an interview answer personalized to the candidate CV and question.
 * Uses 4-Tier Context Architecture to keep prompt bounded and cost-efficient.
 */
export async function generateInterviewAnswer(params: {
  question: string
  cvSummary: string
  backgroundAnalysis?: string
  transcriptLines?: { speaker: string; original: string; translated?: string }[]
  language?: ResponseLanguage
  contextManager?: TieredContextManager
  sessionId?: string
}): Promise<CopilotInterviewResult | null> {
  const { question, cvSummary, backgroundAnalysis, transcriptLines, sessionId } = params
  const lang = normalizeResponseLanguage(params.language)

  if (!question || !question.trim()) return null

  const cm = params.contextManager || tieredContextManager
  cm.setPermanentContext({
    cvSummary,
    backgroundAnalysis,
  })
  if (transcriptLines) {
    cm.setTranscriptLines(transcriptLines)
  }

  // Assemble 4-tier bounded context
  const assembled = cm.assembleContext(question, 'interview')

  const prompt = `Bạn là AI Cố vấn phỏng vấn xuất sắc (Interview Copilot).
Ứng viên đang tham gia phỏng vấn tuyển dụng.

${assembled.fullPromptContext}

${languageInstruction(lang)}

Yêu cầu phản hồi:
1. Đưa ra câu trả lời phỏng vấn xuất sắc, tự tin, TRẢ LỜI ĐÚNG trọng tâm câu hỏi vừa nêu ở TẦNG 4.
2. Phải nối tiếp mạch hội thoại trong TẦNG 2 & TẦNG 3 ở trên — nếu người phỏng vấn đang hỏi tiếp về một chủ đề đã trao đổi, hãy trả lời nhất quán với những gì đã nói trước đó.
3. Nếu câu hỏi liên quan đến kiến thức/kinh nghiệm có trong CV (TẦNG 1), hãy lồng ghép tự nhiên các dự án thực tế, số liệu cụ thể và kinh nghiệm thực chiến theo phương pháp STAR (Situation, Task, Action, Result).
4. Không bịa ra công nghệ, dự án hay số liệu không có trong CV/transcript.

Trả về chính xác theo định dạng sau:
[FULL_ANSWER]
(Nội dung câu trả lời hoàn chỉnh, chi tiết, chuyên nghiệp)
[SHORT_ANSWER]
(Bản rút gọn súc tích 2-3 gạch đầu dòng các ý chính cần nói)`

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 750,
    temperature: 0.3,
    sessionId,
    feature: 'copilot_interview',
  })
  if (!rawRes) return null

  const text = stripCodeFences(rawRes.text)
  if (!text) return null

  // Label intentionally carries no provider/model annotation — that is already
  // surfaced by the pane header badge and the footer.
  const label = '✨ Trả lời chuẩn STAR'

  // Model ignored the [FULL_ANSWER]/[SHORT_ANSWER] contract — still surface its
  // real output rather than dropping it, unless it is a raw JSON blob (which is
  // never meant to be shown to the user).
  if (!text.includes('[FULL_ANSWER]')) {
    if (looksLikeJson(text)) {
      console.warn('[interview] LLM returned unparseable JSON — refusing to render it raw')
      return null
    }
    const contextUsage = {
      totalTokens: assembled.estimatedTokens.total,
      maxBudget: assembled.tokenBudget.totalMax,
      usagePercent: assembled.usagePercent,
      breakdown: assembled.estimatedTokens,
    }

    return {
      label,
      content: text,
      shortContent: text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n'),
      confidence: 95,
      modelName: rawRes.modelName,
      isRealLLM: true,
      contextUsage,
    }
  }

  const parts = text.split('[SHORT_ANSWER]')
  const full = parts[0].replace('[FULL_ANSWER]', '').trim()
  const short = parts[1] ? parts[1].trim() : full.split('\n').slice(0, 3).join('\n')

  return {
    label,
    content: full,
    shortContent: short,
    confidence: 97,
    modelName: rawRes.modelName,
    isRealLLM: true,
    contextUsage: {
      totalTokens: assembled.estimatedTokens.total,
      maxBudget: assembled.tokenBudget.totalMax,
      usagePercent: assembled.usagePercent,
      breakdown: assembled.estimatedTokens,
    },
  }
}
