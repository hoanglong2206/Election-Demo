import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useModelSync } from '../useModelSync'
import * as aiModels from '@/services/ai-model/aiModels'

describe('useModelSync Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with model registry sync state', () => {
    const setSelectedLLM = () => {}
    const setModelsList = () => {}

    const { result } = renderHook(() =>
      useModelSync({
        selectedLLM: 'gpt-4o',
        setSelectedLLM,
        setModelsList,
      })
    )

    expect(result.current.syncMeta).toBeDefined()
    expect(result.current.isSyncing).toBe(false)
    expect(result.current.syncActionState).toBe('idle')
    expect(result.current.syncStatus).toBeNull()
  })

  it('syncModelsSelection updates modelsList and keeps or sets selectedLLM', () => {
    let currentSelected = ''
    let modelsCount = 0
    const setSelectedLLM = (id: string) => {
      currentSelected = id
    }
    const setModelsList = (models: any[]) => {
      modelsCount = models.length
    }

    const { result } = renderHook(() =>
      useModelSync({
        selectedLLM: currentSelected,
        setSelectedLLM,
        setModelsList,
      })
    )

    act(() => {
      result.current.syncModelsSelection([
        { id: 'model-1', name: 'Model 1', provider: 'openai' } as any,
        { id: 'model-2', name: 'Model 2', provider: 'groq' } as any,
      ])
    })

    expect(modelsCount).toBe(2)
    expect(currentSelected).toBe('model-1')
  })

  it('handles sync models execution gracefully with distinct action states', async () => {
    const syncSpy = spyOn(aiModels, 'syncActiveAIModels').mockResolvedValue({
      success: true,
      totalLoaded: 5,
      providerBreakdown: 'Groq: 5',
    })

    const { result } = renderHook(() =>
      useModelSync({
        selectedLLM: '',
        setSelectedLLM: () => {},
        setModelsList: () => {},
      })
    )

    await act(async () => {
      await result.current.handleSyncModels()
    })

    expect(result.current.isSyncing).toBe(false)
    expect(result.current.syncActionState).toBe('success')
    expect(result.current.syncStatus?.isError).toBe(false)
    expect(result.current.syncStatus?.text).toContain('Đồng bộ API thành công')

    syncSpy.mockRestore()
  })

  it('handles sync errors without disguised success state', async () => {
    const syncSpy = spyOn(aiModels, 'syncActiveAIModels').mockResolvedValue({
      success: false,
      totalLoaded: 0,
      providerBreakdown: '',
      error: 'Network timeout',
    })

    const { result } = renderHook(() =>
      useModelSync({
        selectedLLM: '',
        setSelectedLLM: () => {},
        setModelsList: () => {},
      })
    )

    await act(async () => {
      await result.current.handleSyncModels()
    })

    expect(result.current.isSyncing).toBe(false)
    expect(result.current.syncActionState).toBe('error')
    expect(result.current.syncStatus?.isError).toBe(true)
    expect(result.current.syncStatus?.text).toContain('Network timeout')

    syncSpy.mockRestore()
  })
})
