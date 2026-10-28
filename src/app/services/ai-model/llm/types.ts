import type { LLMProvider } from '../types'
import type { AIUsageFeature } from '../../usage-tracker'
import type { ModelRouterRequest, SmartModelRouter, RoutingDecision } from '../model-router'

export interface UniversalLLMResult {
  text: string
  provider: LLMProvider
  modelId: string
  modelName: string
  usage?: {
    inputTokens: number
    outputTokens: number
    cachedTokens?: number
    uncachedTokens?: number
    cacheHitRate?: number
    estimatedCostUsd?: number | null
  }
  benchmark?: {
    ttftMs: number
    generationMs: number
    outputTokens?: number
    mainTtftMs?: number
    ipcLagMs?: number
    deltasPerSec?: number
  }
  routing?: RoutingDecision
  failover?: {
    switched: boolean
    fromProvider?: string
    toProvider?: string
    reason?: string
  }
  truncated?: boolean
}

export interface UniversalLLMStreamCallbacks {
  onFirstToken?: (ttftMs: number) => void
  onDelta: (delta: string) => void
  onDone: (result: UniversalLLMResult) => void
  onError: (
    error: Error,
    partialText: string,
    metadata?: { provider?: LLMProvider; modelId?: string; modelName?: string; usage?: any }
  ) => void
}

export interface UniversalLLMOptions {
  modelId?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  sessionId?: string
  feature?: AIUsageFeature
  routing?: Partial<ModelRouterRequest> & {
    enabled?: boolean
    router?: SmartModelRouter
  }
  signal?: AbortSignal
}
