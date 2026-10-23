import { BaseAIProvider } from './base'
import type { DiscoveredModel } from '../types'
import type { STTEngineConfig } from '../../types'
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
} from '../../modelHeuristics'

interface GroqRawModel {
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

export class GroqProvider extends BaseAIProvider {
  readonly id = 'Groq'
  readonly displayName = 'Groq LPU'

  public async listModels(apiKey?: string): Promise<DiscoveredModel[]> {
    const trimmed = apiKey?.trim()
    if (!trimmed) {
      return []
    }

    try {
      const res = await this.safeFetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        return []
      }

      const data = await res.json()
      const rawModels: GroqRawModel[] = Array.isArray(data?.data) ? data.data : []

      // 1. Automatically detect and cache STT Whisper models
      const whisperModels = rawModels.filter((m) => {
        const low = m.id.toLowerCase()
        return (
          low.includes('whisper') ||
          (Array.isArray(m.output_modalities) && m.output_modalities.includes('transcription'))
        )
      })

      if (whisperModels.length > 0 && typeof localStorage !== 'undefined') {
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
      }

      // 2. Filter Chat LLM Models
      const usableChatModels = rawModels.filter((m) => {
        if (!m.id) return false
        const rawCtx = m.context_window || m.context_length
        return !isNonChatModel(m.id, m.output_modalities, rawCtx)
      })

      if (usableChatModels.length === 0) {
        return []
      }

      const now = Date.now()
      const parsedModels: DiscoveredModel[] = usableChatModels.map((m) => {
        const id = m.id
        const version = extractVersion(id)
        const paramSize = extractParamSize(id)

        const isReasoning = isReasoningModel(id)
        const isCoding = isCodingModel(id)
        const isFast = isFastTierModel(id, paramSize)
        const isPro = isProTierModel(id, paramSize)

        const rawTokens = m.context_window || m.context_length
        const contextWindow = formatContextTokens(rawTokens, '128k tokens')
        const displayName = cleanAndFormatDisplayName(id, m.name, 'Groq')

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

        // Check multimodal/vision support
        const low = id.toLowerCase()
        const isVision =
          low.includes('vision') ||
          (Array.isArray(m.input_modalities) &&
            (m.input_modalities.includes('image') || m.input_modalities.includes('vision')))

        const capabilities = this.detectCapabilities(id, {
          supportsVision: isVision,
          isReasoning,
          isCoding,
          isFast: true, // Groq LPUs are ultra-fast
        })

        return {
          id,
          displayName,
          provider: this.id,
          capabilities,
          contextWindow,
          contextTokens: rawTokens || 131072,
          tier: isPro ? ('Pro' as const) : ('Free' as const),
          badgeColor: isVision ? 'amber' : isReasoning ? 'violet' : 'emerald',
          description: `Mô hình ${displayName} chạy trên chip chuyên dụng Groq LPU với tốc độ phản xạ vài trăm tokens/giây.`,
          recommendedFor,
          supportedModalities: isVision ? ['text', 'image'] : ['text'],
          isLiveFromAPI: true,
          lastDiscoveredAt: now,
        }
      })

      return parsedModels.sort((a, b) => {
        const scoreA = calculateDynamicModelScore({
          id: a.id,
          version: extractVersion(a.id),
          paramSize: extractParamSize(a.id),
          isReasoning: a.capabilities.includes('reasoning'),
          isFast: a.capabilities.includes('fast'),
          isPro: a.tier === 'Pro',
        })
        const scoreB = calculateDynamicModelScore({
          id: b.id,
          version: extractVersion(b.id),
          paramSize: extractParamSize(b.id),
          isReasoning: b.capabilities.includes('reasoning'),
          isFast: b.capabilities.includes('fast'),
          isPro: b.tier === 'Pro',
        })
        return scoreB - scoreA
      })
    } catch {
      return []
    }
  }

}
