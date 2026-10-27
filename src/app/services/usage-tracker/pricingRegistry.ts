import type { CostCalculationResult, ModelPricingRule } from './types'

export class PricingRegistry {
  private static readonly STORAGE_KEY = 'meeting_copilot_model_pricing_rules'
  private static instance: PricingRegistry | null = null

  private rules: ModelPricingRule[] = []

  private constructor() {
    this.loadRules()
  }

  public static getInstance(): PricingRegistry {
    if (!PricingRegistry.instance) {
      PricingRegistry.instance = new PricingRegistry()
    }
    return PricingRegistry.instance
  }

  /**
   * Pricing starts empty; register or overwrite a rule supplied by the
   * application or user.
   */
  public registerPricing(rule: ModelPricingRule): void {
    if (
      !rule.provider?.trim() ||
      !rule.modelMatch?.trim() ||
      !Number.isFinite(rule.inputPerMillionTokens) ||
      !Number.isFinite(rule.outputPerMillionTokens) ||
      rule.inputPerMillionTokens < 0 ||
      rule.outputPerMillionTokens < 0
    ) return

    const normalized = { ...rule, source: rule.source || 'user' as const }
    const existing = this.rules.find(
      (r) =>
        r.provider.toLowerCase() === normalized.provider.toLowerCase() &&
        r.modelMatch.toLowerCase() === normalized.modelMatch.toLowerCase()
    )
    if (normalized.source === 'model' && existing?.source === 'user') return

    this.rules = [
      normalized,
      ...this.rules.filter(
        (r) =>
          r.provider.toLowerCase() !== normalized.provider.toLowerCase() ||
          r.modelMatch.toLowerCase() !== normalized.modelMatch.toLowerCase()
      ),
    ]
    this.persistRules()
    this.notifyRulesUpdated()
  }

  public registerModelPricing(
    provider: string,
    model: string,
    pricing: { promptPerMillion?: number; completionPerMillion?: number; currency?: string }
  ): void {
    const input = pricing.promptPerMillion
    const output = pricing.completionPerMillion
    if (pricing.currency && pricing.currency.toUpperCase() !== 'USD') return
    if (!provider || !model || !Number.isFinite(input) || !Number.isFinite(output)) return
    if ((input as number) < 0 || (output as number) < 0) return
    this.registerPricing({
      provider,
      modelMatch: model,
      inputPerMillionTokens: input as number,
      outputPerMillionTokens: output as number,
      currency: 'USD',
      source: 'model',
    })
  }

  public removePricing(provider: string, modelMatch: string): void {
    this.rules = this.rules.filter(
      (rule) =>
        rule.provider.toLowerCase() !== provider.toLowerCase() ||
        rule.modelMatch.toLowerCase() !== modelMatch.toLowerCase()
    )
    this.persistRules()
    this.notifyRulesUpdated()
  }

  public registerRule(rule: Partial<ModelPricingRule> & {
    provider: string
    modelMatch?: string
    modelPattern?: string
    inputCostPer1M?: number
    outputCostPer1M?: number
  }): void {
    const modelMatch = rule.modelMatch || rule.modelPattern || ''
    const inputPerMillionTokens = rule.inputPerMillionTokens ?? rule.inputCostPer1M ?? 0
    const outputPerMillionTokens = rule.outputPerMillionTokens ?? rule.outputCostPer1M ?? 0

    const normalizedRule: ModelPricingRule = {
      provider: rule.provider,
      modelMatch,
      inputPerMillionTokens,
      outputPerMillionTokens,
      cachedInputPerMillionTokens: rule.cachedInputPerMillionTokens,
      perMinuteAudioUsd: rule.perMinuteAudioUsd,
      currency: 'USD',
      source: 'user',
    }
    this.registerPricing(normalizedRule)
  }

  /**
   * Retrieve all active pricing rules
   */
  public getAllRules(): ModelPricingRule[] {
    return [...this.rules]
  }

