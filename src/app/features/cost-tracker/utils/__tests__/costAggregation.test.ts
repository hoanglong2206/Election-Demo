import { describe, it, expect } from 'bun:test'
import {
  calculateBudgetMetrics,
  calculateMonthlyProjection,
  filterUsageRecords,
  buildUsageCsvData,
} from '../costAggregation'
import type { UsageRecord } from '@/services/usage-tracker'

describe('costAggregation Unit Tests', () => {
  const mockRecords: UsageRecord[] = [
    {
      id: 'rec_1',
      timestamp: 1700000000000,
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot',
      inputTokens: 100,
      outputTokens: 200,
      cachedTokens: 50,
      estimatedCostUsd: 0.005,
      costStatus: 'calculated',
    },
    {
      id: 'rec_2',
      timestamp: 1700000050000,
      provider: 'OpenAI',
      model: 'gpt-4o',
      feature: 'translate',
      inputTokens: 500,
      outputTokens: 500,
      estimatedCostUsd: 0.05,
      costStatus: 'calculated',
    },
  ]

  it('calculateBudgetMetrics computes percentage, warning, and exceeded states', () => {
    // Normal below warning
    const normal = calculateBudgetMetrics(10, 20, 80)
    expect(normal.budgetSpendPercent).toBe(50)
    expect(normal.isBudgetWarning).toBe(false)
    expect(normal.isBudgetExceeded).toBe(false)

    // Warning zone
    const warning = calculateBudgetMetrics(17, 20, 80)
    expect(warning.budgetSpendPercent).toBe(85)
    expect(warning.isBudgetWarning).toBe(true)
    expect(warning.isBudgetExceeded).toBe(false)

    // Exceeded
    const exceeded = calculateBudgetMetrics(25, 20, 80)
    expect(exceeded.budgetSpendPercent).toBe(100)
    expect(exceeded.isBudgetWarning).toBe(true)
    expect(exceeded.isBudgetExceeded).toBe(true)

    // No budget limit set
    const noLimit = calculateBudgetMetrics(10, null)
    expect(noLimit.budgetSpendPercent).toBe(0)
    expect(noLimit.isBudgetWarning).toBe(false)
    expect(noLimit.isBudgetExceeded).toBe(false)
  })

  it('calculateMonthlyProjection computes linear projection based on day of month', () => {
    // Reference date: Day 15 in a 30-day month (e.g. April 15)
    const refDate = new Date(2026, 3, 15) // April (0-indexed month 3)
    const projection = calculateMonthlyProjection(15, refDate)

    expect(projection.currentDay).toBe(15)
    expect(projection.daysInMonth).toBe(30)
    expect(projection.projectedMonthlySpend).toBeCloseTo(30, 2)
  })

  it('filterUsageRecords filters by query, provider, and feature', () => {
    expect(filterUsageRecords(mockRecords, 'gemini')).toHaveLength(1)
    expect(filterUsageRecords(mockRecords, '', 'openai')).toHaveLength(1)
    expect(filterUsageRecords(mockRecords, '', 'all', 'translate')).toHaveLength(1)
    expect(filterUsageRecords(mockRecords, 'not_found')).toHaveLength(0)
    expect(filterUsageRecords(mockRecords)).toHaveLength(2)
  })

  it('buildUsageCsvData formats CSV rows and headers', () => {
    const { csvContent, filename } = buildUsageCsvData(mockRecords, new Date(2026, 9, 28))
    expect(filename).toBe('api-cost-usage-2026-10-28.csv')
    expect(csvContent).toContain('ID,Timestamp,Date,Provider,Model')
    expect(csvContent).toContain('rec_1')
    expect(csvContent).toContain('"Google"')
    expect(csvContent).toContain('"gemini-2.5-flash"')
  })
})
