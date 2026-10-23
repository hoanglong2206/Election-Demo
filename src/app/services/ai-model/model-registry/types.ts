import type { LLMProvider } from '../types'

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'code'
  | 'reasoning'
  | 'fast'
  | 'tool_call'

export type AIProviderId = LLMProvider | string

export interface ModelPricing {
  promptPerMillion?: number
  completionPerMillion?: number
  currency?: string
}

export interface DiscoveredModel {
  id: string
  displayName: string
  provider: AIProviderId
  capabilities: ModelCapability[]
  contextWindow: string
  contextTokens?: number
  tier: 'Free' | 'Pro'
  badgeColor?: string
  description?: string
  recommendedFor?: string
  pricing?: ModelPricing
  supportedModalities?: string[]
  metadata?: Record<string, any>
  isLiveFromAPI: boolean
  lastDiscoveredAt: number
}

export interface RegistrySyncState {
  status: 'idle' | 'syncing' | 'success' | 'error'
  modelSource?: 'api' | 'cache' | 'mixed' | null
  lastSyncedAt: number | null
  error: string | null
  providerBreakdown?: string
  totalDiscovered?: number
}

export interface ModelValidationResult {
  valid: boolean
  warning?: string
  recommendedReplacement?: DiscoveredModel
}

export interface AIProvider {
  readonly id: AIProviderId
  readonly displayName: string
  listModels(apiKey?: string): Promise<DiscoveredModel[]>
}
