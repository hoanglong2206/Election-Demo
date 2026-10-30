import type { UsageRecord } from '@/services/usage-tracker'
import { getFeatureDisplayName } from '../types'

export interface BudgetMetrics {
  limitNum: number
  budgetSpendPercent: number
  isBudgetWarning: boolean
  isBudgetExceeded: boolean
}

export interface MonthlyProjection {
  currentDay: number
  daysInMonth: number
  projectedMonthlySpend: number
}

export function calculateBudgetMetrics(
  currentCost: number,
  budgetLimit: number | null | undefined,
  warningThresholdPercent = 80
): BudgetMetrics {
  const limitNum = budgetLimit && budgetLimit > 0 ? budgetLimit : 0
  const budgetSpendPercent =
    limitNum > 0 ? Math.min(100, Math.round((currentCost / limitNum) * 100)) : 0
  const isBudgetWarning = limitNum > 0 && budgetSpendPercent >= warningThresholdPercent
  const isBudgetExceeded = limitNum > 0 && currentCost >= limitNum

  return {
    limitNum,
    budgetSpendPercent,
    isBudgetWarning,
    isBudgetExceeded,
  }
}

export function calculateMonthlyProjection(
  currentCost: number,
  referenceDate: Date = new Date()
): MonthlyProjection {
  const currentDay = referenceDate.getDate()
  const daysInMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0
  ).getDate()

  const projectedMonthlySpend =
    currentDay > 0 ? (currentCost / currentDay) * daysInMonth : currentCost

  return {
    currentDay,
    daysInMonth,
    projectedMonthlySpend,
  }
}

export function filterUsageRecords(
  records: UsageRecord[],
  query = '',
  provider = 'all',
  feature = 'all'
): UsageRecord[] {
  const normalizedQuery = query.trim().toLowerCase()

  return records.filter((r) => {
    if (provider !== 'all' && r.provider.toLowerCase() !== provider.toLowerCase()) {
      return false
    }

    if (feature !== 'all' && r.feature !== feature) {
      return false
    }

    if (normalizedQuery) {
      const matchModel = r.model.toLowerCase().includes(normalizedQuery)
      const matchProvider = r.provider.toLowerCase().includes(normalizedQuery)
      const matchFeature =
        r.feature.toLowerCase().includes(normalizedQuery) ||
        getFeatureDisplayName(r.feature).toLowerCase().includes(normalizedQuery)
      const matchId = r.id.toLowerCase().includes(normalizedQuery)
      if (!matchModel && !matchProvider && !matchFeature && !matchId) {
        return false
      }
    }

    return true
  })
}

export function buildUsageCsvData(
  records: UsageRecord[],
  date: Date = new Date()
): { csvContent: string; filename: string } {
  const headers = [
    'ID',
    'Timestamp',
    'Date',
    'Provider',
    'Model',
    'Feature',
    'InputTokens',
    'OutputTokens',
    'CachedTokens',
    'AudioDurationSec',
    'EstimatedCostUSD',
    'CostStatus',
  ]

  const rows = records.map((r) => [
    r.id,
    r.timestamp,
    new Date(r.timestamp).toISOString(),
    `"${r.provider}"`,
    `"${r.model}"`,
    `"${r.feature}"`,
    r.inputTokens ?? 0,
    r.outputTokens ?? 0,
    r.cachedTokens ?? 0,
    r.audioDurationSeconds ?? 0,
    (r.estimatedCostUsd ?? 0).toFixed(6),
    r.costStatus,
  ])

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

  const filename = `api-cost-usage-${date.toISOString().slice(0, 10)}.csv`

  return { csvContent, filename }
}

export function triggerCsvDownload(csvContent: string, filename: string): void {
  if (typeof document === 'undefined') return
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

