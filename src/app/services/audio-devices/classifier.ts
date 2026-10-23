import type { AudioDeviceCategory } from './types'

/**
 * Heuristically classifies audio device into semantic category based on device label.
 */
export function classifyAudioDevice(label: string): AudioDeviceCategory {
  const lower = label.toLowerCase()

  if (
    lower.includes('bluetooth') ||
    lower.includes('airpod') ||
    lower.includes('wireless') ||
    lower.includes('buds')
  ) {
    return 'bluetooth'
  }

  if (
    lower.includes('headphone') ||
    lower.includes('tai nghe') ||
    lower.includes('earphone') ||
    lower.includes('headset')
  ) {
    return 'headphone'
  }

  if (
    lower.includes('loopback') ||
    lower.includes('stereo mix') ||
    lower.includes('virtual') ||
    lower.includes('cable')
  ) {
    return 'system'
  }

  return 'speaker'
}
