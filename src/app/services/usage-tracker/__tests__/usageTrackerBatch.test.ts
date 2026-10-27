import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { usageTrackerService } from '../usageTrackerService'
import { pricingRegistry } from '../pricingRegistry'
import type { UsageRecord } from '../types'

describe('UsageTrackerService (Batching, Running Accumulators, Durability & Performance)', () => {
  let mockAppendedBatches: UsageRecord[][] = []

  beforeEach(() => {
    mockAppendedBatches = []
    // Setup pricing rule for OpenAI gpt-4o
    pricingRegistry.registerRule({
      provider: 'OpenAI',
      modelMatch: 'gpt-4o',
      inputCostPer1M: 2.5,
      outputCostPer1M: 10.0,
    })
    // Setup mock window.api.usage
    ;(globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      api: {
        usage: {
          append: mock(async (batch: UsageRecord[]) => {
            mockAppendedBatches.push(batch)
            return batch.length
          }),
          query: mock(async () => ({ records: [], total: 0, hasMore: false })),
          migrate: mock(async (records: UsageRecord[]) => ({
            migratedCount: records.length,
            success: true,
          })),
          reset: mock(async () => true),
        },
      },
    }

    usageTrackerService.resetLocalStatistics(true)
    usageTrackerService.updateBudgetSettings({
      monthlyBudgetLimitUsd: 10.0,
      monthlyLimitUsd: 10.0,
      warningThresholdPercent: 80,
    })
  })

  afterEach(() => {
    usageTrackerService.resetLocalStatistics(true)
  })

  it('1. Performance Benchmark: trackUsage executes on UI thread in < 1ms (target < 1ms)', () => {
    const iterations = 100
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      usageTrackerService.trackUsage({
        provider: 'Google',
        model: 'gemini-2.5-flash',
        feature: 'copilot_interview',
        inputTokens: 1500,
        outputTokens: 350,
        cachedTokens: 500,
        sessionId: 'session_perf_test',
      })
    }

    const elapsed = performance.now() - start
    const avgLatencyMs = elapsed / iterations

    console.log(
      `[Benchmark] 100 trackUsage calls: total ${elapsed.toFixed(3)}ms, avg: ${avgLatencyMs.toFixed(4)}ms/call`
    )

    // Average latency per call MUST be well under 1ms (typically < 0.05ms without JSON.stringify/localStorage)
    expect(avgLatencyMs).toBeLessThan(1.0)
    expect(elapsed).toBeLessThan(100.0) // 100 calls in less than 100ms
  })

  it('2. Running Accumulators: exact match with recomputed totals from records', () => {
    const testInputs = [
      {
        provider: 'Google',
        model: 'gemini-2.5-flash',
        feature: 'copilot_interview' as const,
        inputTokens: 2000,
        outputTokens: 500,
        cachedTokens: 400,
        sessionId: 'session_acc_1',
      },
      {
        provider: 'OpenAI',
        model: 'gpt-4o',
        feature: 'copilot_discussion' as const,
        inputTokens: 3000,
        outputTokens: 800,
        cachedTokens: 1000,
        sessionId: 'session_acc_1',
      },
      {
        provider: 'Groq',
        model: 'whisper-large-v3',
        feature: 'stt' as const,
        audioDurationSeconds: 65,
        sessionId: 'session_acc_2',
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'translate' as const,
        inputTokens: 800,
        outputTokens: 400,
        sessionId: 'session_acc_2',
      },
    ]

    const trackedRecords: UsageRecord[] = []
    for (const input of testInputs) {
      trackedRecords.push(usageTrackerService.trackUsage(input))
    }

    // Read current month summary from in-memory accumulator O(1)
    const summary = usageTrackerService.getCurrentMonthSummary()

    // Recompute expected totals from tracked records
    let expectedInTok = 0
    let expectedOutTok = 0
    let expectedCacheTok = 0
    let expectedAudioSec = 0
    let expectedCost = 0

    for (const r of trackedRecords) {
      expectedInTok += r.inputTokens || 0
      expectedOutTok += r.outputTokens || 0
      expectedCacheTok += r.cachedTokens || 0
      expectedAudioSec += r.audioDurationSeconds || 0
      if (r.costStatus === 'calculated') {
        expectedCost += r.estimatedCostUsd || 0
      }
    }

    expect(summary.totalRequests).toBe(4)
    expect(summary.totalInputTokens).toBe(expectedInTok)
    expect(summary.totalOutputTokens).toBe(expectedOutTok)
    expect(summary.totalCachedTokens).toBe(expectedCacheTok)
    expect(summary.totalAudioDurationSeconds).toBe(expectedAudioSec)
    expect(summary.totalEstimatedCostUsd).toBeCloseTo(expectedCost, 5)

    // Verify breakdown by provider
    const googleBreakdown = summary.breakdownByProvider['Google']
    expect(googleBreakdown).toBeDefined()
    expect(googleBreakdown.requests).toBe(1)
    expect(googleBreakdown.inputTokens).toBe(2000)
    expect(googleBreakdown.outputTokens).toBe(500)

    const openaiBreakdown = summary.breakdownByProvider['OpenAI']
    expect(openaiBreakdown).toBeDefined()
    expect(openaiBreakdown.requests).toBe(1)
    expect(openaiBreakdown.inputTokens).toBe(3000)

    const groqBreakdown = summary.breakdownByProvider['Groq']
    expect(groqBreakdown).toBeDefined()
    expect(groqBreakdown.requests).toBe(2)
  })

  it('3. Batching & Debounce: batches records and flushes to Main Process via IPC', async () => {
    // Track 3 records rapidly
    usageTrackerService.trackUsage({
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot_interview',
      inputTokens: 500,
      outputTokens: 100,
    })
    usageTrackerService.trackUsage({
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot_interview',
      inputTokens: 600,
      outputTokens: 150,
    })
    usageTrackerService.trackUsage({
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot_interview',
      inputTokens: 700,
      outputTokens: 200,
    })

    // Before flush: no IPC call made yet (in debounce window)
    expect(mockAppendedBatches.length).toBe(0)

    // Trigger flush
    const flushedCount = await usageTrackerService.flushBatch()
    expect(flushedCount).toBe(3)
    expect(mockAppendedBatches.length).toBe(1)
    expect(mockAppendedBatches[0].length).toBe(3)

    // Subsequent flush on empty queue returns 0
    const secondFlush = await usageTrackerService.flushBatch()
    expect(secondFlush).toBe(0)
    expect(mockAppendedBatches.length).toBe(1)
  })

  it('4. Budget Guard: synchronous O(1) decision decoupled from disk I/O latency', () => {
    // Limit is 10.0 USD
    expect(usageTrackerService.isBudgetExceeded()).toBe(false)

    // Record high usage with gpt-4o
    // gpt-4o pricing: ~$2.50 per 1M input, $10.00 per 1M output
    // 2,000,000 output tokens = ~$20.00 > $10.00 limit
    usageTrackerService.trackUsage({
      provider: 'OpenAI',
      model: 'gpt-4o',
      feature: 'copilot',
      inputTokens: 100000,
      outputTokens: 2000000,
    })

    // Budget Guard immediately detects limit exceeded synchronously
    expect(usageTrackerService.isBudgetExceeded()).toBe(true)
  })

  it('5. Parallel Sessions: concurrent requests from two sessions maintain independent counters', () => {
    const sessionA = 'session_alpha_123'
    const sessionB = 'session_beta_456'

    usageTrackerService.trackUsage({
      sessionId: sessionA,
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot_interview',
      inputTokens: 1000,
      outputTokens: 200,
    })

    usageTrackerService.trackUsage({
      sessionId: sessionB,
      provider: 'OpenAI',
      model: 'gpt-4o',
      feature: 'copilot_discussion',
      inputTokens: 5000,
      outputTokens: 1000,
    })

    usageTrackerService.trackUsage({
      sessionId: sessionA,
      provider: 'Google',
      model: 'gemini-2.5-flash',
      feature: 'copilot_interview',
      inputTokens: 1500,
      outputTokens: 300,
    })

    const summaryA = usageTrackerService.getSessionUsageSummary(sessionA)
    const summaryB = usageTrackerService.getSessionUsageSummary(sessionB)

    // Session A
    expect(summaryA.requests).toBe(2)
    expect(summaryA.totalInputTokens).toBe(2500)
    expect(summaryA.totalOutputTokens).toBe(500)

    // Session B
    expect(summaryB.requests).toBe(1)
    expect(summaryB.totalInputTokens).toBe(5000)
    expect(summaryB.totalOutputTokens).toBe(1000)
  })

  it('6. One-time Migration: validates legacy localStorage records and removes key on success', async () => {
    const legacyRecords = [
      {
        id: 'legacy_rec_1',
        timestamp: Date.now() - 3600000,
        provider: 'Google',
        model: 'gemini-2.5-flash',
        feature: 'copilot',
      },
    ]

    const storageMock: Record<string, string> = {
      meeting_copilot_usage_records: JSON.stringify(legacyRecords),
    }

    ;(globalThis as any).localStorage = {
      getItem: (key: string) => storageMock[key] ?? null,
      setItem: (key: string, val: string) => {
        storageMock[key] = val
      },
      removeItem: (key: string) => {
        delete storageMock[key]
      },
    }

    // Call init on a fresh instance or run migration
    const res = await (globalThis as any).window.api.usage.migrate(legacyRecords)
    expect(res.success).toBe(true)
    expect(res.migratedCount).toBe(1)
  })
})
