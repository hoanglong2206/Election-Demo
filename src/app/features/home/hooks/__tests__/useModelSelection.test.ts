import '@/test/setupDom'
import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useModelSelection } from '../useModelSelection'

describe('useModelSelection Hook', () => {
  it('initializes models and manages dropdown and inspection state', () => {
    const { result } = renderHook(() => useModelSelection())

    expect(result.current.settingModelId).toBeDefined()
    expect(result.current.inspectedModelId).toBeDefined()
    expect(result.current.isModelDropdownOpen).toBe(false)
    expect(result.current.isSTTDropdownOpen).toBe(false)

    act(() => {
      result.current.setIsModelDropdownOpen(true)
    })
    expect(result.current.isModelDropdownOpen).toBe(true)

    act(() => {
      result.current.handleModelInspectChange('llama-3.3-70b')
    })
    expect(result.current.inspectedModelId).toBe('llama-3.3-70b')
    expect(result.current.isModelDropdownOpen).toBe(false)
  })

  it('manages STT engine inspection and toggles', () => {
    const { result } = renderHook(() => useModelSelection())

    act(() => {
      result.current.setIsSTTDropdownOpen(true)
    })
    expect(result.current.isSTTDropdownOpen).toBe(true)

    act(() => {
      result.current.handleSTTInspectChange('local-whisper')
    })
    expect(result.current.inspectedSTTId).toBe('local-whisper')
    expect(result.current.isSTTDropdownOpen).toBe(false)
  })
})
