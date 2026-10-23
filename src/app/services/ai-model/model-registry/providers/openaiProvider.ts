import { BaseAIProvider } from './base'
import type { DiscoveredModel } from '../types'
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
} from '../../modelHeuristics'

interface OpenAIRawModel {
  id: string
  object?: string
  created?: number
  owned_by?: string
}

export class OpenAIProvider extends BaseAIProvider {
  readonly id = 'OpenAI'
  readonly displayName = 'OpenAI GPT'

  public async listModels(apiKey?: string): Promise<DiscoveredModel[]> {
    const trimmed = apiKey?.trim()
    if (!trimmed) {
      return []
    }

    try {
      const res = await this.safeFetch('https://api.openai.com/v1/models', {
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
      const rawModels: OpenAIRawModel[] = Array.isArray(data?.data) ? data.data : []

      const usableModels = rawModels.filter((m) => {
        if (!m.id) return false
        return !isNonChatModel(m.id)
      })

      if (usableModels.length === 0) {
        return []
      }

      const now = Date.now()
      const parsedModels: DiscoveredModel[] = usableModels.map((m) => {
        const id = m.id
        const version = extractVersion(id)
        const paramSize = extractParamSize(id)

        const isReasoning = isReasoningModel(id)
        const isCoding = isCodingModel(id)
        const isFast = isFastTierModel(id, paramSize)
        const isPro = isProTierModel(id, paramSize) || (!isFast && version >= 4.0)

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

        const contextTokens =
          version >= 6.0
            ? 524288
            : version >= 5.0
            ? 262144
            : isReasoning
            ? 200000
            : version >= 4.0
            ? 128000
            : 16384

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

        // Multimodal check: GPT-4o, GPT-4o-mini, GPT-4-turbo, O-series support vision
        const low = id.toLowerCase()
        const isMultimodal =
          low.includes('4o') ||
          low.includes('vision') ||
          low.includes('turbo') ||
          low.startsWith('o1') ||
          low.startsWith('o3')

        const capabilities = this.detectCapabilities(id, {
          supportsVision: isMultimodal,
          isReasoning,
          isCoding,
          isFast,
        })

        return {
          id,
          displayName,
          provider: this.id,
          capabilities,
          contextWindow,
          contextTokens,
          tier: isPro ? ('Pro' as const) : ('Free' as const),
          badgeColor: isPro ? 'violet' : isFast ? 'emerald' : 'blue',
          description: `Mô hình ${displayName} từ OpenAI với hiệu năng lập luận logic cao cấp.`,
          recommendedFor,
          supportedModalities: isMultimodal ? ['text', 'image'] : ['text'],
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
