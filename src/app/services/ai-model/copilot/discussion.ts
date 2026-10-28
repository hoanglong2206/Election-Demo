import type { CopilotDiscussionOption } from './types'
import { callUniversalLLM } from '../llm'
import type { PromptTranscriptLine } from './transcript'
import { parseOptionResponse, looksLikeJson, stripCodeFences } from './parseOptions'
import {
  languageInstruction,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '../language'
import { tieredContextManager, TieredContextManager } from '../context'

/**
 * Generates options for discussion mode using 4-Tier Context Architecture.
 */
export async function generateDiscussionOptions(params: {
  latestLine: string
  isQuestion: boolean
  meetingSummary: string
  discussionContext?: string
  backgroundAnalysis?: string
  transcriptLines?: PromptTranscriptLine[]
  language?: ResponseLanguage
  contextManager?: TieredContextManager
  sessionId?: string
}): Promise<CopilotDiscussionOption[] | null> {
  const {
    latestLine,
    isQuestion,
    meetingSummary,
    discussionContext,
    backgroundAnalysis,
    transcriptLines,
    contextManager,
    sessionId,
  } = params
  const lang = normalizeResponseLanguage(params.language)

  const cm = contextManager || tieredContextManager
  cm.setPermanentContext({
    discussionTopic: discussionContext,
    meetingObjective: discussionContext,
    backgroundAnalysis,
  })
  if (transcriptLines) {
    cm.setTranscriptLines(transcriptLines)
  }

  const assembled = cm.assembleContext(latestLine, 'discussion')
  const hasContext = Boolean(assembled.fullPromptContext.trim() || latestLine.trim())

  const shared = `NGỮ CẢNH CUỘC HỌP
${assembled.fullPromptContext}

${meetingSummary?.trim() ? `Tóm tắt cuộc họp bổ sung:\n${meetingSummary.trim()}\n` : ''}

QUY TẮC BẮT BUỘC:
- Mọi nội dung phải bám SÁT các tầng ngữ cảnh ở trên. Nêu đúng tên hệ thống, công nghệ, tính năng, con số đã được nhắc tới.
- TUYỆT ĐỐI KHÔNG đề cập tới hiệu năng/QPS/latency, chi phí hạ tầng, PoC/benchmark, redundancy... nếu ngữ cảnh KHÔNG hề nói tới các chủ đề đó.
- Không dùng câu hỏi hay lời khuyên chung chung kiểu "cần xác định ràng buộc", "cần làm PoC". Phải cụ thể cho chính cuộc hội thoại này.
${languageInstruction(lang)}

ĐỊNH DẠNG TRẢ VỀ (bắt buộc, KHÔNG dùng JSON, KHÔNG thêm ký tự \`\`\`):
Viết đúng 3 khối, mỗi khối bắt đầu bằng một dòng chỉ có @@@ rồi tới 3 dòng LABEL / CONFIDENCE / CONTENT.
Tuyệt đối không dùng dấu ngoặc kép bao quanh giá trị.

@@@
LABEL: nhãn ngắn gọn 4-8 từ
CONFIDENCE: 95
CONTENT: nội dung đầy đủ viết liền trên một dòng
@@@
LABEL: nhãn ngắn gọn 4-8 từ
CONFIDENCE: 91
CONTENT: nội dung đầy đủ viết liền trên một dòng
@@@
LABEL: nhãn ngắn gọn 4-8 từ
CONFIDENCE: 88
CONTENT: nội dung đầy đủ viết liền trên một dòng`

  const prompt = isQuestion
    ? `Bạn là AI trợ lý cố vấn trong cuộc họp. Người tham gia vừa ĐẶT CÂU HỎI:
"${latestLine}"

${shared}

Vì họ vừa đặt CÂU HỎI, hãy soạn 3 phương án TRẢ LỜI để tôi chọn và phản hồi ngay. Ba phương án phải khác nhau về góc tiếp cận:
- Phương án 1: Trả lời trực diện vào đúng câu hỏi, dựa trên nội dung đang thảo luận.
- Phương án 2: Trả lời kèm phân tích đánh đổi/rủi ro của chính phương án đang bàn trong transcript.
- Phương án 3: Trả lời kèm ví dụ, kinh nghiệm thực chiến hoặc bước kiểm chứng cụ thể cho nội dung đang bàn.

Điền nội dung của 3 phương án đó vào đúng định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh).`
    : `Bạn là AI trợ lý cố vấn trong cuộc họp. Người tham gia vừa PHÁT BIỂU Ý KIẾN (không phải câu hỏi):
"${latestLine}"

${shared}

Vì họ vừa PHÁT BIỂU, hãy soạn 3 CÂU HỎI GỢI Ý để tôi hỏi lại hoặc dẫn dắt thảo luận tiếp. Ba câu hỏi phải khác nhau về mục đích:
- Câu 1: Làm rõ một chi tiết còn mơ hồ trong chính phát biểu vừa rồi.
- Câu 2: Đào sâu rủi ro/đánh đổi của đúng giải pháp đang được bàn.
- Câu 3: Đề xuất bước tiếp theo cụ thể cho nội dung đang bàn.

Điền nội dung của 3 câu hỏi đó vào đúng định dạng ở trên`

  // Without any real context there is nothing to ground on — bail out instead
  // of letting the model invent a generic agenda.
  if (!hasContext && !latestLine.trim()) return null

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 1000,
    temperature: 0.25,
    sessionId,
    feature: 'copilot_discussion',
  })
  if (!rawRes) return null

  const text = stripCodeFences(rawRes.text)
  if (!text) return null

  const contextUsage = {
    totalTokens: assembled.estimatedTokens.total,
    maxBudget: assembled.tokenBudget.totalMax,
    usagePercent: assembled.usagePercent,
    breakdown: assembled.estimatedTokens,
  }

  // Parsing chain: delimited format -> JSON -> rescue of malformed JSON.
  const parsed = (parseOptionResponse(text) ?? []).filter((o) => o.content.trim())
  if (parsed.length > 0) {
    return parsed.map((o, idx) => ({
      id: idx + 1,
      type: 'option' as const,
      label: o.label?.trim() || (isQuestion ? `Phương án ${idx + 1}` : `Câu hỏi ${idx + 1}`),
      content: o.content.trim(),
      confidence: o.confidence ?? 95 - idx * 4,
      modelName: rawRes.modelName,
      isRealLLM: true,
      contextUsage,
    }))
  }

  // The model answered with JSON we could not parse. Showing that blob raw in
  // the UI is worse than showing an error, so refuse it.
  if (rawRes.truncated || looksLikeJson(text)) {
    console.warn('[discussion] LLM returned truncated or unparseable output — refusing to render it raw')
    return null
  }

  // Genuine prose answer (model ignored the format) — keep its real output.
  return [
    {
      id: 1,
      type: 'option',
      label: isQuestion ? 'Phương án trả lời' : 'Câu hỏi gợi ý',
      content: text,
      confidence: 95,
      modelName: rawRes.modelName,
      isRealLLM: true,
      contextUsage,
    },
  ]
}
