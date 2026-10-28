import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useAudioDeviceSelection } from '../useAudioDeviceSelection'
import * as audioDevices from '@/services/audioDevices'

describe('useAudioDeviceSelection', () => {
  let spySave: ReturnType<typeof spyOn>
  let spyGet: ReturnType<typeof spyOn>
  let spyEnum: ReturnType<typeof spyOn>

  beforeEach(() => {
    spySave = spyOn(audioDevices, 'saveAudioDeviceId').mockImplementation(() => {})
    spyGet = spyOn(audioDevices, 'getSavedAudioDeviceId').mockReturnValue('mic-1')
    spyEnum = spyOn(audioDevices, 'enumerateSystemAudioDevices').mockResolvedValue([
      { deviceId: 'mic-1', label: 'Internal Mic', kind: 'audioinput', type: 'system' },
      { deviceId: 'mic-2', label: 'USB Mic', kind: 'audioinput', type: 'headphone' },
    ])
  })

  afterEach(() => {
    cleanup()
    spySave.mockRestore()
    spyGet.mockRestore()
    spyEnum.mockRestore()
  })

  it('initializes with saved audio device and enumerates available inputs', async () => {
    const switchDevice = mock(async () => {})
    const setVadEnergyThreshold = mock(() => {})

    const { result } = renderHook(() =>
      useAudioDeviceSelection({
        isCapturing: false,
        sourceType: 'mic',
        switchDevice,
        setVadEnergyThreshold,
      })
    )

    expect(result.current.selectedDeviceId).toBe('mic-1')

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.availableDevices.length).toBe(2)
    expect(result.current.activeDeviceName).toBe('Internal Mic')
  })

  it('handles selecting a new device and switches device if capturing on mic', async () => {
    const switchDevice = mock(async () => {})
    const setVadEnergyThreshold = mock(() => {})

    const { result } = renderHook(() =>
      useAudioDeviceSelection({
        isCapturing: true,
        sourceType: 'mic',
        switchDevice,
        setVadEnergyThreshold,
      })
    )

    await act(async () => {
      await result.current.handleSelectDevice('mic-2')
    })

    expect(result.current.selectedDeviceId).toBe('mic-2')
    expect(spySave).toHaveBeenCalledWith('mic-2')
    expect(switchDevice).toHaveBeenCalledWith('mic-2')
  })
})
