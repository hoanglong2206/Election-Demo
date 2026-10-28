import '@/test/setupDom'
import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useLLMBenchmark } from '../useLLMBenchmark'

describe('useLLMBenchmark hook', () => {
  it('initializes with loaded models and selected model id', () => {
    const { result } = renderHook(() => useLLMBenchmark())

    expect(Array.isArray(result.current.allLLMModels)).toBe(true)
    expect(typeof result.current.selectedLLMId).toBe('string')
    expect(result.current.currentLLM).toBeDefined()
    expect(result.current.isBenchmarking).toBe(false)
    expect(result.current.benchmarkResult).toBeNull()
  })

  it('allows switching selected model id', () => {
    const { result } = renderHook(() => useLLMBenchmark())

    act(() => {
      result.current.setSelectedLLMId('test-model-id')
    })

    expect(result.current.selectedLLMId).toBe('test-model-id')
  })

  it('clears benchmark result cleanly', () => {
    const { result } = renderHook(() => useLLMBenchmark())

    act(() => {
      result.current.clearBenchmarkResult()
    })

    expect(result.current.benchmarkResult).toBeNull()
  })
})
