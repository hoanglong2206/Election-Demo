import type { AudioDeviceInfo } from './types'

export const DEFAULT_LOOPBACK_DEVICE: AudioDeviceInfo = {
  deviceId: 'default-loopback',
  label: 'Loopback Output (Âm thanh hệ thống / YouTube / Calls)',
  kind: 'audiooutput',
  type: 'system',
}

export const PRESET_AUDIO_DEVICES: AudioDeviceInfo[] = [
  DEFAULT_LOOPBACK_DEVICE,
]
