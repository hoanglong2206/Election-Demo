import '@/test/setupDom'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { render, act, cleanup } from '@testing-library/react'
import { AudioDeviceSelectorCard } from '../AudioDeviceSelectorCard'
import type { AudioDeviceInfo } from '@/services/audio-devices'

describe('AudioDeviceSelectorCard Component', () => {
  beforeEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  const mockDevices: AudioDeviceInfo[] = [
    {
      deviceId: 'default-loopback',
      label: 'Loopback Output (Âm thanh hệ thống / YouTube / Calls)',
      kind: 'audiooutput',
      type: 'system',
    },
    {
      deviceId: 'hw-mic-1',
      label: 'Realtek High Definition Audio Mic',
      kind: 'audioinput',
      type: 'headphone',
    },
  ]

  it('renders the active device from saved settings', async () => {
    let result: any
    await act(async () => {
      result = render(
        <AudioDeviceSelectorCard
          audioDevices={mockDevices}
          savedDeviceId="default-loopback"
          savedAudioDevice={mockDevices[0]}
          isScanningDevices={false}
          isAudioDropdownOpen={false}
          audioDropdownRef={{ current: null }}
          onToggleDropdown={() => {}}
          onRefreshDevices={() => {}}
          onOpenAudioTest={() => {}}
        />
      )
    })

    expect(result.getByText('Thiết Bị Âm Thanh')).toBeDefined()
    expect(result.getByText('Theo Cài Đặt')).toBeDefined()
    expect(result.getByText('Loopback Output (Âm thanh hệ thống / YouTube / Calls)')).toBeDefined()
  })

  it('only renders "Đang kích hoạt" badge for the saved device, other devices get "Đổi ở Cài đặt"', async () => {
    const handleOpenSettings = mock(() => {})
    let result: any

    await act(async () => {
      result = render(
        <AudioDeviceSelectorCard
          audioDevices={mockDevices}
          savedDeviceId="default-loopback"
          savedAudioDevice={mockDevices[0]}
          isScanningDevices={false}
          isAudioDropdownOpen={true}
          audioDropdownRef={{ current: null }}
          onToggleDropdown={() => {}}
          onRefreshDevices={() => {}}
          onOpenAudioTest={() => {}}
          onOpenSettings={handleOpenSettings}
        />
      )
    })

    // Exactly 1 "Đang kích hoạt" badge
    const activeBadges = result.getAllByText('Đang kích hoạt')
    expect(activeBadges.length).toBe(1)

  })
})
