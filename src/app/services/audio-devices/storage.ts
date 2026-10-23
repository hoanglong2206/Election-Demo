import { settingsManager } from '../settings'

const DEFAULT_DEVICE_ID = 'default-loopback'

export function getSavedAudioDeviceId(): string {
  return settingsManager.get('audioDeviceId') || DEFAULT_DEVICE_ID
}

export function saveAudioDeviceId(deviceId: string): void {
  settingsManager.set('audioDeviceId', deviceId)
}
