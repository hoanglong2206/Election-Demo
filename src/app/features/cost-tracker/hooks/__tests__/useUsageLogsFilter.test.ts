import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useUsageLogsFilter } from '../useUsageLogsFilter'
import type { UsageRecord } from '@/services/usage-tracker'

const mockRecords: UsageRecord[] = [
  {
    id: 'rec_1',
    timestamp: 1700000000000,
    provider: 'Google',
    model: 'gemini-2.5-flash',
    feature: 'copilot',
    inputTokens: 100,
    outputTokens: 200,
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

describe('useUsageLogsFilter Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with given records and unique providers/features', () => {
    const { result } = renderHook(() =>
      useUsageLogsFilter({ initialRecords: mockRecords })
    )

    expect(result.current.records.length).toBe(2)
    expect(result.current.uniqueProviders).toEqual(['Google', 'OpenAI'])
    expect(result.current.uniqueFeatures).toEqual(['copilot', 'translate'])
    expect(result.current.filteredRecords.length).toBe(2)
  })

  it('filters records when search query is updated', () => {
    const { result } = renderHook(() =>
      useUsageLogsFilter({ initialRecords: mockRecords })
    )

    act(() => {
      result.current.setSearchQuery('gemini')
    })

    expect(result.current.filteredRecords.length).toBe(1)
    expect(result.current.filteredRecords[0].id).toBe('rec_1')
  })

  it('filters records when provider is selected', () => {
    const { result } = renderHook(() =>
      useUsageLogsFilter({ initialRecords: mockRecords })
    )

    act(() => {
      result.current.setSelectedProvider('OpenAI')
    })

    expect(result.current.filteredRecords.length).toBe(1)
    expect(result.current.filteredRecords[0].id).toBe('rec_2')
  })

  it('filters records when feature is selected', () => {
    const { result } = renderHook(() =>
      useUsageLogsFilter({ initialRecords: mockRecords })
    )

    act(() => {
      result.current.setSelectedFeature('translate')
    })

    expect(result.current.filteredRecords.length).toBe(1)
    expect(result.current.filteredRecords[0].feature).toBe('translate')
  })
})
