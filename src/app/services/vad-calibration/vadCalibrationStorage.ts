import { VAD_ENERGY_THRESHOLD } from '../../core/audio/AudioBufferManager'
import type { VADCalibrationRecord, VADCalibrationResult } from './types'

const VAD_CALIBRATION_STORAGE_KEY = 'meeting_copilot_vad_calibrations'

type CalibrationsMap = Record<string, VADCalibrationRecord>

function readStorageMap(): CalibrationsMap {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(VAD_CALIBRATION_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as CalibrationsMap
  } catch (err) {
    console.warn('[VADCalibrationStorage] Failed to read calibration data from localStorage:', err)
    return {}
  }
}

function writeStorageMap(map: CalibrationsMap): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }
  try {
    window.localStorage.setItem(VAD_CALIBRATION_STORAGE_KEY, JSON.stringify(map))
  } catch (err) {
    console.warn('[VADCalibrationStorage] Failed to persist calibration data:', err)
  }
}

const listeners = new Set<(deviceId: string, record: VADCalibrationRecord | null) => void>()

function notifyListeners(deviceId: string, record: VADCalibrationRecord | null) {
  for (const listener of listeners) {
    try {
      listener(deviceId, record)
    } catch (err) {
      console.error('[VADCalibrationStorage] Listener error:', err)
    }
  }
}

/**
 * Retrieves the calibrated VAD record strictly associated with the given deviceId.
 * If no calibration exists for this specific device, returns null.
 * (Does NOT cross-apply calibration from other devices).
 */
export function getVADCalibration(deviceId: string): VADCalibrationRecord | null {
  if (!deviceId) return null
  const map = readStorageMap()
  return map[deviceId] || null
}

/**
 * Returns all saved calibration records keyed by deviceId.
 */
export function getAllVADCalibrations(): Record<string, VADCalibrationRecord> {
  return readStorageMap()
}

/**
 * Persists a calibration result for a specific deviceId.
 */
export function saveVADCalibration(result: VADCalibrationResult): VADCalibrationRecord {
  const map = readStorageMap()
  const record: VADCalibrationRecord = {
    ...result,
    updatedAt: Date.now(),
  }
  map[result.deviceId] = record
  writeStorageMap(map)
  notifyListeners(result.deviceId, record)
  return record
}

/**
 * Deletes the calibration record for a specific device.
 */
export function removeVADCalibration(deviceId: string): void {
  if (!deviceId) return
  const map = readStorageMap()
  if (map[deviceId]) {
    delete map[deviceId]
    writeStorageMap(map)
    notifyListeners(deviceId, null)
  }
}

/**
 * Clears all saved VAD calibrations across all devices.
 */
export function clearAllVADCalibrations(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(VAD_CALIBRATION_STORAGE_KEY)
  }
  notifyListeners('*', null)
}

/**
 * Returns the effective VAD speech energy threshold (RMS) for the active device.
 * If calibrated, returns `speechThresholdRms`.
 * If uncalibrated, falls back to standard baseline `VAD_ENERGY_THRESHOLD` (0.008).
 */
export function getEffectiveVadEnergyThreshold(deviceId?: string): number {
  if (!deviceId) return VAD_ENERGY_THRESHOLD
  const record = getVADCalibration(deviceId)
  if (
    record &&
    typeof record.speechThresholdRms === 'number' &&
    Number.isFinite(record.speechThresholdRms) &&
    record.speechThresholdRms > 0.0001 &&
    record.speechThresholdRms <= 1.0
  ) {
    return record.speechThresholdRms
  }
  return VAD_ENERGY_THRESHOLD
}

/**
 * Subscribes to calibration changes (for reactivity across components).
 */
export function onVADCalibrationChange(
  callback: (deviceId: string, record: VADCalibrationRecord | null) => void
): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}
