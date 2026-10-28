import {
  computeCacheKey,
  cvAnalysisInFlight,
  cvAnalysisMemoryCache,
  discussionAnalysisInFlight,
  discussionAnalysisMemoryCache,
  getCachedCvAnalysis,
  getCachedDiscussionAnalysis,
} from './cache'
import { callUniversalLLM } from '../llm'

/**
 * 1. Phân tích ngầm CV ứng viên (Background Analysis for Interview)
 * STRICTLY ONCE GUARANTEE:
 * - Check in-memory Map cache
 * - Check sessionStorage
 * - Deduplicate in-flight Promises
 *
 * Returns '' when the LLM is unreachable — no local mock analysis is produced,
 * because a fabricated "analysis" would silently poison every later prompt.
 */
export async function analyzeCvBackground(cvText: string, jdText?: string): Promise<string> {
  if (!cvText || !cvText.trim()) return ''
  const key = computeCacheKey('cv', `${cvText.trim()}:::${(jdText || '').trim()}`)

  // 1. Check memory cache or sessionStorage
  const cached = getCachedCvAnalysis(cvText, jdText)
  if (cached) {
    console.log('[backgroundAnalysis] CV analysis hit cache (strictly once):', key)
    return cached
  }

  // 2. Check in-flight promise to prevent concurrent duplicate calls
  if (cvAnalysisInFlight.has(key)) {
    console.log('[backgroundAnalysis] CV analysis waiting for in-flight promise:', key)
    return cvAnalysisInFlight.get(key)!
  }

  // 3. Launch single LLM execution
  const promise = (async () => {
    try {
      console.log('[backgroundAnalysis] Running single background CV analysis with active LLM...')
      const prompt = `Bạn là chuyên gia tuyển dụng cao cấp. Hãy phân tích nhanh hồ sơ CV này thành 3 điểm cốt lõi để làm bối cảnh hỗ trợ ứng viên trả lời phỏng vấn:
CV:
${cvText}
${jdText ? `\nJD Mục tiêu:\n${jdText}` : ''}

Định dạng trả về ngắn gọn:
• Thế mạnh & Kỹ năng then chốt: ...
• Dự án & Số liệu thực chiến nổi bật: ...
• Định hướng luận điểm phỏng vấn: ...`

      const res = await callUniversalLLM(prompt, { maxTokens: 350, temperature: 0.2 })
      const result = res && res.text.trim() ? res.text.trim() : ''
      if (!result) return ''

      cvAnalysisMemoryCache.set(key, result)
      try {
        sessionStorage.setItem(`bg_cache_${key}`, result)
      } catch {}
      return result
    } finally {
      cvAnalysisInFlight.delete(key)
    }
  })()

  cvAnalysisInFlight.set(key, promise)
  return promise
}

/**
 * 2. Phân tích ngầm ngữ cảnh thảo luận (Background Analysis for Discussion)
 * STRICTLY ONCE GUARANTEE:
 * - Check in-memory Map cache
 * - Check sessionStorage
 * - Deduplicate in-flight Promises
 *
 * Returns '' when the LLM is unreachable (see note above).
 */
export async function analyzeDiscussionBackground(topicText: string): Promise<string> {
  if (!topicText || !topicText.trim()) return ''
  const key = computeCacheKey('disc', topicText.trim())

  const cached = getCachedDiscussionAnalysis(topicText)
  if (cached) {
    console.log('[backgroundAnalysis] Discussion analysis hit cache (strictly once):', key)
    return cached
  }

  if (discussionAnalysisInFlight.has(key)) {
    console.log('[backgroundAnalysis] Discussion analysis waiting for in-flight promise:', key)
    return discussionAnalysisInFlight.get(key)!
  }

  const promise = (async () => {
    try {
      console.log('[backgroundAnalysis] Running single background Discussion analysis with active LLM...')
      const prompt = `Phân tích nhanh ngữ cảnh chủ đề thảo luận kỹ thuật này thành 3 điểm then chốt:
Chủ đề & Ngữ cảnh:
${topicText}

Định dạng trả về ngắn gọn:
• Trọng tâm kỹ thuật cốt lõi: ...
• Ràng buộc & Trade-off cần chú ý: ...
• Định hướng giải pháp kiến trúc: ...`

      const res = await callUniversalLLM(prompt, { maxTokens: 350, temperature: 0.2 })
      const result = res && res.text.trim() ? res.text.trim() : ''
      if (!result) return ''

      discussionAnalysisMemoryCache.set(key, result)
      try {
        sessionStorage.setItem(`bg_cache_${key}`, result)
      } catch {}
      return result
    } finally {
      discussionAnalysisInFlight.delete(key)
    }
  })()

  discussionAnalysisInFlight.set(key, promise)
  return promise
}