  private loadRules(): void {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(PricingRegistry.STORAGE_KEY)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      this.rules = parsed.filter(
        (rule): rule is ModelPricingRule =>
          rule &&
          typeof rule.provider === 'string' &&
          typeof rule.modelMatch === 'string' &&
          typeof rule.inputPerMillionTokens === 'number' &&
          Number.isFinite(rule.inputPerMillionTokens) &&
          typeof rule.outputPerMillionTokens === 'number' &&
          Number.isFinite(rule.outputPerMillionTokens)
      )
    } catch {
      this.rules = []
    }
  }

  private persistRules(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(PricingRegistry.STORAGE_KEY, JSON.stringify(this.rules))
    } catch {
      // Pricing remains available in memory if local storage is unavailable.
    }
  }

  private notifyRulesUpdated(): void {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('pricing-rules-updated'))
    }
  }

  /**
   * Finds the best matching pricing rule for a provider and model
   */
  public findMatchingRule(provider: string, model: string): ModelPricingRule | null {
    let provLower = provider.toLowerCase().trim()
    if (provLower === 'gemini') provLower = 'google'
    const modelLower = model.toLowerCase().trim()

    // 1. Match within the normalized provider (longest specific match first)
    const provMatches = this.rules.filter((r) => r.provider.toLowerCase() === provLower)
    const matched = provMatches
      .filter((rule) => modelLower.includes(rule.modelMatch.toLowerCase()))
      .sort((a, b) => b.modelMatch.length - a.modelMatch.length)[0]

    if (matched) return matched

    return null
  }

  /**
   * Calculate cost given token/audio usage metrics
   * Supports input, output, cached tokens and audio minutes.
   */
  public calculateCost(
    providerOrParams: string | {
      provider: string
      model: string
      inputTokens?: number
      outputTokens?: number
      cachedTokens?: number
      audioDurationSeconds?: number
    },
    maybeModel?: string,
    maybeUsage?: {
      inputTokens?: number
      outputTokens?: number
      cachedTokens?: number
      audioDurationSeconds?: number
    }
  ): CostCalculationResult {
    let provider = ''
    let model = ''
    let usage: {
      inputTokens?: number
      outputTokens?: number
      cachedTokens?: number
      audioDurationSeconds?: number
    } = {}

    if (typeof providerOrParams === 'object' && providerOrParams !== null) {
      provider = providerOrParams.provider || ''
      model = providerOrParams.model || ''
      usage = providerOrParams
    } else {
      provider = String(providerOrParams || '')
      model = String(maybeModel || '')
      usage = maybeUsage || {}
    }

    const provLower = provider.toLowerCase().trim()
    const modelLower = model.toLowerCase().trim()

    // Local / Offline engine is always 100% Free
    if (provLower === 'local' || modelLower.startsWith('ggml')) {
      return { costUsd: 0, estimatedCostUsd: 0, costStatus: 'free', status: 'free' }
    }

    const rule = this.findMatchingRule(provider, model)
    if (!rule) {
      // Unknown pricing rule
      return { costUsd: null, estimatedCostUsd: null, costStatus: 'unknown', status: 'unknown' }
    }

    const inputTokens = Math.max(0, usage.inputTokens || 0)
    const cachedTokens = Math.max(0, usage.cachedTokens || 0)
    const uncachedInput = Math.max(0, inputTokens - cachedTokens)
    const outputTokens = Math.max(0, usage.outputTokens || 0)
    const audioSeconds = Math.max(0, usage.audioDurationSeconds || 0)

    // Token pricing calculation
    const uncachedCost = (uncachedInput * rule.inputPerMillionTokens) / 1_000_000
    const cachedCostRate = rule.cachedInputPerMillionTokens ?? (rule.inputPerMillionTokens * 0.5)
    const cachedCost = (cachedTokens * cachedCostRate) / 1_000_000
    const outputCost = (outputTokens * rule.outputPerMillionTokens) / 1_000_000

    // Audio pricing calculation
    const audioMinutes = audioSeconds / 60
    const audioCost = audioMinutes * (rule.perMinuteAudioUsd || 0)

    const totalCost = Number((uncachedCost + cachedCost + outputCost + audioCost).toFixed(6))

    return {
      costUsd: totalCost,
      estimatedCostUsd: totalCost,
      costStatus: 'calculated',
      status: 'calculated',
      matchedRule: rule,
    }
  }
}

export const pricingRegistry = PricingRegistry.getInstance()
