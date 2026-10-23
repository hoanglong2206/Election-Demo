import { afterEach, describe, expect, it } from 'bun:test'
import { pricingRegistry } from '../src/app/services/usage-tracker/pricingRegistry'
import { usageTrackerService } from '../src/app/services/usage-tracker/usageTrackerService'

const provider = 'PricingRegistryTestProvider'

afterEach(() => {
  for (const rule of pricingRegistry.getAllRules()) {
    if (rule.provider === provider) pricingRegistry.removePricing(rule.provider, rule.modelMatch)
  }
  usageTrackerService.resetLocalStatistics(true)
})

describe('PricingRegistry model pricing', () => {
  it('keeps unknown model cost unknown instead of treating it as a real zero', () => {
    const result = pricingRegistry.calculateCost(provider, 'unpriced-model-xyz', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })

    expect(result.costStatus).toBe('unknown')
    expect(result.costUsd).toBeNull()
    expect(result.estimatedCostUsd).toBeNull()
  })

  it('marks monthly totals as unknown when requests have no pricing rule', () => {
    usageTrackerService.trackUsage({
      provider,
      model: 'unpriced-total-model',
      feature: 'general',
      inputTokens: 1_000,
    })

    const summary = usageTrackerService.getCurrentMonthSummary()
    expect(summary.hasUnknownCosts).toBe(true)
    expect(summary.costStatus).toBe('unknown')
  })

  it('registers pricing carried by a discovered model', () => {
    pricingRegistry.registerModelPricing(provider, 'api-priced-model', {
      promptPerMillion: 2,
      completionPerMillion: 4,
      currency: 'USD',
    })

    const result = pricingRegistry.calculateCost(provider, 'api-priced-model', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })

    expect(result.costStatus).toBe('calculated')
    expect(result.costUsd).toBe(6)
  })

  it('supports user pricing and preserves it when model metadata is synced', () => {
    pricingRegistry.registerRule({
      provider,
      modelMatch: 'configured-model',
      inputPerMillionTokens: 1,
      outputPerMillionTokens: 2,
    })
    pricingRegistry.registerModelPricing(provider, 'configured-model', {
      promptPerMillion: 100,
      completionPerMillion: 200,
    })

    const result = pricingRegistry.calculateCost(provider, 'configured-model', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })

    expect(result.costUsd).toBe(3)
    expect(result.matchedRule?.source).toBe('user')
  })

  it('recalculates previously unknown usage after a price is configured', () => {
    const sessionId = 'pricing-registry-reprice-test'
    const model = 'reprice-model-unique'
    const record = usageTrackerService.trackUsage({
      sessionId,
      provider,
      model,
      feature: 'general',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(record.costStatus).toBe('unknown')

    pricingRegistry.registerRule({
      provider,
      modelMatch: model,
      inputPerMillionTokens: 1,
      outputPerMillionTokens: 2,
    })
    usageTrackerService.recalculateCosts()

    const summary = usageTrackerService.getSessionUsageSummary(sessionId)
    expect(summary.costStatus).toBe('calculated')
    expect(summary.totalCostUsd).toBe(3)
  })

  it('does not classify hosted models with “base” in the ID as free', () => {
    const result = pricingRegistry.calculateCost(provider, 'hosted-base-model', {
      inputTokens: 1_000,
    })

    expect(result.costStatus).toBe('unknown')
  })
})
