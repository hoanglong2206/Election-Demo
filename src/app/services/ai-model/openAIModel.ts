import type { AIModelConfig } from './types'
import {
  extractVersion,
  extractParamSize,
  isNonChatModel,
  isReasoningModel,
  isCodingModel,
  isFastTierModel,
  isProTierModel,
  cleanAndFormatDisplayName,
  generateDynamicRecommendation,
  calculateDynamicModelScore,
} from './modelHeuristics'

export interface OpenAIRawModel {
  id: string
  object?: string
  created?: number
  owned_by?: string
}

/**
 * Filter and format real usable Chat / Reasoning models from OpenAI API.
 * 100% Dynamic & Heuristic: No hardcoded model string ladders.
 */
export async function fetchOpenAIModels(apiKey: string): Promise<AIModelConfig[]> {
  const trimmed = apiKey.trim()
  if (!trimmed) throw new Error('Vui lòng nhập OpenAI API Key')

  const res = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${trimmed}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message || `Lỗi OpenAI API (${res.status})`)
  }

  const data = await res.json()
  const rawModels: OpenAIRawModel[] = data.data || []

  // 1. Lọc động: Loại bỏ TTS, Whisper, Realtime, Image, Embeddings, Moderation
  const usableModels = rawModels.filter((m) => {
    if (!m.id) return false
    return !isNonChatModel(m.id)
  })

  // 2. Chuyển đổi và phân tích đặc tính hoàn toàn tự động
  const parsedModels = usableModels.map((m) => {
    const id = m.id
    const version = extractVersion(id)
    const paramSize = extractParamSize(id)

    const isReasoning = isReasoningModel(id)
    const isCoding = isCodingModel(id)
    const isFast = isFastTierModel(id, paramSize)
    const isPro = isProTierModel(id, paramSize) || (!isFast && version >= 4.0)

    // Context Window tự động suy luận theo thế hệ model
    const contextWindow =
      version >= 6.0
        ? '512k tokens'
        : version >= 5.0
        ? '256k tokens'
        : isReasoning
        ? '200k tokens'
        : version >= 4.0
        ? '128k tokens'
        : '16k tokens'

    // Latency ước tính tự động theo nhóm tốc độ
    const pingMs = isFast
      ? 190
      : isReasoning
      ? 620
      : isPro
      ? 460
      : 320

    const displayName = cleanAndFormatDisplayName(id, undefined, 'OpenAI')

    const recommendedFor = generateDynamicRecommendation({
      isReasoning,
      isCoding,
      isFast,
      isPro,
      version,
      paramSize,
      provider: 'OpenAI',
      hardwareType: 'Cloud',
    })

    const score = calculateDynamicModelScore({
      id,
      version,
      paramSize,
      isReasoning,
      isPro,
      isFast,
    })

    const tier: 'Free' | 'Pro' = isFast ? 'Free' : 'Pro'
    const badgeColor = isReasoning ? 'indigo' : isFast ? 'emerald' : 'violet'

    const config: AIModelConfig = {
      id,
      name: displayName,
      provider: 'OpenAI' as const,
      tier,
      badgeColor,
      contextWindow,
      pingMs,
      description: `Mô hình ${displayName} (${contextWindow}) từ OpenAI API.`,
      recommendedFor,
      isLiveFromAPI: true,
    }

    return { config, score }
  })

  // 3. Sắp xếp thông minh: Tự động đưa thế hệ mới nhất (GPT-6, GPT-5, O-series) lên đầu
  parsedModels.sort((a, b) => b.score - a.score)

  // Giữ lại tới 45 model chất lượng cao nhất
  return parsedModels.slice(0, 45).map((p) => p.config)
}

/**
 * Verify OpenAI API Key
 */
export async function verifyOpenAIKey(
  apiKey: string
): Promise<{ valid: boolean; message: string; modelCount?: number; models?: AIModelConfig[] }> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return { valid: false, message: 'Vui lòng nhập OpenAI API Key.' }
  }

  try {
    const models = await fetchOpenAIModels(trimmed)
    return {
      valid: true,
      message: `Key hợp lệ! Đã nhận diện OpenAI GPT (${models.length} model sẵn sàng).`,
      modelCount: models.length,
      models,
    }
  } catch (err) {
    return {
      valid: false,
      message: (err as Error).message || 'Không thể xác thực OpenAI API Key.',
    }
  }
}
