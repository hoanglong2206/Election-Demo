import type { AudioDeviceInfo } from './types'

export const PRESET_AUDIO_DEVICES: AudioDeviceInfo[] = [
  {
    deviceId: 'default-loopback',
    label: 'Loopback Output (Âm thanh hệ thống / YouTube / Calls)',
    kind: 'audiooutput',
    type: 'system',
  },
  {
    deviceId: 'realtek-speakers',
    label: 'Loa ngoài (Realtek High Definition Audio)',
    kind: 'audiooutput',
    type: 'speaker',
  },
  {
    deviceId: 'wired-headphones',
    label: 'Tai nghe dây (3.5mm Headphone Jack / USB Audio)',
    kind: 'audiooutput',
    type: 'headphone',
  },
  {
    deviceId: 'airpods-bluetooth',
    label: 'AirPods Pro / Bluetooth Headset (Stereo Audio)',
    kind: 'audiooutput',
    type: 'bluetooth',
  },
]
