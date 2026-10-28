import { BaseAIProvider } from './base'
import type { DiscoveredModel } from '../types'
import { cleanAndFormatDisplayName } from '../../modelHeuristics'
import { credentialsPort } from '@/infrastructure/ipc'

export class OpenAIProvider extends BaseAIProvider {
  readonly id = 'OpenAI'
  readonly displayName = 'OpenAI GPT'

  public async listModels(apiKey?: string): Promise<DiscoveredModel[]> {
    const trimmed = apiKey?.trim()
    if (!trimmed) {
      return []
    }

    if (credentialsPort.isSupported) {
      try {
        const verifyRes = await credentialsPort.verifyApiKey('openai', trimmed)
        if (!verifyRes.valid || !Array.isArray(verifyRes.models)) return []
        return verifyRes.models.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          displayName: cleanAndFormatDisplayName(m.id, m.name, 'OpenAI'),
          provider: 'OpenAI',
          tier: 'Pro' as const,
          badgeColor: 'sky',
          contextWindow: `${Math.round((m.contextWindow || 128000) / 1000)}k`,
          contextTokens: m.contextWindow || 128000,
          description: `OpenAI Flagship Model (${m.id})`,
          recommendedFor: 'Khả năng suy luận mạnh mẽ và chính xác cao.',
          capabilities: ['text', 'reasoning'],
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

