import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useVisionDiagnostic } from '../useVisionDiagnostic'
import { screenCaptureService } from '@/services/screen-capture'

describe('useVisionDiagnostic hook', () => {
  it('initializes with default vision state and available models', () => {
    const { result } = renderHook(() => useVisionDiagnostic())

    expect(result.current.state.isCapturing).toBe(false)
    expect(result.current.state.isSourcePickerOpen).toBe(false)
    expect(result.current.state.capturedImage).toBeNull()
    expect(result.current.state.isCropping).toBe(false)
    expect(Array.isArray(result.current.availableVisionModels)).toBe(true)
  })

  it('opens and closes source picker correctly', () => {
    const { result } = renderHook(() => useVisionDiagnostic())

    act(() => {
      result.current.handleTriggerScreenCapture(true)
    })
    expect(result.current.state.isSourcePickerOpen).toBe(true)
    expect(result.current.state.cropAfterCapture).toBe(true)

    act(() => {
      result.current.handleCloseSourcePicker()
    })
    expect(result.current.state.isSourcePickerOpen).toBe(false)
  })

  it('updates implementation language and vision model cleanly', () => {
    const { result } = renderHook(() => useVisionDiagnostic())

    act(() => {
      result.current.handleImplementationLanguageChange('typescript')
      result.current.handleSetVisionModel('gemini-2.5-flash')
    })

    expect(result.current.state.selectedImplementationLanguage).toBe('typescript')
    expect(result.current.state.selectedVisionId).toBe('gemini-2.5-flash')
  })

  it('captures screen successfully and enters crop mode if cropImmediately was set', async () => {
    const mockImage = {
      dataUrl: 'data:image/jpeg;base64,mockdata',
      width: 1920,
      height: 1080,
      source: 'screen' as const,
      capturedAt: Date.now(),
    }
    const origCapture = screenCaptureService.captureScreen
    screenCaptureService.captureScreen = mock(async () => mockImage as any)

    const { result } = renderHook(() => useVisionDiagnostic())

    act(() => {
      result.current.handleTriggerScreenCapture(true)
    })

    await act(async () => {
      await result.current.handleStartScreenCapture({ sourceType: 'screen' })
    })

    expect(result.current.state.capturedImage).toEqual(mockImage as any)
    expect(result.current.state.isCropping).toBe(true)

    screenCaptureService.captureScreen = origCapture
  })
})
