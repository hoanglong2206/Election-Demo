import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { VADCalibrationController } from '../VADCalibrationController'
import * as vadService from '@/services/vad-calibration'

describe('VADCalibrationController', () => {
  let controller: VADCalibrationController
  let mockGetPcm: ReturnType<typeof mock>
  let mockGetDeviceId: ReturnType<typeof mock>
  let mockGetDeviceName: ReturnType<typeof mock>
  let spyAnalyze: ReturnType<typeof spyOn>
  let spySave: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockGetPcm = mock(() => new Int16Array(16000 * 3))
    mockGetDeviceId = mock(() => 'mic-dev-1')
    mockGetDeviceName = mock(() => 'Studio Mic')

    spyAnalyze = spyOn(vadService, 'analyzeCalibrationAudio').mockReturnValue({} as any)
    spySave = spyOn(vadService, 'saveVADCalibration').mockReturnValue({} as any)

    controller = new VADCalibrationController({
      getRecentPcmSamples: mockGetPcm,
      getDeviceId: mockGetDeviceId,
      getDeviceDisplayName: mockGetDeviceName,
      calibrationDurationSec: 0.1, // fast for testing
    })
  })

  afterEach(() => {
    controller.destroy()
    spyAnalyze.mockRestore()
    spySave.mockRestore()
  })

  it('initializes with idle state and default safety margin', () => {
    const state = controller.getState()
    expect(state.step).toBe('idle')
    expect(state.countdown).toBe(3)
    expect(state.safetyMarginDb).toBe(6.0)
    expect(state.calibrationResult).toBeNull()
    expect(state.guardErrorMessage).toBeNull()
  })

  it('updates safety margin correctly', () => {
    controller.setSafetyMarginDb(9.0)
    expect(controller.getState().safetyMarginDb).toBe(9.0)
  })

  it('transitions through countdown to sampling and analyzed', async () => {
    const mockResult = {
      deviceId: 'mic-dev-1',
      deviceDisplayName: 'Studio Mic',
      timestamp: Date.now(),
      noiseFloorRms: 0.005,
      noiseFloorDbfs: -46.0,
      speechThresholdRms: 0.01,
      speechThresholdDbfs: -40.0,
      safetyMarginDb: 6.0,
      quality: 'good',
      qualityLabel: 'Tốt / Yên tĩnh',
      outlierRatio: 0.05,
      totalFrames: 60,
      inlierFrames: 57,
      outlierFrames: 3,
      sensitivity: 0.85,
    } as any

    spyAnalyze.mockReturnValue(mockResult)

    // Directly test sampling -> analyze
    controller.startSampling()
    expect(controller.getState().step).toBe('sampling')

    // Wait for 0.1s sampling to finish
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(controller.getState().step).toBe('analyzed')
    expect(controller.getState().calibrationResult).toEqual(mockResult)
    expect(spyAnalyze).toHaveBeenCalled()
  })

  it('handles guard error when analyze throws VADCalibrationGuardError', async () => {
    spyAnalyze.mockImplementation(() => {
      throw new vadService.VADCalibrationGuardError('ENVIRONMENT_TOO_NOISY', 'Phòng quá ồn')
    })

    controller.startSampling()
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(controller.getState().step).toBe('guard_error')
    expect(controller.getState().guardErrorMessage).toBe('Phòng quá ồn')
  })

  it('handles startCapture error and transitions to guard_error', async () => {
    const startCapture = mock(async () => {
      throw new Error('Permission denied')
    })
    const setSourceType = mock(() => {})

    await controller.startCalibration({
      startCapture,
      isCapturing: false,
      sourceType: 'mic',
      setSourceType,
    })

    expect(controller.getState().step).toBe('guard_error')
    expect(controller.getState().guardErrorMessage).toContain('Không thể mở microphone')
  })

  it('accepts calibration result and applies threshold', async () => {
    const mockResult = {
      speechThresholdRms: 0.025,
      speechThresholdDbfs: -32.0,
    } as any
    const mockRecord = { id: 'rec-1', ...mockResult }

    spySave.mockReturnValue(mockRecord)

    // Set analyzed state manually
    ;(controller as any).state.calibrationResult = mockResult
    ;(controller as any).state.step = 'analyzed'

    const setVadEnergyThreshold = mock(() => {})
    const record = controller.acceptCalibration({ setVadEnergyThreshold })

    expect(spySave).toHaveBeenCalledWith(mockResult)
    expect(setVadEnergyThreshold).toHaveBeenCalledWith(0.025)
    expect(record).toEqual(mockRecord)
  })

  it('cancels calibration and cleans up timers', () => {
    const stopCapture = mock(() => {})
    controller.startSampling()
    expect(controller.getState().step).toBe('sampling')

    controller.cancelCalibration({
      stopCapture,
      wasCapturingBefore: false,
    })

    expect(controller.getState().step).toBe('idle')
    expect(stopCapture).toHaveBeenCalled()
  })
})
