import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useAudioTestSTT } from '../useAudioTestSTT'
import { sttJobQueue } from '@/services/ai-model/stt'

describe('useAudioTestSTT', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with saved engine and subscribes to metrics', () => {
    const getAudioSegmentSince = mock(() => null)

    const { result } = renderHook(() =>
      useAudioTestSTT({
        isCapturing: false,
        sourceType: 'mic',
        getAudioSegmentSince,
      })
    )

    expect(result.current.selectedSTT).toBeDefined()
    expect(result.current.availableSTTEngines.length).toBeGreaterThan(0)
    expect(result.current.sttLines).toEqual([])
    expect(result.current.isTranscribing).toBe(false)
  })

  it('switches engine via setSelectedSTT', () => {
    const spySwitch = spyOn(sttJobQueue, 'handleProviderSwitch')
    const getAudioSegmentSince = mock(() => null)

    const { result } = renderHook(() =>
      useAudioTestSTT({
        isCapturing: false,
        sourceType: 'mic',
        getAudioSegmentSince,
      })
    )

    act(() => {
      result.current.setSelectedSTT('openai_whisper')
    })

    expect(result.current.selectedSTT).toBe('openai_whisper')
    expect(spySwitch).toHaveBeenCalledWith('openai_whisper')
  })

  it('simulates STT line generation and clears lines', () => {
    const spyReset = spyOn(sttJobQueue, 'reset')
    const getAudioSegmentSince = mock(() => null)

    const { result } = renderHook(() =>
      useAudioTestSTT({
        isCapturing: false,
        sourceType: 'mic',
        getAudioSegmentSince,
      })
    )

    act(() => {
      result.current.handleSimulateSTT()
    })

    expect(result.current.sttLines.length).toBe(1)
    expect(result.current.sttLines[0].originalEn).toBeDefined()
    expect(result.current.isSimulatingSTT).toBe(true)

    act(() => {
      result.current.handleClearSTT()
    })

    expect(result.current.sttLines.length).toBe(0)
    expect(result.current.isSimulatingSTT).toBe(false)
    expect(spyReset).toHaveBeenCalled()
  })
})
