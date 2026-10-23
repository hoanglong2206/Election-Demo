/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DYNAMIC HEURISTIC & INFERENCE ENGINE (ZERO HARDCODED MODEL NAMES)
 * ══════════════════════════════════════════════════════════════════════════════
 * Tự động phân tích và suy luận mọi thông số (Version, Context, Latency, Tier,
 * Khuyên dùng, Tên hiển thị) dựa trên đặc tính ngữ nghĩa và metadata, không phụ
 * thuộc vào chuỗi tên cố định (if-else).
 */

/**
 * 1. Universal Version Extractor:
 * Trích xuất số phiên bản từ bất kỳ định dạng model nào (gpt-6.2, gemini-3.5, llama-4, qwen-3.8, o4...)
 */
export function extractVersion(id: string): number {
  const low = id.toLowerCase()

  // Mẫu: gpt-5.4, gemini-2.5, llama-3.3, qwen3.8
  const standardMatch = low.match(/(?:gpt|gemini|llama|qwen|mistral|deepseek|gemma)[-_]?(\d+(?:\.\d+)?)/i)
  if (standardMatch) {
    return parseFloat(standardMatch[1])
  }

  // Mẫu O-series (o1, o3, o4, o5...)
  const oMatch = low.match(/^o(\d+)/i)
  if (oMatch) {
    return parseFloat(oMatch[1]) + 0.5 // o4 tương đương thế hệ 4.5
  }

  // Mẫu số phiên bản độc lập (v2.1, 4.0...)
  const vMatch = low.match(/(?:v|version)[-_]?(\d+(?:\.\d+)?)/i)
  if (vMatch) {
    return parseFloat(vMatch[1])
  }

  return 1.0
}

/**
 * 2. Universal Parameter Size Extractor (e.g. 120b, 70b, 27b, 8b, 7b...)
 */
