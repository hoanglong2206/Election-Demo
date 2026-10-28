import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useModelSync } from '../useModelSync'

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

  it('handles sync models execution gracefully', async () => {
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
    // syncStatus or syncMeta should be updated
    expect(result.current.syncMeta).toBeDefined()
  })
})
