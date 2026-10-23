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
  formatContextTokens,
  generateDynamicRecommendation,
  calculateDynamicModelScore,
} from './modelHeuristics'

export interface GoogleRawModel {
  name: string
  version?: string
  displayName?: string
  description?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
  supportedGenerationMethods?: string[]
  temperature?: number
  topP?: number
  topK?: number
  maxTemperature?: number
  thinking?: boolean
}

/**
 * Fetch and format real usable Chat / Reasoning models from Google Gemini API.
 * 100% Dynamic & Heuristic: No hardcoded version names or if-else ladders.
 */
export async function fetchGoogleModels(apiKey: string): Promise<AIModelConfig[]> {
  const trimmed = apiKey.trim()
  if (!trimmed) throw new Error('Vui lòng nhập Google Gemini API Key')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message || `Lỗi Google API (${res.status})`)
  }

  const data = await res.json()
  const rawModels: GoogleRawModel[] = data.models || []

  // 1. Lọc động: Chỉ giữ model sinh nội dung Chat, loại bỏ TTS/Audio/Image/Embedding
  const usableModels = rawModels.filter((m) => {
    if (!m.name) return false
    if (isNonChatModel(m.name, undefined, m.inputTokenLimit)) return false
    if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes('generateContent')) {
      return false
    }
    return true
  })

  // 2. Chuyển đổi và phân tích đặc tính hoàn toàn tự động
  const parsedModels = usableModels.map((m) => {
    const cleanId = m.name.replace(/^models\//, '')
    const version = extractVersion(cleanId)
    const paramSize = extractParamSize(cleanId)

    const isReasoning = isReasoningModel(cleanId, undefined, m.thinking)
    const isCoding = isCodingModel(cleanId)
    const isFast = isFastTierModel(cleanId, paramSize)
    const isPro = isProTierModel(cleanId, paramSize)

    const contextWindow = formatContextTokens(m.inputTokenLimit, '1M tokens')
    const displayName = cleanAndFormatDisplayName(cleanId, m.displayName, 'Google')

    const pingMs = isFast
      ? (isReasoning ? 230 : 180)
      : isPro
      ? (isReasoning ? 450 : 380)
      : 280

    const recommendedFor = generateDynamicRecommendation({
      isReasoning,
      isCoding,
      isFast,
      isPro,
      version,
      paramSize,
      provider: 'Google AI',
      hardwareType: 'Cloud',
    })

    const score = calculateDynamicModelScore({
      id: cleanId,
      version,
      paramSize,
      isReasoning,
      isPro,
      isFast,
    })

    const tier: 'Free' | 'Pro' = isPro ? 'Pro' : 'Free'
    const badgeColor = isReasoning ? 'indigo' : isPro ? 'violet' : 'emerald'

    const config: AIModelConfig = {
      id: cleanId,
      name: `${displayName}${isReasoning && !displayName.toLowerCase().includes('thinking') ? ' (Thinking)' : ''}`,
      provider: 'Google' as const,
      tier,
      badgeColor,
      contextWindow,
      pingMs,
      description: m.description || `Mô hình ${displayName} (${contextWindow}) từ Google AI.`,
      recommendedFor,
      isLiveFromAPI: true,
    }

    return { config, score }
  })

  // 3. Sắp xếp thông minh: Tự động đưa phiên bản cao nhất, tính năng mạnh nhất lên đầu
  parsedModels.sort((a, b) => b.score - a.score)

  return parsedModels.map((p) => p.config)
}

/**
 * Verify Google Gemini API Key
 */
export async function verifyGoogleKey(
  apiKey: string
): Promise<{ valid: boolean; message: string; modelCount?: number; models?: AIModelConfig[] }> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return { valid: false, message: 'Vui lòng nhập Google Gemini API Key.' }
  }

  try {
    const models = await fetchGoogleModels(trimmed)
    return {
      valid: true,
      message: `Key hợp lệ! Đã nạp thành công ${models.length} model Google Gemini thực tế.`,
      modelCount: models.length,
      models,
    }
  } catch (err) {
    return {
      valid: false,
      message: (err as Error).message || 'Không thể xác thực Google Gemini API Key.',
    }
  }
}