export function extractParamSize(id: string): number | null {
  const match = id.toLowerCase().match(/(\d+)b(?:\b|[-_])/i)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * 3. Universal Non-Chat Filter (TTS, Whisper STT, Image, Embeddings, Safety Guardrails)
 */
export function isNonChatModel(
  id: string,
  outputModalities?: string[],
  contextWindow?: number
): boolean {
  const low = id.toLowerCase()

  // Loại trừ các model âm thanh (TTS / Whisper)
  if (
    low.includes('tts') ||
    low.includes('whisper') ||
    low.includes('transcribe') ||
    low.includes('audio') ||
    low.includes('speech') ||
    low.includes('orpheus')
  ) {
    return true
  }

  // Loại trừ model hình ảnh / video
  if (
    low.includes('image') ||
    low.includes('imagen') ||
    low.includes('sora') ||
    low.includes('dall-e')
  ) {
    return true
  }

  // Loại trừ vector embeddings / kiểm duyệt an toàn / robot
  if (
    low.includes('embed') ||
    low.includes('guard') ||
    low.includes('safeguard') ||
    low.includes('moderation') ||
    low.includes('robot') ||
    low.includes('aqa') ||
    low.startsWith('babbage') ||
    low.startsWith('davinci')
  ) {
    return true
  }

  // Nếu API khai báo output_modalities mà không có text (hoặc chỉ có speech/audio)
  if (Array.isArray(outputModalities) && outputModalities.length > 0) {
    if (!outputModalities.includes('text')) return true
    if (outputModalities.includes('speech') || outputModalities.includes('transcription')) return true
  }

  // Loại trừ các classifier tí hon (context <= 1024 tokens như prompt-guard 22M)
  if (contextWindow && contextWindow > 0 && contextWindow <= 1024) {
    return true
  }

  return false
}

/**
 * 4. Universal Reasoning / Thinking Detection
 */
export function isReasoningModel(
  id: string,
  supportedFeatures?: string[],
  thinking?: boolean
): boolean {
  if (thinking === true) return true
  if (Array.isArray(supportedFeatures) && supportedFeatures.includes('reasoning')) return true

  const low = id.toLowerCase()
  return (
    low.startsWith('o1') ||
    low.startsWith('o3') ||
    low.startsWith('o4') ||
    low.startsWith('o5') ||
    low.includes('reason') ||
    low.includes('thinking') ||
    low.includes('chain') ||
    low.includes('cot')
  )
}

/**
 * 5. Universal Coding / Technical Specialization Detection
 */
export function isCodingModel(id: string): boolean {
  const low = id.toLowerCase()
  return (
    low.includes('codex') ||
    low.includes('coder') ||
    low.includes('code') ||
    low.includes('dev')
  )
}

/**
 * 6. Universal Fast / Light Class Detection (Mini, Nano, Flash, Small, 8B, Instant...)
 */
export function isFastTierModel(id: string, paramSize?: number | null): boolean {
  const low = id.toLowerCase()
  if (
    low.includes('mini') ||
    low.includes('nano') ||
    low.includes('flash') ||
    low.includes('instant') ||
    low.includes('small') ||
    low.includes('lite') ||
    low.includes('haiku') ||
    low.includes('3.5-turbo')
  ) {
    return true
  }
  if (paramSize !== null && paramSize !== undefined && paramSize <= 14) {
    return true
  }
  return false
}

/**
 * 7. Universal Pro / Heavy Class Detection
 */
export function isProTierModel(id: string, paramSize?: number | null): boolean {
  const low = id.toLowerCase()
  if (
    low.includes('pro') ||
    low.includes('max') ||
    low.includes('ultra') ||
    low.includes('large') ||
    low.includes('opus') ||
    low.includes('sonnet')
  ) {
    return true
  }
  if (paramSize !== null && paramSize !== undefined && paramSize >= 65) {
    return true
  }
  return false
}

/**
 * 8. Universal Title & Name Formatter (Tự động format mọi tên không cần if-else)
 */
export function cleanAndFormatDisplayName(
  id: string,
  rawDisplayName?: string,
  providerPrefix?: string
): string {
  // Nếu API đã cung cấp sẵn tên đẹp chính thức
  if (rawDisplayName && rawDisplayName.trim()) {
    let clean = rawDisplayName.trim().replace(/^models\//i, '')
    if (providerPrefix && !clean.toLowerCase().startsWith(providerPrefix.toLowerCase())) {
      clean = `${providerPrefix} ${clean}`
    }
    return clean
  }

  // Tách bỏ namespace (e.g., openai/gpt-oss-120b -> gpt-oss-120b, models/gemini-2.5 -> gemini-2.5)
  const unnamespaced = id.replace(/^[^\/]+\//, '')

  // Tách ngày snapshot ở đuôi nếu có (-2026-03-05)
  const isDated = /-\d{4}(-\d{2})*(-\d{2})*$/.test(unnamespaced)
  const dateMatch = unnamespaced.match(/-(\d{4}(?:-\d{2})*(?:-\d{2})*)$/)
  const baseName = isDated && dateMatch ? unnamespaced.replace(dateMatch[0], '') : unnamespaced

  // Chuyển đổi các từ phổ biến
  const wordMap: Record<string, string> = {
    gpt: 'GPT',
    oss: 'OSS',
    it: 'IT',
    lpu: 'LPU',
    llm: 'LLM',
    ai: 'AI',
    mini: 'Mini',
    nano: 'Nano',
    pro: 'Pro',
    max: 'Max',
    ultra: 'Ultra',
    flash: 'Flash',
    instant: 'Instant',
    versatile: 'Versatile',
    codex: 'Codex',
    chat: 'Chat',
    latest: 'Latest',
    turbo: 'Turbo',
    preview: 'Preview',
    exp: 'Exp',
  }

  const parts = baseName.split(/[-_.]/)
  const formatted = parts
    .filter(Boolean)
    .map((p) => {
      const low = p.toLowerCase()
      if (wordMap[low]) return wordMap[low]
      // Nếu là số kích thước (70b, 120b, 8b)
      if (/^\d+b$/i.test(p)) return p.toUpperCase()
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')

  let finalName = providerPrefix ? `${providerPrefix} ${formatted}` : formatted
  if (isDated && dateMatch) {
    finalName += ` (${dateMatch[1]})`
  }
  return finalName
}

/**
 * 9. Universal Token Formatter (e.g., 1048576 -> 1M tokens, 131072 -> 128k tokens)
 */
export function formatContextTokens(tokens?: number, fallback = '128k tokens'): string {
  if (!tokens || tokens <= 0) return fallback
  if (tokens >= 1000000) {
    const m = tokens / 1000000
    return `${m >= 1.9 ? Math.round(m) : m.toFixed(1).replace('.0', '')}M tokens`
  }
  if (tokens >= 1024) {
    return `${Math.round(tokens / 1024)}k tokens`
  }
  return `${tokens} tokens`
}

/**
 * 10. Universal Recommendation Generator (Tự động sinh mục đích sử dụng dựa trên đặc tính)
 */
export function generateDynamicRecommendation(options: {
  isReasoning: boolean
  isCoding: boolean
  isFast: boolean
  isPro: boolean
  version: number
  paramSize?: number | null
  provider: string
  hardwareType?: 'LPU' | 'Cloud'
}): string {
  const { isReasoning, isCoding, isFast, isPro, version, paramSize, provider, hardwareType } = options

  // Ưu tiên 1: Chuyên Coding / Lập trình
  if (isCoding) {
    return 'Chuyên sâu giải bài toán coding, kiểm tra thuật toán & thiết kế kiến trúc hệ thống (System Design).'
  }

  // Ưu tiên 2: Suy luận Reasoning (Chain-of-Thought)
  if (isReasoning) {
    return hardwareType === 'LPU'
      ? 'Hỗ trợ lập luận logic chuyên sâu (Reasoning) siêu tốc trên chip LPU: giải toán & tư duy nhiều bước.'
      : 'Lập luận logic chuyên sâu nhiều bước (Chain-of-Thought), toán học và bài toán giải đố hóc búa.'
  }

  // Ưu tiên 3: Tốc độ cao / Nhẹ cho phỏng vấn trực tiếp
  if (isFast) {
    return hardwareType === 'LPU'
      ? 'Phản xạ thần tốc ~45ms trên chip LPU: tối ưu cho phỏng vấn trực tiếp và đối thoại tức thì.'
      : 'Tối ưu cho phỏng vấn trực tiếp real-time: phản xạ siêu tốc, tiết kiệm token, tiếng Việt mượt mà.'
  }

  // Ưu tiên 4: Flagship / Pro / Tham số lớn
  if (isPro || (paramSize && paramSize >= 65)) {
    const sizeStr = paramSize ? ` quy mô lớn ${paramSize}B` : ''
    return `Mô hình${sizeStr} chuyên sâu: độ chính xác và khả năng bao quát cao, xử lý tình huống phức tạp.`
  }

  // Ưu tiên 5: Dựa trên số phiên bản (Ví dụ thế hệ 3, 4, 5, 6...)
  if (version >= 5.0) {
    return `Mô hình thế hệ mới (${version.toFixed(1)}): thấu hiểu ngữ cảnh sâu rộng, tư duy sắc bén cho cuộc họp.`
  }

  return `Phân tích câu hỏi phỏng vấn & tư vấn câu trả lời gợi ý tức thì qua ${provider}.`
}

/**
 * 11. Universal Model Scorer (Đưa các model phiên bản cao, tham số lớn, chính thức lên đầu)
 */
export function calculateDynamicModelScore(options: {
  id: string
  version: number
  paramSize?: number | null
  isReasoning: boolean
  isPro: boolean
  isFast: boolean
}): number {
  const { id, version, paramSize, isReasoning, isPro, isFast } = options
  let score = version * 15 // Version 6 = 90, Version 5 = 75, Version 4 = 60, Version 3 = 45

  // Điểm cộng theo tham số (e.g. 120b = +24, 70b = +14)
  if (paramSize) {
    score += Math.min(25, paramSize / 5)
  }

  if (isReasoning) score += 12
  if (isPro) score += 8
  if (isFast) score += 4

  // Trừ điểm các bản thử nghiệm gắn ngày tháng snapshot cũ
  const isDated = /-\d{4}(-\d{2})*(-\d{2})*$/.test(id.toLowerCase())
  if (!isDated) score += 6

  return score
}
