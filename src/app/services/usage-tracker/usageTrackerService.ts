import type {
  BudgetSettings,
  CostCalculationStatus,
  MonthlyUsageSummary,
  TrackUsageInput,
  UsageBreakdownItem,
  UsageRecord,
} from './types'
import { pricingRegistry } from './pricingRegistry'

export const USAGE_STORAGE_KEYS = {
  RECORDS: 'meeting_copilot_usage_records',
  BUDGET: 'meeting_copilot_budget_settings',
}

const MAX_STORED_RECORDS = 5000 // Retention limit to keep localStorage lightweight

export class UsageTrackerService {
  private static instance: UsageTrackerService | null = null

  private records: UsageRecord[] = []
  private budgetSettings: BudgetSettings = {
    monthlyBudgetLimitUsd: 20.0,
    monthlyLimitUsd: 20.0,
    warningThresholdPercent: 80,
  }
  private subscribers = new Set<(summary: MonthlyUsageSummary) => void>()
  private isInitialized = false

  private constructor() {
    this.init()
  }

  public static getInstance(): UsageTrackerService {
    if (!UsageTrackerService.instance) {
      UsageTrackerService.instance = new UsageTrackerService()
    }
    return UsageTrackerService.instance
  }

  public init(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pricing-rules-updated', () => this.recalculateCosts())
    }

    if (typeof localStorage === 'undefined') return

    try {
      const rawRecords = localStorage.getItem(USAGE_STORAGE_KEYS.RECORDS)
      if (rawRecords) {
        const parsed = JSON.parse(rawRecords)
        if (Array.isArray(parsed)) {
          this.records = parsed.filter(
            (r) => r && typeof r === 'object' && typeof r.timestamp === 'number' && !isNaN(r.timestamp)
          )
        }
      }

      const rawBudget = localStorage.getItem(USAGE_STORAGE_KEYS.BUDGET)
      if (rawBudget) {
        const parsedBudget = JSON.parse(rawBudget)
        if (parsedBudget && typeof parsedBudget === 'object') {
          const limit = parsedBudget.monthlyBudgetLimitUsd ?? parsedBudget.monthlyLimitUsd ?? 20.0
          this.budgetSettings = {
            ...this.budgetSettings,
            ...parsedBudget,
            monthlyBudgetLimitUsd: limit,
            monthlyLimitUsd: typeof limit === 'number' ? limit : undefined,
          }
        }
      }
    } catch {
      // Continue gracefully
    }

