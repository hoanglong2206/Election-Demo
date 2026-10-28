import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useVADCalibration } from '../useVADCalibration'

describe('useVADCalibration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with idle state and exposes controller actions', () => {
    const startCapture = mock(async () => {})
    const stopCapture = mock(() => {})
    const setSourceType = mock(() => {})
    const getRecentPcmSamples = mock(() => new Int16Array(100))
    const setVadEnergyThreshold = mock(() => {})
    const onClose = mock(() => {})

    const { result } = renderHook(() =>
      useVADCalibration({
        isOpen: true,
        activeDeviceId: 'mic-1',
        activeDeviceName: 'Studio Mic',
        isCapturing: true,
        sourceType: 'mic',
        setSourceType,
        startCapture,
        stopCapture,
        getRecentPcmSamples,
        setVadEnergyThreshold,
        onClose,
      })
    )

    expect(result.current.state.step).toBe('idle')
    expect(result.current.state.safetyMarginDb).toBe(6.0)

    act(() => {
      result.current.setSafetyMarginDb(9.0)
    })
    expect(result.current.state.safetyMarginDb).toBe(9.0)

    act(() => {
      result.current.closeModal()
    })
    expect(onClose).toHaveBeenCalled()
  })
})
