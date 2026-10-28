import type {
  BudgetSettings,
  CostCalculationStatus,
  MonthlyUsageSummary,
  TrackUsageInput,
  UsageBreakdownItem,
  UsageRecord,
} from './types'
import { pricingRegistry } from './pricingRegistry'
import { usagePort } from '@/infrastructure/ipc'

export const USAGE_STORAGE_KEYS = {
  RECORDS: 'meeting_copilot_usage_records',
  BUDGET: 'meeting_copilot_budget_settings',
  MIGRATED: 'meeting_copilot_usage_migrated_to_file',
}

const MAX_RECENT_LOGS = 200 // Recent buffer for UI logs table
const MAX_IN_MEMORY_STATS_RECORDS = 5000 // Retention limit for in-memory statistics

export interface UsageQueryParams {
  from?: number
  to?: number
  limit?: number
  cursor?: string
  sessionId?: string
  provider?: string
  model?: string
}

export interface UsageQueryResult {
  records: UsageRecord[]
  total: number
  nextCursor?: string
  hasMore: boolean
}

export interface SessionUsageCounters {
  sessionId: string
  totalRecords: number
  totalCostUsd: number | null
  totalEstimatedCostUsd: number
  costStatus: CostCalculationStatus
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalAudioDurationSeconds: number
  requests: number
  records: UsageRecord[]
}

export interface DayUsageCounter {
  date: string
  estimatedCostUsd: number
  tokens: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  requests: number
  hasUnknownCosts: boolean
}

export class UsageTrackerService {
  private static instance: UsageTrackerService | null = null

  // Ring buffers
  private recentRecords: UsageRecord[] = [] // Max 200 for logs
  private statsRecords: UsageRecord[] = [] // Max 5,000 for local analytics

  // Running Accumulators / Counters in Memory
  private currentMonthSummary: MonthlyUsageSummary | null = null
  private sessionCounters = new Map<string, SessionUsageCounters>()
  private dailyCounters = new Map<string, DayUsageCounter>()

