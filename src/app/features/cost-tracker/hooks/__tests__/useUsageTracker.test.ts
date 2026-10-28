import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useUsageTracker } from '../useUsageTracker'
import { usageTrackerService } from '@/services/usage-tracker'

describe('useUsageTracker Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    usageTrackerService.resetLocalStatistics(true)
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with default summary, budget, and records', () => {
    const { result } = renderHook(() => useUsageTracker())

    expect(result.current.summary).toBeDefined()
    expect(result.current.budget).toBeDefined()
    expect(Array.isArray(result.current.records)).toBe(true)
    expect(result.current.isRefreshing).toBe(false)
    expect(result.current.isResetConfirmOpen).toBe(false)
  })

  it('updates budget settings via handleUpdateBudget', () => {
    const { result } = renderHook(() => useUsageTracker())

    act(() => {
      result.current.handleUpdateBudget({ monthlyBudgetLimitUsd: 50, warningThresholdPercent: 75 })
    })

    expect(result.current.budget.monthlyBudgetLimitUsd).toBe(50)
    expect(result.current.budget.warningThresholdPercent).toBe(75)
  })

  it('seeds demo data and refreshes records', () => {
    const { result } = renderHook(() => useUsageTracker())

    act(() => {
      result.current.handleSeedDemoData()
    })

    expect(result.current.demoLoadedSuccess).toBe(true)
    expect(result.current.records.length).toBeGreaterThan(0)
  })

  it('resets local statistics and sets isResetSuccess flag', () => {
    const { result } = renderHook(() => useUsageTracker())

    // First seed some records
    act(() => {
      result.current.handleSeedDemoData()
    })
    expect(result.current.records.length).toBeGreaterThan(0)

    // Then reset
    act(() => {
      result.current.handleResetConfirmed()
    })

    expect(result.current.isResetSuccess).toBe(true)
    expect(result.current.records.length).toBe(0)
  })

  it('returns daily history for chart ranges', () => {
    const { result } = renderHook(() => useUsageTracker())
    const history = result.current.getDailyHistory(7)
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBe(7)
  })
})

