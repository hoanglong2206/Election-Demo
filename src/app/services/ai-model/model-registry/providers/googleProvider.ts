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

    if (typeof window !== 'undefined' && window.api?.credentials?.verifyApiKey) {
      try {
        const verifyRes = await window.api.credentials.verifyApiKey('gemini', trimmed)
        if (!verifyRes.valid || !Array.isArray(verifyRes.models)) return []
        return verifyRes.models.map((m: any) => ({
          id: m.id,
          displayName: cleanAndFormatDisplayName(m.id, m.name, 'Google'),
          provider: this.id,
          capabilities: ['fast', 'vision'],
          contextWindow: `${Math.round((m.contextWindow || 1000000) / 1000)}k`,
          contextTokens: m.contextWindow || 1000000,
          tier: 'Free' as const,
          badgeColor: 'blue',
          description: `Mô hình ${m.id} từ Google AI với khả năng xử lý đa phương thức multimodal.`,
          recommendedFor: 'Tốc độ phản hồi cao với cửa sổ ngữ cảnh lớn.',
          supportedModalities: ['text', 'image', 'audio'],
          isLiveFromAPI: true,
          lastDiscoveredAt: Date.now(),
        }))
      } catch {
        return []
      }
    }

    return []
  }

}