  // Batch buffer for async Main Process NDJSON write
  private pendingBatch: UsageRecord[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private maxWaitTimer: NodeJS.Timeout | null = null
  private firstQueuedTimestamp: number | null = null
  private readonly batchDebounceMs = 3000
  private readonly maxWaitMs = 10000

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

    // Initialize blank current month summary
    this.currentMonthSummary = this.createEmptyMonthlySummary(this.getCurrentYearMonth())

    if (typeof window !== 'undefined') {
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('pricing-rules-updated', () => this.recalculateCosts())
        window.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            void this.flushBatch()
          }
        })
        window.addEventListener('beforeunload', () => {
          void this.flushBatch()
        })
      }
    }

    if (typeof localStorage === 'undefined') return

    try {
      // 1. Read budget settings from localStorage (lightweight, single JSON object)
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

      // 2. Check for legacy localStorage records and run one-time idempotent migration
      const rawRecords = localStorage.getItem(USAGE_STORAGE_KEYS.RECORDS)
      if (rawRecords) {
        const parsed = JSON.parse(rawRecords)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validLegacy = parsed.filter(
            (r) => r && typeof r === 'object' && typeof r.timestamp === 'number' && !isNaN(r.timestamp)
          )
          this.loadRecordsIntoMemory(validLegacy)
          // Asynchronously migrate to Main Process NDJSON files
          void this.runMigration(validLegacy)
        }
      } else {
        // Load initial monthly state from Main Process NDJSON asynchronously
        void this.loadStateFromMain()
      }
    } catch {
      // Continue gracefully
    }
  }

  /**
   * One-time idempotent migration: sends legacy localStorage records to Main,
   * verifies record count, then deletes the localStorage key.
   */
  private async runMigration(records: UsageRecord[]): Promise<void> {
    if (!usagePort.isAvailable) return
    try {
      const res = await usagePort.migrate(records)
      if (res && res.success) {
        localStorage.removeItem(USAGE_STORAGE_KEYS.RECORDS)
        localStorage.setItem(USAGE_STORAGE_KEYS.MIGRATED, 'true')
        console.log(
          `[UsageTrackerService] Successfully migrated ${res.migratedCount} legacy records to Main NDJSON.`
        )
      }
    } catch (err) {
      console.warn('[UsageTrackerService] Migration to Main failed, preserving localStorage:', err)
    }
  }

  /**
   * Loads current month records and recent logs from Main process NDJSON files.
   */
  private async loadStateFromMain(): Promise<void> {
    if (!usagePort.isAvailable) return
    try {
      const [currentMonthRecs, recentRecs] = await Promise.all([
        usagePort.loadCurrentMonth(),
        usagePort.getRecent(MAX_RECENT_LOGS),
      ])

      const combinedMap = new Map<string, UsageRecord>()
      if (Array.isArray(currentMonthRecs)) {
        for (const r of currentMonthRecs) if (r && r.id) combinedMap.set(r.id, r)
      }
      if (Array.isArray(recentRecs)) {
        for (const r of recentRecs) if (r && r.id) combinedMap.set(r.id, r)
      }

      const all = Array.from(combinedMap.values()).sort((a, b) => b.timestamp - a.timestamp)
      if (all.length > 0) {
        this.loadRecordsIntoMemory(all)
        this.notifySubscribers()
      }
    } catch (err) {
      console.warn('[UsageTrackerService] Failed loading state from Main:', err)
    }
  }

  /**
   * Populates in-memory buffers and rebuilds running accumulators.
   */
  private loadRecordsIntoMemory(records: UsageRecord[]): void {
    // Sort newest first
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp)
    this.recentRecords = sorted.slice(0, MAX_RECENT_LOGS)
    this.statsRecords = sorted.slice(0, MAX_IN_MEMORY_STATS_RECORDS)

    // Rebuild current month running accumulator
    const currentYm = this.getCurrentYearMonth()
    this.currentMonthSummary = this.createEmptyMonthlySummary(currentYm)
    this.sessionCounters.clear()
    this.dailyCounters.clear()

    for (let i = sorted.length - 1; i >= 0; i--) {
      this.accumulateRecord(sorted[i])
    }
  }

  /**
   * Synchronously track an individual AI/STT request usage:
   * - Immediately calculates cost in-memory
   * - Updates running accumulators and ring buffers synchronously (< 0.2ms)
   * - Does NOT call JSON.stringify on the 5000-record array
   * - Does NOT touch localStorage on the UI thread
   * - Enqueues record into batch buffer for Main Process NDJSON write
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

    // Cost calculation via PricingRegistry
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

    // 1. Maintain in-memory ring buffers synchronously
    this.recentRecords.unshift(record)
    if (this.recentRecords.length > MAX_RECENT_LOGS) {
      this.recentRecords.pop()
    }

    this.statsRecords.unshift(record)
    if (this.statsRecords.length > MAX_IN_MEMORY_STATS_RECORDS) {
      this.statsRecords.pop()
    }

    // 2. Update running accumulators synchronously O(1)
    this.accumulateRecord(record)

    // 3. Queue into batch buffer for debounced Main NDJSON write
    this.enqueueBatch(record)

    // 4. Notify UI subscribers
    this.notifySubscribers()

    return record
  }

  /**
   * Enqueues record into batch buffer with 3s debounce and 10s max wait timeout.
   */
  private enqueueBatch(record: UsageRecord): void {
    this.pendingBatch.push(record)

    if (this.firstQueuedTimestamp === null) {
      this.firstQueuedTimestamp = Date.now()
      this.maxWaitTimer = setTimeout(() => {
        void this.flushBatch()
      }, this.maxWaitMs)
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.flushBatch()
    }, this.batchDebounceMs)
  }

  /**
   * Immediately flushes the pending batch to the Main Process NDJSON file.
   * Invoked on debounce, max wait, session end, visibilitychange, beforeunload.
   */
  public async flushBatch(): Promise<number> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer)
      this.maxWaitTimer = null
    }
    this.firstQueuedTimestamp = null

    if (this.pendingBatch.length === 0) return 0

    const batch = [...this.pendingBatch]
    this.pendingBatch = []

    if (usagePort.isAvailable) {
      try {
        const count = await usagePort.append(batch)
        return count
      } catch (err) {
        console.error('[UsageTrackerService] Failed sending usage batch to Main Process:', err)
        // Put unwritten batch back in front of queue
        this.pendingBatch = [...batch, ...this.pendingBatch]
        return 0
      }
    }

    return batch.length
  }

  /**
   * Synchronously accumulates a single record into running totals:
   * - Current month totals & breakdowns
   * - Session running counters
   * - Daily history running counters
   */
  private accumulateRecord(record: UsageRecord): void {
    const ym = this.formatYearMonth(record.timestamp)
    const currentYm = this.getCurrentYearMonth()

    const inTok = record.inputTokens || 0
    const outTok = record.outputTokens || 0
    const cacheTok = record.cachedTokens || 0
    const audioSec = record.audioDurationSeconds || 0
    const cost = record.estimatedCostUsd || 0

    // Accumulate to current month summary
    if (ym === currentYm) {
      if (!this.currentMonthSummary || this.currentMonthSummary.yearMonth !== currentYm) {
        this.currentMonthSummary = this.createEmptyMonthlySummary(currentYm)
      }
      const summary = this.currentMonthSummary
      summary.totalRequests++
      summary.totalInputTokens += inTok
      summary.totalOutputTokens += outTok
      summary.totalCachedTokens += cacheTok
      summary.totalAudioDurationSeconds += audioSec

      if (record.costStatus === 'unknown') {
        summary.hasUnknownCosts = true
      } else if (record.costStatus === 'calculated') {
        summary.totalEstimatedCostUsd = Number((summary.totalEstimatedCostUsd + cost).toFixed(6))
      }

      const dayKey = this.formatDayKey(record.timestamp)
      summary.dailyCosts[dayKey] = Number(((summary.dailyCosts[dayKey] || 0) + cost).toFixed(6))

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

      summary.costStatus = summary.hasUnknownCosts
        ? 'unknown'
        : summary.totalEstimatedCostUsd > 0
        ? 'calculated'
        : 'free'

      summary.byProvider = Object.values(summary.breakdownByProvider).sort((a, b) => b.cost - a.cost)
      summary.byModel = Object.values(summary.breakdownByModel).sort((a, b) => b.cost - a.cost)
      summary.byFeature = Object.values(summary.breakdownByFeature).sort((a, b) => b.cost - a.cost)
    }

    // Accumulate to session counters
    if (record.sessionId) {
      let sc = this.sessionCounters.get(record.sessionId)
      if (!sc) {
        sc = {
          sessionId: record.sessionId,
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
        this.sessionCounters.set(record.sessionId, sc)
      }

      sc.totalRecords++
      sc.requests++
      sc.totalInputTokens += inTok
      sc.totalOutputTokens += outTok
      sc.totalCachedTokens += cacheTok
      sc.totalAudioDurationSeconds += audioSec

      if (record.costStatus === 'unknown') {
        sc.costStatus = 'unknown'
        sc.totalCostUsd = null
      } else if (record.costStatus === 'calculated') {
        sc.totalEstimatedCostUsd = Number((sc.totalEstimatedCostUsd + cost).toFixed(6))
        if (sc.costStatus !== 'unknown') {
          sc.totalCostUsd = sc.totalEstimatedCostUsd
          sc.costStatus = 'calculated'
        }
      }

      sc.records.unshift(record)
      if (sc.records.length > 50) sc.records.pop()
    }

    // Accumulate to daily history counters
    const dayKey = this.formatDayKey(record.timestamp)
    let dc = this.dailyCounters.get(dayKey)
    if (!dc) {
      dc = {
        date: dayKey,
        estimatedCostUsd: 0,
        tokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        requests: 0,
        hasUnknownCosts: false,
      }
      this.dailyCounters.set(dayKey, dc)
    }

    dc.requests++
    dc.inputTokens += inTok
    dc.outputTokens += outTok
    dc.cachedTokens += cacheTok
    dc.tokens += inTok + outTok

    if (record.costStatus === 'calculated') {
      dc.estimatedCostUsd = Number((dc.estimatedCostUsd + cost).toFixed(6))
    } else if (record.costStatus === 'unknown') {
      dc.hasUnknownCosts = true
    }
  }

  /**
   * Recalculates saved usage costs when model pricing changes.
   */
  public recalculateCosts(): void {
    let changed = false
    for (const record of this.statsRecords) {
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
      // Rebuild running accumulators
      this.loadRecordsIntoMemory(this.statsRecords)
      this.notifySubscribers()
    }
  }

  /**
   * Fast O(1) synchronous read of current month summary from running accumulator.
   */
  public getCurrentMonthSummary(): MonthlyUsageSummary {
    const currentYm = this.getCurrentYearMonth()
    if (!this.currentMonthSummary || this.currentMonthSummary.yearMonth !== currentYm) {
      this.currentMonthSummary = this.createEmptyMonthlySummary(currentYm)
    }
    return { ...this.currentMonthSummary }
  }

  public getMonthSummary(targetYearMonth?: string): MonthlyUsageSummary {
    return this.getMonthlySummary(targetYearMonth)
  }

  public getMonthlySummary(targetYearMonth?: string): MonthlyUsageSummary {
    const yearMonth = targetYearMonth || this.getCurrentYearMonth()
    if (yearMonth === this.getCurrentYearMonth() && this.currentMonthSummary) {
      return { ...this.currentMonthSummary }
    }

    // Fallback: calculate from in-memory statsRecords
    const summary = this.createEmptyMonthlySummary(yearMonth)
    for (const record of this.statsRecords) {
      if (this.formatYearMonth(record.timestamp) === yearMonth) {
        this.accumulateToSummary(summary, record)
      }
    }
    return summary
  }

  /**
   * Fast O(1) retrieval of usage summary for a meeting session ID.
   */
  public getSessionUsageSummary(sessionId: string): {
    sessionId: string
    totalRecords: number
    totalCostUsd: number | null
    totalEstimatedCostUsd: number
    costStatus: CostCalculationStatus
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

    const sc = this.sessionCounters.get(sessionId)
    if (sc) {
      return {
        ...sc,
        records: [...sc.records],
      }
    }

    // Fallback search in statsRecords
    const sessionRecords = this.statsRecords.filter((r) => r && r.sessionId === sessionId)
    let totalCost = 0
    let hasUnknown = false
    let isAllFree = sessionRecords.length > 0
    let inTok = 0
    let outTok = 0
    let cacheTok = 0
    let audioSec = 0

    for (const r of sessionRecords) {
      inTok += r.inputTokens || 0
      outTok += r.outputTokens || 0
      cacheTok += r.cachedTokens || 0
      audioSec += r.audioDurationSeconds || 0

      if (r.costStatus === 'unknown') hasUnknown = true
      else if (r.costStatus === 'calculated') {
        isAllFree = false
        totalCost += r.estimatedCostUsd || 0
      }
    }

    const costStatus: CostCalculationStatus = hasUnknown
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
      totalInputTokens: inTok,
      totalOutputTokens: outTok,
      totalCachedTokens: cacheTok,
      totalAudioDurationSeconds: audioSec,
      requests: sessionRecords.length,
      records: sessionRecords,
    }
  }

  /**
   * Fast daily history retrieval from running accumulators for charts.
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

      const dc = this.dailyCounters.get(dayKey)
      if (dc) {
        history.push({ ...dc })
      } else {
        history.push({
          date: dayKey,
          estimatedCostUsd: 0,
          tokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          requests: 0,
          hasUnknownCosts: false,
        })
      }
    }

    return history
  }

  /**
   * Seed demo data for local charts preview.
   */
  public seedDemoData(): void {
    interface SampleModelItem {
      provider: string
      model: string
      feature: UsageRecord['feature']
      inMin?: number
      inMax?: number
      outMin?: number
      outMax?: number
      cacheMin?: number
      cacheMax?: number
      audioSec?: number
    }

    const sampleModels: SampleModelItem[] = [
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

    for (let dayOffset = 11; dayOffset >= 0; dayOffset--) {
      const dayBase = now - dayOffset * 24 * 60 * 60 * 1000
      const requestsCount = Math.floor(Math.random() * 4) + 2

      for (let req = 0; req < requestsCount; req++) {
        const item = sampleModels[Math.floor(Math.random() * sampleModels.length)]
        const timestamp = dayBase + (req * 3 + Math.floor(Math.random() * 2)) * 3600 * 1000

        const inputTokens = item.inMin !== undefined && item.inMax !== undefined ? Math.floor(Math.random() * (item.inMax - item.inMin)) + item.inMin : undefined
        const outputTokens = item.outMin !== undefined && item.outMax !== undefined ? Math.floor(Math.random() * (item.outMax - item.outMin)) + item.outMin : undefined
        const cachedTokens = item.cacheMin !== undefined && item.cacheMax !== undefined && item.cacheMax > 0 ? Math.floor(Math.random() * (item.cacheMax - item.cacheMin)) + item.cacheMin : undefined
        const audioDurationSeconds = item.audioSec !== undefined ? item.audioSec + Math.floor(Math.random() * 30) : undefined

        const costCalc = pricingRegistry.calculateCost(item.provider, item.model, {
          inputTokens,
          outputTokens,
          cachedTokens,
          audioDurationSeconds,
        })

        const rec: UsageRecord = {
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
        }
        newRecords.push(rec)
        this.accumulateRecord(rec)
      }
    }

    this.recentRecords = [...newRecords, ...this.recentRecords].slice(0, MAX_RECENT_LOGS)
    this.statsRecords = [...newRecords, ...this.statsRecords].slice(0, MAX_IN_MEMORY_STATS_RECORDS)

    // Send demo records to Main in batch
    void this.flushBatch()
    if (usagePort.isAvailable) {
      void usagePort.append(newRecords)
    }

    this.notifySubscribers()
  }

  /**
   * Fast synchronous retrieval of recent records from in-memory ring buffer (default 100-200).
   */
  public getAllRecords(limit = 100): UsageRecord[] {
    return this.recentRecords.slice(0, limit)
  }

  /**
   * Paged query delegating to Main process NDJSON storage without loading entire history.
   */
  public async queryPagedRecords(params: UsageQueryParams): Promise<UsageQueryResult> {
    if (usagePort.isAvailable) {
      try {
        return await usagePort.query(params)
      } catch (err) {
        console.warn('[UsageTrackerService] Main query failed, falling back to in-memory:', err)
      }
    }

    // In-memory fallback
    const limit = Math.min(Math.max(1, params.limit ?? 50), 200)
    const from = params.from ?? 0
    const to = params.to ?? Date.now()

    const matched = this.statsRecords.filter((r) => {
      if (r.timestamp < from || r.timestamp > to) return false
      if (params.sessionId && r.sessionId !== params.sessionId) return false
      if (params.provider && r.provider !== params.provider) return false
      if (params.model && r.model !== params.model) return false
      return true
    })

    let startIndex = 0
    if (params.cursor) {
      const idx = matched.findIndex((r) => r.id === params.cursor)
      if (idx !== -1) startIndex = idx + 1
    }

    const paged = matched.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < matched.length
    const nextCursor = hasMore && paged.length > 0 ? paged[paged.length - 1].id : undefined
    return {
      records: paged,
      total: matched.length,
      nextCursor,
      hasMore,
    }
  }

  /**
   * Reset local statistics with explicit confirmation guard.
   */
  public resetLocalStatistics(confirmed: boolean): boolean {
    if (!confirmed) return false

    this.recentRecords = []
    this.statsRecords = []
    this.pendingBatch = []
    this.sessionCounters.clear()
    this.dailyCounters.clear()
    this.currentMonthSummary = this.createEmptyMonthlySummary(this.getCurrentYearMonth())

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(USAGE_STORAGE_KEYS.RECORDS)
      } catch {}
    }

    if (usagePort.isAvailable) {
      void usagePort.reset()
    }

    this.notifySubscribers()
    return true
  }

  public resetStatistics(): void {
    this.resetLocalStatistics(true)
  }

  /**
   * Budget Guard: ultra-fast O(1) synchronous check against in-memory accumulator.
   * Completely decoupled from disk I/O latency.
   */
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
        localStorage.setItem(USAGE_STORAGE_KEYS.BUDGET, JSON.stringify(this.budgetSettings))
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

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('ai-usage-updated', {
          detail: summary,
        })
      )
    }
  }

  private createEmptyMonthlySummary(yearMonth: string): MonthlyUsageSummary {
    const [yearStr, monthStr] = yearMonth.split('-')
    const displayMonth = `${monthStr}/${yearStr}`
    return {
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
  }

  private accumulateToSummary(summary: MonthlyUsageSummary, record: UsageRecord): void {
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
      summary.totalEstimatedCostUsd = Number((summary.totalEstimatedCostUsd + cost).toFixed(6))
    }

    const dayKey = this.formatDayKey(record.timestamp)
    summary.dailyCosts[dayKey] = Number(((summary.dailyCosts[dayKey] || 0) + cost).toFixed(6))

    this.aggregateBreakdown(summary.breakdownByProvider, record.provider, cost, inTok, outTok, cacheTok, audioSec, record.costStatus)
    this.aggregateBreakdown(summary.breakdownByModel, record.model, cost, inTok, outTok, cacheTok, audioSec, record.costStatus)
    this.aggregateBreakdown(summary.breakdownByFeature, record.feature, cost, inTok, outTok, cacheTok, audioSec, record.costStatus)

    summary.costStatus = summary.hasUnknownCosts ? 'unknown' : summary.totalEstimatedCostUsd > 0 ? 'calculated' : 'free'
    summary.byProvider = Object.values(summary.breakdownByProvider).sort((a, b) => b.cost - a.cost)
    summary.byModel = Object.values(summary.breakdownByModel).sort((a, b) => b.cost - a.cost)
    summary.byFeature = Object.values(summary.breakdownByFeature).sort((a, b) => b.cost - a.cost)
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
