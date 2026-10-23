import type { AudioDeviceInfo } from './types'
import { PRESET_AUDIO_DEVICES } from './presets'
import { classifyAudioDevice } from './classifier'

/**
 * Enumerates hardware media devices safely, classifies them, and merges with presets.
 */
export async function enumerateSystemAudioDevices(): Promise<AudioDeviceInfo[]> {
  const result: AudioDeviceInfo[] = [...PRESET_AUDIO_DEVICES]

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return result
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioDevices = devices.filter(
      (d) => d.kind === 'audiooutput' || d.kind === 'audioinput'
    )

    if (audioDevices.length === 0) {
      return result
    }

    const detected: AudioDeviceInfo[] = audioDevices.map((d, idx) => {
      const label = (d.label || '').trim()
      const fallbackLabel = `Thiết bị âm thanh ${idx + 1} (${
        d.kind === 'audiooutput' ? 'Đầu ra' : 'Đầu vào'
      })`

      return {
        deviceId: d.deviceId || `detected-${idx}`,
        label: label || fallbackLabel,
        kind: d.kind as 'audiooutput' | 'audioinput',
        type: classifyAudioDevice(label),
      }
    })

    const unique = detected.filter((d) => d.label.trim().length > 0)
    if (unique.length > 0) {
      return [
        PRESET_AUDIO_DEVICES[0],
        ...unique.filter((u) => u.deviceId !== 'default-loopback'),
      ]
    }
  } catch (err) {
    console.warn('[AudioDevices] Could not enumerate hardware media devices:', err)
  }

  return result
}
