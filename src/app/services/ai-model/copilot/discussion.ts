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
import {
  hasRepetitiveDegeneration,
  pruneRepetitiveTail,
} from './repetitionGuard'

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
    ? `Người tham gia vừa ĐẶT CÂU HỎI:
"${latestLine}"

${shared}

Vì họ vừa đặt CÂU HỎI, hãy soạn 3 phương án TRẢ LỜI để phản hồi ngay. Ba phương án tiếp cận:
- Phương án 1: Trả lời trực diện vào đúng câu hỏi, dựa trên nội dung đang thảo luận.
- Phương án 2: Trả lời kèm phân tích đánh đổi/rủi ro của chính phương án đang bàn trong transcript.
- Phương án 3: Trả lời kèm ví dụ, kinh nghiệm thực chiến hoặc bước kiểm chứng cụ thể cho nội dung đang bàn.

Cấu trúc trả về (đúng 3 khối @@@ như mẫu trên):`
    : `Người tham gia vừa PHÁT BIỂU Ý KIẾN (không phải câu hỏi):
"${latestLine}"

${shared}

Vì họ vừa PHÁT BIỂU, hãy soạn 3 CÂU HỎI GỢI Ý để hỏi lại hoặc dẫn dắt thảo luận tiếp. Ba câu hỏi tiếp cận:
- Câu 1: Làm rõ một chi tiết còn mơ hồ trong chính phát biểu vừa rồi.
- Câu 2: Đào sâu rủi ro/đánh đổi của đúng giải pháp đang được bàn.
- Câu 3: Đề xuất bước tiếp theo cụ thể cho nội dung đang bàn.

Cấu trúc trả về (đúng 3 khối @@@ như mẫu trên):`

  // Without any real context there is nothing to ground on — bail out instead
  // of letting the model invent a generic agenda.
  if (!hasContext && !latestLine.trim()) return null

  const systemPrompt =
    'Bạn là AI trợ lý cố vấn cuộc họp chuyên nghiệp. Nhiệm vụ của bạn là đưa ra đúng 3 phương án phản hồi súc tích, bám sát diễn biến thực tế. Tuyệt đối không lặp lại câu từ hướng dẫn trong câu trả lời.'

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 1000,
    temperature: 0.25,
    systemPrompt,
    sessionId,
    feature: 'copilot_discussion',
  })
  if (!rawRes) return null

  let text = stripCodeFences(rawRes.text)
  if (!text) return null

  // Guard against prompt echoing / loop degeneration
  if (hasRepetitiveDegeneration(text)) {
    console.warn('[discussion] LLM output exhibited loop degeneration or prompt echo. Retrying...')
    const retryRes = await callUniversalLLM(prompt, {
      maxTokens: 1000,
      temperature: 0.35,
      systemPrompt,
      sessionId,
      feature: 'copilot_discussion',
    })
    if (retryRes) {
      const retryText = stripCodeFences(retryRes.text)
      if (retryText && !hasRepetitiveDegeneration(retryText)) {
        text = retryText
      }
    }
  }

  const contextUsage = {
    totalTokens: assembled.estimatedTokens.total,
    maxBudget: assembled.tokenBudget.totalMax,
    usagePercent: assembled.usagePercent,
    breakdown: assembled.estimatedTokens,
  }

  // Parsing chain: delimited format -> JSON -> rescue of malformed JSON.
  const rawParsed = parseOptionResponse(text) ?? []
  const parsed = rawParsed
    .map((o) => ({
      ...o,
      content: pruneRepetitiveTail(o.content.trim()),
    }))
    .filter((o) => o.content.trim() && !hasRepetitiveDegeneration(o.content))

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

  // Refuse truncated JSON or output infected with repetitive loop / prompt echo
  if (rawRes.truncated || looksLikeJson(text) || hasRepetitiveDegeneration(text)) {
    console.warn('[discussion] LLM returned truncated, unparseable, or degenerate output — refusing to render it raw')
    return null
  }

  // Clean prose answer (model ignored the format) — keep its real output if not degenerate.
  const cleanProse = pruneRepetitiveTail(text)
  if (!cleanProse || hasRepetitiveDegeneration(cleanProse)) {
    return null
  }

  return [
    {
      id: 1,
      type: 'option',
      label: isQuestion ? 'Phương án trả lời' : 'Câu hỏi gợi ý',
      content: cleanProse,
      confidence: 95,
      modelName: rawRes.modelName,
      isRealLLM: true,
      contextUsage,
    },
  ]
}
