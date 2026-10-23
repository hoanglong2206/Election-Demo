export type AudioDeviceKind = 'audiooutput' | 'audioinput'
export type AudioDeviceCategory = 'speaker' | 'headphone' | 'bluetooth' | 'system'

export interface AudioDeviceInfo {
  deviceId: string
  label: string
  kind: AudioDeviceKind
  type: AudioDeviceCategory
}
