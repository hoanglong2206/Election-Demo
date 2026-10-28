import { callUniversalLLM } from '../llm'

/**
 * Translate an AI answer into Vietnamese on demand.
 *
 * Used by the bilingual response mode: the model is asked for English only, and
 * every rendered answer exposes a "Dịch" button that calls this function.
 *
 * Returns `null` when the LLM is unreachable (missing/invalid API key...).
 */
export async function translateToVietnamese(text: string): Promise<string | null> {
  const source = text.trim()
  if (!source) return null

  const prompt = `Dịch nội dung sau sang TIẾNG VIỆT.

YÊU CẦU:
- Dịch chính xác, tự nhiên, giữ nguyên ý nghĩa và sắc thái của bản gốc.
- Giữ nguyên cấu trúc trình bày: gạch đầu dòng, đánh số, xuống dòng, tiêu đề.
- Giữ nguyên thuật ngữ kỹ thuật thông dụng (WebSocket, Redis, cache, latency, read receipt...) hoặc ghi kèm bản dịch trong ngoặc khi cần.
- KHÔNG thêm lời dẫn, không giải thích, không nhắc lại yêu cầu. Chỉ trả về đúng bản dịch.

NỘI DUNG CẦN DỊCH:
${source}`

  const res = await callUniversalLLM(prompt, {
    maxTokens: 1400,
    temperature: 0.1,
    systemPrompt:
      'Bạn là biên dịch viên kỹ thuật Anh–Việt chính xác. Chỉ trả về bản dịch, không kèm gì khác.',
  })

  const out = res?.text.trim()
  return out || null
}
