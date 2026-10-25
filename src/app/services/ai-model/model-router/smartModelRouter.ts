import { modelRegistryService, type DiscoveredModel, type ModelCapability } from '../model-registry'
import { usageTrackerService, type AIUsageFeature } from '../../usage-tracker'
import { providerCircuitBreaker } from './providerFailover'

export type RoutingPolicy = 'fastest' | 'cheapest' | 'balanced' | 'highest-quality' | 'local-only'
export type RequestModality = 'text' | 'vision'
export type PrivacyRequirement = 'standard' | 'prefer-local' | 'local-only'

export interface ModelRouterWeights {
  qualityWeight: number
  latencyWeight: number
  costWeight: number
  reliabilityWeight: number
  privacyWeight: number
}

export interface ModelRouterConfig {
  policy: RoutingPolicy
  weights: ModelRouterWeights
  monthlyBudgetLimitUsd?: number
  enabled: boolean
}

export interface ModelRouterRequest {
  feature: AIUsageFeature | string
  intentType?: string
  requiredModality?: RequestModality
  contextTokens?: number
  latencyTargetMs?: number
  privacyRequirement?: PrivacyRequirement
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  manualModelId?: string
  policy?: RoutingPolicy
}

export interface RoutingCandidateScore {
  modelId: string
  score: number
  qualityScore: number
  latencyScore: number
  costScore: number
  reliabilityScore: number
  privacyScore: number
  excludedReason?: string
}

export interface RoutingDecision {
  selectedModelId: string | null
  selectedProvider?: string
  policy: RoutingPolicy
  reason: string
  isManualOverride: boolean
  budgetRemainingUsd: number | null
  candidates: RoutingCandidateScore[]
  timestamp: number
  fallbackChain?: Array<{ modelId: string; provider: string }>
  providerHealth?: Array<{
    provider: string
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    failureRate: number
    averageLatencyMs: number
    consecutiveFailures: number
  }>
}

interface ModelPerformance {
  requests: number
  failures: number
  totalLatencyMs: number
  lastLatencyMs: number
}

const DEFAULT_CONFIG: ModelRouterConfig = {
  policy: 'balanced',
  enabled: true,
  weights: {
    qualityWeight: 0.3,
    latencyWeight: 0.2,
    costWeight: 0.2,
    reliabilityWeight: 0.2,
    privacyWeight: 0.1,
  },
}

const METRICS_STORAGE_KEY = 'meeting_copilot_model_router_metrics_v1'

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getModelLatency(model: DiscoveredModel, performance?: ModelPerformance): number {
  if (performance?.requests) return performance.totalLatencyMs / performance.requests
  const metadataLatency = model.metadata?.latencyMs
  return typeof metadataLatency === 'number' && metadataLatency > 0 ? metadataLatency : 500
}

function getModelCost(model: DiscoveredModel, inputTokens: number, outputTokens: number): number {
  const pricing = model.pricing
  if (!pricing) return 0
  return (
    (inputTokens / 1_000_000) * (pricing.promptPerMillion || 0) +
    (outputTokens / 1_000_000) * (pricing.completionPerMillion || 0)
  )
}

function supportsIntent(model: DiscoveredModel, intentType?: string): boolean {
  if (!intentType) return true
  if (intentType.includes('coding')) return model.capabilities.includes('code') || model.capabilities.includes('reasoning')
  if (intentType.includes('system_design') || intentType.includes('architecture')) {
    return model.capabilities.includes('reasoning')
  }
  return true
}

function loadMetrics(): Map<string, ModelPerformance> {
  if (typeof localStorage === 'undefined') return new Map()
  try {
    const parsed = JSON.parse(localStorage.getItem(METRICS_STORAGE_KEY) || '{}') as Record<string, ModelPerformance>
    return new Map(Object.entries(parsed).filter(([, value]) => value && value.requests >= 0))
  } catch {
    return new Map()
  }
}

function saveMetrics(metrics: Map<string, ModelPerformance>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(Object.fromEntries(metrics)))
  } catch {
    // Metrics are best-effort and never block an AI request.
  }
}

export class SmartModelRouter {
  private readonly config: ModelRouterConfig
  private readonly metrics = loadMetrics()
  private readonly getModels: () => DiscoveredModel[]

