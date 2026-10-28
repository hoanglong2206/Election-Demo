import '@/test/setupDom'
import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useAudioDeviceSelection } from '../useAudioDeviceSelection'

describe('useAudioDeviceSelection Hook', () => {
  it('initializes with default devices and manages selection', async () => {
    const { result } = renderHook(() => useAudioDeviceSelection())

    expect(result.current.isAudioDropdownOpen).toBe(false)
    expect(result.current.isScanningDevices).toBe(false)

    act(() => {
      result.current.setIsAudioDropdownOpen(true)
    })
    expect(result.current.isAudioDropdownOpen).toBe(true)

    act(() => {
      result.current.handleDeviceChange('test-device-id')
    })
    expect(result.current.selectedDeviceId).toBe('test-device-id')
    expect(result.current.isAudioDropdownOpen).toBe(false)
  })

  it('triggers refresh devices cleanly', async () => {
    const { result } = renderHook(() => useAudioDeviceSelection())

    await act(async () => {
      await result.current.handleRefreshDevices()
    })

    expect(result.current.audioDevices).toBeDefined()
  })
})
