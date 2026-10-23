import type { AIModelConfig, STTEngineConfig } from './types'
import {
  extractVersion,
  extractParamSize,
  isNonChatModel,
  isReasoningModel,
  isCodingModel,
  isFastTierModel,
  isProTierModel,
  cleanAndFormatDisplayName,
  formatContextTokens,
  generateDynamicRecommendation,
  calculateDynamicModelScore,
} from './modelHeuristics'

export interface GroqRawModel {
  id: string
  object?: string
  created?: number
  owned_by?: string
  active?: boolean
  context_window?: number
  context_length?: number
  name?: string
  input_modalities?: string[]
  output_modalities?: string[]
  supported_features?: string[]
}

/**
 * Fetch and format real usable Models from Groq API (STT Whisper + LPU LLMs).
 * 100% Dynamic & Heuristic: Automatically adapts to future models (Llama 4, Qwen 4, GPT OSS 2...).
 */
export async function fetchGroqModels(apiKey: string): Promise<AIModelConfig[]> {
  const trimmed = apiKey.trim()
  if (!trimmed) throw new Error('Vui lòng nhập Groq API Key')

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${trimmed}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message || `Lỗi Groq API (${res.status})`)
  }

  const data = await res.json()
  const rawModels: GroqRawModel[] = data.data || []

  // 1. Tự động nhận diện STT Whisper Models trực tiếp từ API response
  const whisperModels = rawModels.filter((m) => {
    const low = m.id.toLowerCase()
    return low.includes('whisper') || (Array.isArray(m.output_modalities) && m.output_modalities.includes('transcription'))
  })

  if (whisperModels.length > 0) {
    const sttConfigs: STTEngineConfig[] = whisperModels.map((m) => {
      const isTurbo = m.id.toLowerCase().includes('turbo')
      const formattedName = cleanAndFormatDisplayName(m.id, m.name, 'Groq')
      const latencyMs = isTurbo ? 180 : 240
      return {
        id: m.id,
        name: isTurbo ? `${formattedName} (LPU Siêu Tốc ~180ms)` : `${formattedName} (LPU Cloud ~240ms)`,
        provider: 'Groq' as const,
        badge: isTurbo ? 'LPU Turbo (~180ms)' : 'LPU Cloud (~240ms)',
        description: `Nhận diện giọng nói siêu tốc trên phần cứng chip Groq LPU qua model ${m.id}.`,
        requiresKey: 'groq' as const,
        latencyMs,
        recommendedFor: isTurbo
          ? 'Tốc độ phản hồi cực nhanh ~180ms, độ trễ thấp nhất cho phụ đề trực tiếp & hội thoại thời gian thực.'
          : 'Độ chính xác nhận diện cao, xử lý song ngữ và đa ngôn ngữ chuẩn xác trên đám mây Groq.',
        tier: 'Pro' as const,
      }
    })
    try {
      localStorage.setItem('cached_groq_stt_models', JSON.stringify(sttConfigs))
    } catch {}
  } else {
    try {
      localStorage.removeItem('cached_groq_stt_models')
    } catch {}
  }

  // 2. Lọc động: Chỉ giữ lại các model Chat LLM, loại bỏ âm thanh/speech, guardrail, embedding
  const usableChatModels = rawModels.filter((m) => {
    if (!m.id) return false
    const rawCtx = m.context_window || m.context_length
    return !isNonChatModel(m.id, m.output_modalities, rawCtx)
  })

  // 3. Chuyển đổi và phân tích đặc tính hoàn toàn tự động
  const parsedModels = usableChatModels.map((m) => {
    const id = m.id
    const version = extractVersion(id)
    const paramSize = extractParamSize(id)

    const isReasoning = isReasoningModel(id, m.supported_features)
    const isCoding = isCodingModel(id)
    const isFast = isFastTierModel(id, paramSize)
    const isPro = isProTierModel(id, paramSize) || (paramSize !== null && paramSize >= 65)

    const rawCtx = m.context_window || m.context_length
    const contextWindow = formatContextTokens(rawCtx, '128k tokens')
    const displayName = cleanAndFormatDisplayName(id, m.name, 'Groq')

    // Tốc độ siêu việt trên chip Groq LPU
    const pingMs = isFast ? 45 : isPro ? 115 : 75

    const recommendedFor = generateDynamicRecommendation({
      isReasoning,
      isCoding,
      isFast,
      isPro,
      version,
      paramSize,
      provider: 'Groq LPU',
      hardwareType: 'LPU',
    })

    const score = calculateDynamicModelScore({
      id,
      version,
      paramSize,
      isReasoning,
      isPro,
      isFast,
    })

    const tier: 'Free' | 'Pro' = isPro ? 'Pro' : 'Free'
    const badgeColor = isReasoning ? 'indigo' : isPro ? 'violet' : isFast ? 'emerald' : 'amber'

    const config: AIModelConfig = {
      id,
      name: displayName,
      provider: 'Groq' as const,
      tier,
      badgeColor,
      contextWindow,
      pingMs,
      description: `Mô hình ${displayName} chạy trên chip LPU chuyên dụng siêu tốc (${contextWindow}).`,
      recommendedFor,
      isLiveFromAPI: true,
    }

    return { config, score }
  })

  // 4. Sắp xếp thông minh: Tự động đưa model tham số lớn (120B, 70B), Reasoning, phiên bản mới lên đầu
  parsedModels.sort((a, b) => b.score - a.score)

  return parsedModels.map((p) => p.config)
}

/**
 * Verify Groq Key (Enables Groq Whisper STT + Groq LLMs)
 */
export async function verifyGroqKey(
  apiKey: string
): Promise<{ valid: boolean; message: string; modelCount?: number; models?: AIModelConfig[] }> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return { valid: false, message: 'Vui lòng nhập Groq API Key.' }
  }

  try {
    const models = await fetchGroqModels(trimmed)
    return {
      valid: true,
      message: `Key hợp lệ! Đã nạp Groq Whisper (STT) + ${models.length} model LLM trên chip LPU.`,
      modelCount: models.length,
      models,
    }
  } catch (err) {
    return {
      valid: false,
      message: (err as Error).message || 'Không thể kết nối đến máy chủ Groq.',
    }
  }
}