  constructor(
    config: Partial<ModelRouterConfig> = {},
    modelSource: () => DiscoveredModel[] = () => modelRegistryService.getModels(),
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights },
    }
    this.getModels = modelSource
  }

  getConfig(): ModelRouterConfig {
    return {
      ...this.config,
      weights: { ...this.config.weights },
    }
  }

  decide(request: ModelRouterRequest): RoutingDecision {
    const policy = request.policy || this.config.policy
    const models = this.getModels()
    const budgetRemainingUsd = this.getBudgetRemaining(request)
    const candidates: RoutingCandidateScore[] = models.map((model) => {
      const performance = this.metrics.get(model.id)
      const latency = getModelLatency(model, performance)
      const estimatedCost = getModelCost(model, request.estimatedInputTokens || 800, request.estimatedOutputTokens || 300)
      const reliability = performance?.requests
        ? 1 - performance.failures / performance.requests
        : 0.8
      const quality = model.capabilities.includes('reasoning')
        ? 1
        : model.capabilities.includes('code')
          ? 0.85
          : model.tier === 'Pro'
            ? 0.8
            : 0.65
      const score: RoutingCandidateScore = {
        modelId: model.id,
        score: 0,
        qualityScore: quality,
        latencyScore: clamp(1 - latency / Math.max(request.latencyTargetMs || 1000, 1000)),
        costScore: estimatedCost === 0 ? 1 : clamp(1 - estimatedCost / Math.max(budgetRemainingUsd || estimatedCost * 2, 0.000001)),
        reliabilityScore: clamp(reliability),
        privacyScore: model.provider.toLowerCase() === 'local' ? 1 : 0,
      }

      const excludedReason = this.getExclusionReason(model, request, budgetRemainingUsd)
      score.excludedReason = excludedReason
      if (!excludedReason) {
        const weights = this.policyWeights(policy)
        score.score =
          score.qualityScore * weights.qualityWeight +
          score.latencyScore * weights.latencyWeight +
          score.costScore * weights.costWeight +
          score.reliabilityScore * weights.reliabilityWeight +
          score.privacyScore * weights.privacyWeight
      }
      return score
    })

    const override = request.manualModelId && models.find((model) => model.id === request.manualModelId)
    const selected = override && !this.getExclusionReason(override, request, budgetRemainingUsd)
      ? override
      : models
        .filter((model) => !this.getExclusionReason(model, request, budgetRemainingUsd))
        .sort((left, right) => this.scoreFor(right, candidates) - this.scoreFor(left, candidates))[0]
    const fallbackChain = models
      .filter((model) =>
        model.id !== selected?.id &&
        !this.getExclusionReason(model, request, budgetRemainingUsd) &&
        providerCircuitBreaker.canRequest(String(model.provider))
      )
      .sort((left, right) => this.scoreFor(right, candidates) - this.scoreFor(left, candidates))
      .map((model) => ({ modelId: model.id, provider: String(model.provider) }))

    return {
      selectedModelId: selected?.id || null,
      selectedProvider: selected?.provider,
      policy,
      reason: override
        ? 'manual_override'
        : selected
          ? 'highest_constraint_compatible_score'
          : 'no_model_satisfied_constraints',
      isManualOverride: Boolean(override),
      budgetRemainingUsd,
      candidates: candidates.sort((left, right) => right.score - left.score),
      timestamp: Date.now(),
      fallbackChain: selected
        ? [{ modelId: selected.id, provider: String(selected.provider) }, ...fallbackChain]
        : fallbackChain,
      providerHealth: providerCircuitBreaker.getAllSnapshots(),
    }
  }

  recordResult(modelId: string, latencyMs: number, success: boolean): void {
    const current = this.metrics.get(modelId) || {
      requests: 0,
      failures: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
    }
    current.requests += 1
    current.failures += success ? 0 : 1
    current.totalLatencyMs += Math.max(0, latencyMs)
    current.lastLatencyMs = Math.max(0, latencyMs)
    this.metrics.set(modelId, current)
    saveMetrics(this.metrics)
  }

  private scoreFor(model: DiscoveredModel, candidates: RoutingCandidateScore[]): number {
    return candidates.find((candidate) => candidate.modelId === model.id)?.score || 0
  }

  private policyWeights(policy: RoutingPolicy): ModelRouterWeights {
    if (policy === 'fastest') return { qualityWeight: 0.1, latencyWeight: 0.65, costWeight: 0.1, reliabilityWeight: 0.1, privacyWeight: 0.05 }
    if (policy === 'cheapest') return { qualityWeight: 0.1, latencyWeight: 0.1, costWeight: 0.65, reliabilityWeight: 0.1, privacyWeight: 0.05 }
    if (policy === 'highest-quality') return { qualityWeight: 0.65, latencyWeight: 0.1, costWeight: 0.05, reliabilityWeight: 0.15, privacyWeight: 0.05 }
    if (policy === 'local-only') return { qualityWeight: 0.3, latencyWeight: 0.15, costWeight: 0.15, reliabilityWeight: 0.15, privacyWeight: 0.25 }
    return this.config.weights
  }

  private getExclusionReason(model: DiscoveredModel, request: ModelRouterRequest, budgetRemainingUsd: number | null): string | undefined {
    if (!model.isLiveFromAPI) return 'model_not_live'
    if (request.requiredModality === 'vision' && !model.capabilities.includes('vision')) return 'missing_vision_capability'
    if (request.requiredModality !== 'vision' && !model.capabilities.includes('text')) return 'missing_text_capability'
    if (!supportsIntent(model, request.intentType)) return 'missing_intent_capability'
    if (request.contextTokens && model.contextTokens && model.contextTokens < request.contextTokens) return 'context_window_too_small'
    if (request.privacyRequirement === 'local-only' || request.policy === 'local-only') {
      if (model.provider.toLowerCase() !== 'local') return 'privacy_requires_local'
    }
    const estimatedCost = getModelCost(model, request.estimatedInputTokens || 800, request.estimatedOutputTokens || 300)
    if (budgetRemainingUsd !== null && estimatedCost > budgetRemainingUsd && estimatedCost > 0) return 'monthly_budget_exceeded'
    return undefined
  }

  private getBudgetRemaining(request: ModelRouterRequest): number | null {
    const limit = request.policy === 'local-only'
      ? 0
      : this.config.monthlyBudgetLimitUsd ?? usageTrackerService.getBudgetSettings().monthlyBudgetLimitUsd
    if (limit === null || limit === undefined) return null
    return Math.max(0, limit - usageTrackerService.getCurrentMonthSummary().totalEstimatedCostUsd)
  }
}

export const smartModelRouter = new SmartModelRouter()
export type { ModelCapability }
