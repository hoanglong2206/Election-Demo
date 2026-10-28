import { BaseAIProvider } from './base'
import type { DiscoveredModel } from '../types'
import { cleanAndFormatDisplayName } from '../../modelHeuristics'
import { credentialsPort } from '@/infrastructure/ipc'

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

export class GroqProvider extends BaseAIProvider {
  readonly id = 'Groq'
  readonly displayName = 'Groq LPU'

  public async listModels(apiKey?: string): Promise<DiscoveredModel[]> {
    const trimmed = apiKey?.trim()
    if (!trimmed) {
      return []
    }

    if (credentialsPort.isSupported) {
      try {
        const verifyRes = await credentialsPort.verifyApiKey('groq', trimmed)
        if (!verifyRes.valid || !Array.isArray(verifyRes.models)) return []
        return verifyRes.models.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          displayName: cleanAndFormatDisplayName(m.id, m.name, 'Groq'),
          provider: 'Groq',
          tier: 'Free',
          badgeColor: 'emerald',
          contextWindow: `${Math.round((m.contextWindow || 8192) / 1000)}k`,
          description: `Groq LPU Cloud Inference (${m.id})`,
          recommendedFor: 'Tốc độ cực nhanh cho phản hồi thời gian thực.',
          capabilities: ['fast'],
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
