import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useSettingsForm } from '../useSettingsForm'
import { settingsManager } from '@/services/settings'

describe('useSettingsForm Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with default settings', () => {
    const { result } = renderHook(() => useSettingsForm())

    expect(result.current.llmProvider).toBeDefined()
    expect(result.current.sttEnginesList.length).toBeGreaterThan(0)
    expect(Array.isArray(result.current.modelsList)).toBe(true)
    expect(result.current.currentSTT).toBeDefined()
    expect(result.current.currentLLM).toBeDefined()
    expect(result.current.currentDevice).toBeDefined()
    expect(result.current.segmentationMode).toBe('sentence')
    expect(result.current.silenceEndMs).toBe(400)
    expect(result.current.maxSegmentMs).toBe(4500)
  })

  it('updates form fields', () => {
    const { result } = renderHook(() => useSettingsForm())

    act(() => {
      result.current.setLlmProvider('OpenAI')
      result.current.setVadThreshold('0.5')
      result.current.setResponseLang('en')
      result.current.setSegmentationMode('fixed')
      result.current.setSilenceEndMs(600)
      result.current.setMaxSegmentMs(6000)
    })

    expect(result.current.llmProvider).toBe('OpenAI')
    expect(result.current.vadThreshold).toBe('0.5')
    expect(result.current.responseLang).toBe('en')
    expect(result.current.segmentationMode).toBe('fixed')
    expect(result.current.silenceEndMs).toBe(600)
    expect(result.current.maxSegmentMs).toBe(6000)
  })

  it('saves settings to storage on handleSaveSettings', async () => {
    const { result } = renderHook(() => useSettingsForm())

    act(() => {
      result.current.setSelectedMultimodal('gemini-1.5-flash')
      result.current.setLlmProvider('Google')
    })

    await act(async () => {
      await result.current.handleSaveSettings()
    })

    expect(settingsManager.get('selectedMultimodal')).toBe('gemini-1.5-flash')
  })
})
