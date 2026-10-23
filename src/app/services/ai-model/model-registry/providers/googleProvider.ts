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
  formatContextTokens,
  generateDynamicRecommendation,
  calculateDynamicModelScore,
} from '../../modelHeuristics'

interface GoogleRawModel {
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

export class GoogleProvider extends BaseAIProvider {
  readonly id = 'Google'
  readonly displayName = 'Google Gemini'

  public async listModels(apiKey?: string): Promise<DiscoveredModel[]> {
    const trimmed = apiKey?.trim()
    if (!trimmed) {
      return []
    }

    try {
      const res = await this.safeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      if (!res.ok) {
        // Fallback gracefully on authorization or API error
        return []
      }

      const data = await res.json()
      const rawModels: GoogleRawModel[] = Array.isArray(data?.models) ? data.models : []

      const usableModels = rawModels.filter((m) => {
        if (!m.name) return false
        if (isNonChatModel(m.name, undefined, m.inputTokenLimit)) return false
        if (
          Array.isArray(m.supportedGenerationMethods) &&
          !m.supportedGenerationMethods.includes('generateContent')
        ) {
          return false
        }
        return true
      })

      if (usableModels.length === 0) {
        return []
      }

      const now = Date.now()
      const parsedModels: DiscoveredModel[] = usableModels.map((m) => {
        const cleanId = m.name.replace(/^models\//, '')
        const version = extractVersion(cleanId)
        const paramSize = extractParamSize(cleanId)

        const isReasoning = isReasoningModel(cleanId, undefined, m.thinking)
        const isCoding = isCodingModel(cleanId)
        const isFast = isFastTierModel(cleanId, paramSize)
        const isPro = isProTierModel(cleanId, paramSize)

        const contextWindow = formatContextTokens(m.inputTokenLimit, '1M tokens')
        const displayName = cleanAndFormatDisplayName(cleanId, m.displayName, 'Google')

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

        // Gemini models (1.5, 2.0, etc.) inherently support multimodal vision
        const isMultimodal = cleanId.toLowerCase().includes('gemini')

        const capabilities = this.detectCapabilities(cleanId, {
          supportsVision: isMultimodal,
          isReasoning,
          isCoding,
          isFast,
        })

        return {
          id: cleanId,
          displayName,
          provider: this.id,
          capabilities,
          contextWindow,
          contextTokens: m.inputTokenLimit || 1000000,
          tier: isPro ? ('Pro' as const) : ('Free' as const),
          badgeColor: isPro ? 'violet' : isFast ? 'emerald' : 'blue',
          description:
            m.description ||
            `Mô hình ${displayName} thế hệ ${version} từ Google DeepMind với khả năng xử lý đa phương thức multimodal.`,
          recommendedFor,
          supportedModalities: ['text', 'image', 'audio'],
          isLiveFromAPI: true,
          lastDiscoveredAt: now,
        }
      })

      // Sort models dynamically by capability score
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
