import { callUniversalLLM } from '../llm'
import {
  hasRepetitiveDegeneration,
  pruneRepetitiveTail,
} from './repetitionGuard'

/**
 * Translate an AI answer into Vietnamese on demand.
 *
 * Used by the bilingual response mode: the model is asked for English only, and
 * every rendered answer exposes a "Dịch" button that calls this function.
 *
 * Equipped with loop & degeneration guard:
 * - Detects token-level repeating loops (temperature 0.1 degeneration)
 * - Retries with higher temperature if looping occurs
 * - Prunes degenerate tails so UI never displays repetitive loops
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

  // Step 1: Call LLM with stable temperature
  let res = await callUniversalLLM(prompt, {
    maxTokens: 1400,
    temperature: 0.2,
    systemPrompt:
      'Bạn là biên dịch viên kỹ thuật Anh–Việt chính xác. Chỉ trả về bản dịch ngắn gọn, tự nhiên, không lặp lại câu từ.',
    feature: 'translate',
  })

  let out = res?.text.trim() || ''

  // Step 2: Loop detection & single retry with presence penalty / higher temperature
  if (out && hasRepetitiveDegeneration(out)) {
    console.warn('[translateToVietnamese] Detected repetitive degeneration in translation. Retrying with higher temperature...')
    const retryRes = await callUniversalLLM(prompt, {
      maxTokens: 1400,
      temperature: 0.35,
      systemPrompt:
        'Bạn là biên dịch viên Anh–Việt. Dịch thật tự nhiên, dứt khoát. Tuyệt đối không lặp lại từ hoặc cụm từ nhiều lần.',
      feature: 'translate',
    })

    const retryOut = retryRes?.text.trim()
    if (retryOut && !hasRepetitiveDegeneration(retryOut)) {
      out = retryOut
    } else if (retryOut) {
      out = pruneRepetitiveTail(retryOut)
    } else {
      out = pruneRepetitiveTail(out)
    }
  }

  return out || null
}