    // Re-evaluate persisted estimates against the currently configured prices.
    // This clears costs calculated from pricing rules that no longer exist.
    this.recalculateCosts()
  }

  /**
   * Track an individual AI/STT request usage and calculate its cost immediately
   */
  public trackUsage(input: TrackUsageInput): UsageRecord {
    const timestamp = Date.now()
    const id = `usage_${timestamp}_${Math.random().toString(36).substring(2, 7)}`

    const inputTokens =
      input.inputTokens === undefined
        ? undefined
        : typeof input.inputTokens === 'number' && !isNaN(input.inputTokens)
        ? Math.max(0, input.inputTokens)
        : 0
    const outputTokens =
      input.outputTokens === undefined
        ? undefined
        : typeof input.outputTokens === 'number' && !isNaN(input.outputTokens)
        ? Math.max(0, input.outputTokens)
        : 0
    const cachedTokens =
      input.cachedTokens === undefined
        ? undefined
        : typeof input.cachedTokens === 'number' && !isNaN(input.cachedTokens)
        ? Math.max(0, input.cachedTokens)
        : 0
    const audioDurationSeconds =
      input.audioDurationSeconds === undefined
        ? undefined
        : typeof input.audioDurationSeconds === 'number' && !isNaN(input.audioDurationSeconds)
        ? Math.max(0, input.audioDurationSeconds)
        : 0

    // Calculate cost using decoupled PricingRegistry
    const costResult = pricingRegistry.calculateCost(input.provider, input.model, {
      inputTokens,
      outputTokens,
      cachedTokens,
      audioDurationSeconds,
    })

    const record: UsageRecord = {
      id,
      timestamp,
      sessionId: input.sessionId,
      provider: input.provider || 'Unknown',
      model: input.model || 'Unknown',
      feature: input.feature || 'general',
      inputTokens,
      outputTokens,
      cachedTokens,
      audioDurationSeconds,
      estimatedCostUsd: costResult.costUsd,
      costStatus: costResult.costStatus,
      metadata: input.metadata,
    }

    // Add to in-memory records (newest first)
    this.records.unshift(record)

    // Enforce retention limit
    if (this.records.length > MAX_STORED_RECORDS) {
      this.records = this.records.slice(0, MAX_STORED_RECORDS)
    }

    this.persistRecords()
    this.notifySubscribers()

    return record
  }

  /** Recalculate saved usage after a model price is added or changed. */
  public recalculateCosts(): void {
    let changed = false
    for (const record of this.records) {
      const result = pricingRegistry.calculateCost(record.provider, record.model, {
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cachedTokens: record.cachedTokens,
        audioDurationSeconds: record.audioDurationSeconds,
      })
      if (record.estimatedCostUsd !== result.costUsd || record.costStatus !== result.costStatus) {
        record.estimatedCostUsd = result.costUsd
        record.costStatus = result.costStatus
        changed = true
      }
    }
    if (changed) {
      this.persistRecords()
      this.notifySubscribers()
    }
  }

  /**
   * Retrieves summary for current month
   */
  public getCurrentMonthSummary(): MonthlyUsageSummary {
    return this.getMonthlySummary(this.getCurrentYearMonth())
  }

  /**
   * Alias for getMonthlySummary
   */
  public getMonthSummary(targetYearMonth?: string): MonthlyUsageSummary {
    return this.getMonthlySummary(targetYearMonth)
  }

  /**
   * Retrieves summary for a specific month (defaults to current month: YYYY-MM)
   */
  public getMonthlySummary(targetYearMonth?: string): MonthlyUsageSummary {
    const yearMonth = targetYearMonth || this.getCurrentYearMonth()
    const [yearStr, monthStr] = yearMonth.split('-')
    const displayMonth = `${monthStr}/${yearStr}`

    const summary: MonthlyUsageSummary = {
      yearMonth,
      month: displayMonth,
      totalEstimatedCostUsd: 0,
      costStatus: 'free',
      hasUnknownCosts: false,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalAudioDurationSeconds: 0,
      totalRequests: 0,
      byProvider: [],
      byModel: [],
      byFeature: [],
      breakdownByProvider: {},
      breakdownByModel: {},
      breakdownByFeature: {},
      dailyCosts: {},
    }

    let hasCalculated = false

    for (const record of this.records) {
      if (!record || typeof record !== 'object' || typeof record.timestamp !== 'number') continue
      const recordYearMonth = this.formatYearMonth(record.timestamp)
      if (!recordYearMonth || recordYearMonth !== yearMonth) continue

      summary.totalRequests++

      const inTok = record.inputTokens || 0
      const outTok = record.outputTokens || 0
      const cacheTok = record.cachedTokens || 0
      const audioSec = record.audioDurationSeconds || 0
      const cost = record.estimatedCostUsd || 0

      summary.totalInputTokens += inTok
      summary.totalOutputTokens += outTok
      summary.totalCachedTokens += cacheTok
      summary.totalAudioDurationSeconds += audioSec

      if (record.costStatus === 'unknown') {
        summary.hasUnknownCosts = true
      } else if (record.costStatus === 'calculated') {
        hasCalculated = true
        summary.totalEstimatedCostUsd += cost
      }

      // Daily cost aggregation (YYYY-MM-DD)
      const dayKey = this.formatDayKey(record.timestamp)
      summary.dailyCosts[dayKey] = Number(
        ((summary.dailyCosts[dayKey] || 0) + cost).toFixed(6)
      )

      // Breakdown by Provider
      this.aggregateBreakdown(
        summary.breakdownByProvider,
        record.provider,
        cost,
        inTok,
        outTok,
        cacheTok,
        audioSec,
        record.costStatus
      )

      // Breakdown by Model
      this.aggregateBreakdown(
        summary.breakdownByModel,
        record.model,
        cost,
        inTok,
        outTok,
        cacheTok,
        audioSec,
        record.costStatus
      )

      // Breakdown by Feature
      this.aggregateBreakdown(
        summary.breakdownByFeature,
        record.feature,
        cost,
        inTok,
        outTok,
        cacheTok,
        audioSec,
        record.costStatus
      )
    }

    summary.totalEstimatedCostUsd = Number(summary.totalEstimatedCostUsd.toFixed(6))
    summary.costStatus = summary.hasUnknownCosts
      ? 'unknown'
      : hasCalculated
      ? 'calculated'
      : 'free'

    // Sort breakdowns by cost descending
    summary.byProvider = Object.values(summary.breakdownByProvider).sort((a, b) => b.cost - a.cost)
    summary.byModel = Object.values(summary.breakdownByModel).sort((a, b) => b.cost - a.cost)
    summary.byFeature = Object.values(summary.breakdownByFeature).sort((a, b) => b.cost - a.cost)

    return summary
  }

  /**
   * Retrieves usage summary specifically for a meeting session ID
   */
  public getSessionUsageSummary(sessionId: string): {
    sessionId: string
    totalRecords: number
    totalCostUsd: number | null
    totalEstimatedCostUsd: number
    costStatus: 'calculated' | 'unknown' | 'free'
    totalInputTokens: number
    totalOutputTokens: number
    totalCachedTokens: number
    totalAudioDurationSeconds: number
    requests: number
    records: UsageRecord[]
  } {
    if (!sessionId) {
      return {
        sessionId: '',
        totalRecords: 0,
        totalCostUsd: 0,
        totalEstimatedCostUsd: 0,
        costStatus: 'free',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCachedTokens: 0,
        totalAudioDurationSeconds: 0,
        requests: 0,
        records: [],
      }
    }
    const sessionRecords = this.records.filter((r) => r && r.sessionId === sessionId)

    let totalCost = 0
    let hasUnknown = false
    let isAllFree = sessionRecords.length > 0
    let inputTokens = 0
    let outputTokens = 0
    let cachedTokens = 0
    let audioDurationSeconds = 0

    for (const r of sessionRecords) {
      inputTokens += r.inputTokens || 0
      outputTokens += r.outputTokens || 0
      cachedTokens += r.cachedTokens || 0
      audioDurationSeconds += r.audioDurationSeconds || 0

      if (r.costStatus === 'unknown') {
        hasUnknown = true
      } else if (r.costStatus === 'calculated') {
        isAllFree = false
        totalCost += r.estimatedCostUsd || 0
      }
    }

    const costStatus: 'calculated' | 'unknown' | 'free' = hasUnknown
      ? 'unknown'
      : isAllFree && sessionRecords.length > 0
      ? 'free'
      : 'calculated'

    return {
      sessionId,
      totalRecords: sessionRecords.length,
      totalCostUsd: hasUnknown ? null : Number(totalCost.toFixed(6)),
      totalEstimatedCostUsd: Number(totalCost.toFixed(6)),
      costStatus,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalCachedTokens: cachedTokens,
      totalAudioDurationSeconds: audioDurationSeconds,
      requests: sessionRecords.length,
      records: sessionRecords,
    }
  }

  /**
   * Daily history for mini chart visualization
   */
  public getDailyHistory(days = 14): {
    date: string
    estimatedCostUsd: number
    tokens: number
    inputTokens: number
    outputTokens: number
    cachedTokens: number
    requests: number
    hasUnknownCosts: boolean
  }[] {
    const history: {
      date: string
      estimatedCostUsd: number
      tokens: number
      inputTokens: number
      outputTokens: number
      cachedTokens: number
      requests: number
      hasUnknownCosts: boolean
    }[] = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayKey = this.formatDayKey(d.getTime())

      let dayCost = 0
      let dayTokens = 0
      let dayInputTokens = 0
      let dayOutputTokens = 0
      let dayCachedTokens = 0
      let dayReqs = 0
      let hasUnknownCosts = false

      for (const r of this.records) {
        if (this.formatDayKey(r.timestamp) === dayKey) {
          dayReqs++
          const inT = r.inputTokens || 0
          const outT = r.outputTokens || 0
          const cacheT = r.cachedTokens || 0
          dayInputTokens += inT
          dayOutputTokens += outT
          dayCachedTokens += cacheT
          dayTokens += inT + outT

          if (r.costStatus === 'calculated') {
            dayCost += r.estimatedCostUsd || 0
          } else if (r.costStatus === 'unknown') {
            hasUnknownCosts = true
          }
        }
      }

      history.push({
        date: dayKey,
        estimatedCostUsd: Number(dayCost.toFixed(6)),
        tokens: dayTokens,
        inputTokens: dayInputTokens,
        outputTokens: dayOutputTokens,
        cachedTokens: dayCachedTokens,
        requests: dayReqs,
        hasUnknownCosts,
      })
    }

    return history
  }

  /**
   * Seed realistic demo usage data for charts visualization
   */
  public seedDemoData(): void {
    const sampleModels = [
      { provider: 'Google', model: 'gemini-2.5-flash', feature: 'copilot_interview' as const, inMin: 900, inMax: 2400, outMin: 300, outMax: 800, cacheMin: 200, cacheMax: 600 },
      { provider: 'OpenAI', model: 'gpt-4o', feature: 'copilot_discussion' as const, inMin: 1200, inMax: 3100, outMin: 450, outMax: 950, cacheMin: 400, cacheMax: 1200 },
      { provider: 'OpenAI', model: 'gpt-4o-mini', feature: 'exchange_scanner' as const, inMin: 600, inMax: 1500, outMin: 150, outMax: 400, cacheMin: 0, cacheMax: 0 },
      { provider: 'Groq', model: 'llama-3.3-70b-versatile', feature: 'translate' as const, inMin: 400, inMax: 1100, outMin: 250, outMax: 600, cacheMin: 0, cacheMax: 0 },
      { provider: 'Google', model: 'gemini-2.5-flash', feature: 'visual_question' as const, inMin: 1500, inMax: 3800, outMin: 350, outMax: 900, cacheMin: 0, cacheMax: 0 },
      { provider: 'Local', model: 'whisper-tiny', feature: 'stt' as const, audioSec: 35 },
      { provider: 'Groq', model: 'whisper-large-v3', feature: 'stt' as const, audioSec: 75 },
    ]

    const newRecords: UsageRecord[] = []
    const now = Date.now()

    // Generate records distributed over the last 12 days
    for (let dayOffset = 11; dayOffset >= 0; dayOffset--) {
      const dayBase = now - dayOffset * 24 * 60 * 60 * 1000
      const requestsCount = Math.floor(Math.random() * 4) + 2 // 2 to 5 requests per day

      for (let req = 0; req < requestsCount; req++) {
        const item = sampleModels[Math.floor(Math.random() * sampleModels.length)]
        const timestamp = dayBase + (req * 3 + Math.floor(Math.random() * 2)) * 3600 * 1000

        const inputTokens = 'inMin' in item ? Math.floor(Math.random() * (item.inMax - item.inMin)) + item.inMin : undefined
        const outputTokens = 'outMin' in item ? Math.floor(Math.random() * (item.outMax - item.outMin)) + item.outMin : undefined
        const cachedTokens = 'cacheMin' in item && item.cacheMax > 0 ? Math.floor(Math.random() * (item.cacheMax - item.cacheMin)) + item.cacheMin : undefined
        const audioDurationSeconds = 'audioSec' in item ? item.audioSec + Math.floor(Math.random() * 30) : undefined

        const costCalc = pricingRegistry.calculateCost({
          provider: item.provider,
          model: item.model,
          inputTokens,
          outputTokens,
          cachedTokens,
          audioDurationSeconds,
        })

        newRecords.push({
          id: `demo_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp,
          sessionId: `session_${dayOffset}`,
          provider: item.provider,
          model: item.model,
          feature: item.feature,
          inputTokens,
          outputTokens,
          cachedTokens,
          audioDurationSeconds,
          estimatedCostUsd: costCalc.costUsd,
          costStatus: costCalc.costStatus,
        })
      }
    }

    this.records = [...this.records, ...newRecords].slice(-5000)
    this.persistRecords()
    this.notifySubscribers()
  }

  /**
   * Retrieve raw usage records
   */
  public getAllRecords(limit = 100): UsageRecord[] {
    return this.records.slice(0, limit)
  }

  /**
   * Reset local statistics with explicit confirmation guard
   */
  public resetLocalStatistics(confirmed: boolean): boolean {
    if (!confirmed) {
      return false
    }
    this.records = []
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(USAGE_STORAGE_KEYS.RECORDS)
      } catch {}
    }
    this.notifySubscribers()
    return true
  }

  /**
   * Backward-compatible alias for resetStatistics
   */
  public resetStatistics(): void {
    this.resetLocalStatistics(true)
  }

  public isBudgetExceeded(): boolean {
    const summary = this.getCurrentMonthSummary()
    const limit = this.budgetSettings.monthlyBudgetLimitUsd ?? this.budgetSettings.monthlyLimitUsd
    if (typeof limit !== 'number' || limit <= 0) return false
    return summary.totalEstimatedCostUsd >= limit
  }

  public getCacheMetrics(yearMonth?: string): {
    totalInputTokens: number
    totalCachedTokens: number
    uncachedTokens: number
    cacheHitRate: number
    estimatedSavingsUsd: number
  } {
    const summary = yearMonth ? this.getMonthlySummary(yearMonth) : this.getCurrentMonthSummary()
    const totalInput = summary.totalInputTokens || 0
    const totalCached = summary.totalCachedTokens || 0
    const uncached = Math.max(0, totalInput - totalCached)
    const cacheHitRate = totalInput > 0 ? Math.round((totalCached / totalInput) * 1000) / 10 : 0
    const estimatedSavingsUsd = Number(((totalCached * 0.25) / 1_000_000).toFixed(6))

    return {
      totalInputTokens: totalInput,
      totalCachedTokens: totalCached,
      uncachedTokens: uncached,
      cacheHitRate,
      estimatedSavingsUsd,
    }
  }

  public getBudgetSettings(): BudgetSettings {
    return { ...this.budgetSettings }
  }

  public updateBudgetSettings(settings: Partial<BudgetSettings>): BudgetSettings {
    const limit =
      settings.monthlyBudgetLimitUsd ?? settings.monthlyLimitUsd ?? this.budgetSettings.monthlyBudgetLimitUsd
    this.budgetSettings = {
      ...this.budgetSettings,
      ...settings,
      monthlyBudgetLimitUsd: limit,
      monthlyLimitUsd: typeof limit === 'number' ? limit : undefined,
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          USAGE_STORAGE_KEYS.BUDGET,
          JSON.stringify(this.budgetSettings)
        )
      } catch {}
    }
    this.notifySubscribers()
    return { ...this.budgetSettings }
  }

  public subscribe(listener: (summary: MonthlyUsageSummary) => void): () => void {
    this.subscribers.add(listener)
    listener(this.getCurrentMonthSummary())

    return () => {
      this.subscribers.delete(listener)
    }
  }

  private notifySubscribers(): void {
    const summary = this.getCurrentMonthSummary()
    for (const listener of this.subscribers) {
      try {
        listener(summary)
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-usage-updated', {
          detail: summary,
        })
      )
    }
  }

  private persistRecords(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        USAGE_STORAGE_KEYS.RECORDS,
        JSON.stringify(this.records)
      )
    } catch {}
  }

  private aggregateBreakdown(
    dict: Record<string, UsageBreakdownItem>,
    key: string,
    cost: number,
    inTok: number,
    outTok: number,
    cachedTok: number,
    audioSec: number,
    costStatus: CostCalculationStatus
  ): void {
    if (!dict[key]) {
      dict[key] = {
        name: key,
        cost: 0,
        estimatedCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        audioDurationSeconds: 0,
        requests: 0,
        costStatus: 'free',
        hasUnknownCost: false,
      }
    }

    dict[key].requests++
    const newCost = Number((dict[key].cost + cost).toFixed(6))
    dict[key].cost = newCost
    dict[key].estimatedCostUsd = newCost
    dict[key].inputTokens += inTok
    dict[key].outputTokens += outTok
    dict[key].cachedTokens += cachedTok
    dict[key].audioDurationSeconds += audioSec

    if (costStatus === 'unknown') {
      dict[key].costStatus = 'unknown'
      dict[key].hasUnknownCost = true
    } else if (costStatus === 'calculated' && dict[key].costStatus !== 'unknown') {
      dict[key].costStatus = 'calculated'
    }
  }

  private getCurrentYearMonth(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  private formatYearMonth(timestamp: number): string {
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return ''
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  private formatDayKey(timestamp: number): string {
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return ''
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

export const usageTrackerService = UsageTrackerService.getInstance()
