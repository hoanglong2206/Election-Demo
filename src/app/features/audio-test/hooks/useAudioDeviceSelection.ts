import { useState, useEffect, useCallback } from 'react'
import {
  getSavedAudioDeviceId,
  saveAudioDeviceId,
  enumerateSystemAudioDevices,
  type AudioDeviceInfo,
} from '@/services/audio-devices'
import {
  getVADCalibration,
  getEffectiveVadEnergyThreshold,
  type VADCalibrationRecord,
} from '@/services/vad-calibration'

export interface UseAudioDeviceSelectionParams {
  isCapturing: boolean
  sourceType: 'mic' | 'system'
  switchDevice: (deviceId: string) => Promise<void>
  setVadEnergyThreshold: (threshold: number) => void
}

export function useAudioDeviceSelection({
  isCapturing,
  sourceType,
  switchDevice,
  setVadEnergyThreshold,
}: UseAudioDeviceSelectionParams) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => getSavedAudioDeviceId())
  const [availableDevices, setAvailableDevices] = useState<AudioDeviceInfo[]>([])
  const [calibratedRecord, setCalibratedRecord] = useState<VADCalibrationRecord | null>(() =>
    getVADCalibration(selectedDeviceId)
  )

  // Enumerate audio input devices on mount
  useEffect(() => {
    let isMounted = true
    enumerateSystemAudioDevices().then((devs) => {
      if (isMounted) {
        const mics = devs.filter((d) => d.kind === 'audioinput' || d.deviceId.includes('mic'))
        setAvailableDevices(mics.length > 0 ? mics : devs)
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Sync calibrated record when selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId) {
      const rec = getVADCalibration(selectedDeviceId)
      setCalibratedRecord(rec)
    }
  }, [selectedDeviceId])

  const handleSelectDevice = useCallback(
    async (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId)
      saveAudioDeviceId(newDeviceId)
      const rec = getVADCalibration(newDeviceId)
      setCalibratedRecord(rec)

      const effectiveThreshold = getEffectiveVadEnergyThreshold(newDeviceId)
      setVadEnergyThreshold(effectiveThreshold)

      if (isCapturing && sourceType === 'mic') {
        try {
          await switchDevice(newDeviceId)
        } catch (err) {
          console.warn('[useAudioDeviceSelection] switchDevice error:', err)
        }
      }
    },
    [isCapturing, sourceType, switchDevice, setVadEnergyThreshold]
  )

  const activeDeviceName = availableDevices.find((d) => d.deviceId === selectedDeviceId)?.label

  return {
    selectedDeviceId,
    availableDevices,
    calibratedRecord,
    activeDeviceName,
    handleSelectDevice,
    setCalibratedRecord,
  }
}
