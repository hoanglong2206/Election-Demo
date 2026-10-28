import { useState, useEffect, useRef, useCallback } from 'react'
import { VADCalibrationController } from '../controllers/VADCalibrationController'
import type { VADCalibrationRecord } from '@/services/vad-calibration'
import type { VADCalibrationState } from '../types'

export interface UseVADCalibrationParams {
  isOpen: boolean
  activeDeviceId?: string
  activeDeviceName?: string
  isCapturing: boolean
  sourceType: 'mic' | 'system'
  setSourceType: (type: 'mic' | 'system') => void
  startCapture: () => Promise<void>
  stopCapture: () => void
  getRecentPcmSamples: (seconds?: number) => Int16Array
  setVadEnergyThreshold: (threshold: number) => void
  onCalibrated?: (record: VADCalibrationRecord) => void
  onClose: () => void
}

export function useVADCalibration(params: UseVADCalibrationParams) {
  const {
    isOpen,
    activeDeviceId,
    activeDeviceName,
    isCapturing,
    sourceType,
    setSourceType,
    startCapture,
    stopCapture,
    getRecentPcmSamples,
    setVadEnergyThreshold,
    onCalibrated,
    onClose,
  } = params

  const wasCapturingBeforeRef = useRef(false)
  const prevIsOpenRef = useRef(isOpen)

  const [controller] = useState(() => {
    return new VADCalibrationController({
      getRecentPcmSamples,
      getDeviceId: () => activeDeviceId || 'default-mic',
      getDeviceDisplayName: () =>
        activeDeviceName ||
        (activeDeviceId?.includes('default') ? 'Microphone mặc định' : activeDeviceId || 'Microphone'),
      calibrationDurationSec: 3.0,
    })
  })

  // Keep controller options updated when props change
  useEffect(() => {
    controller.setOptions({
      getRecentPcmSamples,
      getDeviceId: () => activeDeviceId || 'default-mic',
      getDeviceDisplayName: () =>
        activeDeviceName ||
        (activeDeviceId?.includes('default') ? 'Microphone mặc định' : activeDeviceId || 'Microphone'),
    })
  }, [controller, getRecentPcmSamples, activeDeviceId, activeDeviceName])

  const [state, setState] = useState<VADCalibrationState>(() => controller.getState())

  useEffect(() => {
    return controller.subscribe((next) => {
      setState((prev) => (prev === next ? prev : next))
    })
  }, [controller])

  useEffect(() => {
    if (isOpen) {
      wasCapturingBeforeRef.current = isCapturing
    } else if (prevIsOpenRef.current) {
      controller.cancelCalibration()
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, controller, isCapturing])

  const beginCalibration = useCallback(async () => {
    await controller.startCalibration({
      startCapture,
      isCapturing,
      sourceType,
      setSourceType,
    })
  }, [controller, startCapture, isCapturing, sourceType, setSourceType])

  const cancelCalibration = useCallback(() => {
    controller.cancelCalibration({
      stopCapture,
      wasCapturingBefore: wasCapturingBeforeRef.current,
    })
  }, [controller, stopCapture])

  const closeModal = useCallback(() => {
    cancelCalibration()
    onClose()
  }, [cancelCalibration, onClose])

  const acceptCalibration = useCallback(() => {
    const record = controller.acceptCalibration({ setVadEnergyThreshold })
    if (record) {
      onCalibrated?.(record)
    }
    onClose()
  }, [controller, setVadEnergyThreshold, onCalibrated, onClose])

  const setSafetyMarginDb = useCallback(
    (marginDb: number) => {
      controller.setSafetyMarginDb(marginDb)
    },
    [controller]
  )

  return {
    state,
    beginCalibration,
    cancelCalibration,
    closeModal,
    acceptCalibration,
    setSafetyMarginDb,
  }
}
