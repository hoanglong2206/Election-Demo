import {
  analyzeCalibrationAudio,
  saveVADCalibration,
  VADCalibrationGuardError,
  type VADCalibrationRecord,
} from '@/services/vad-calibration'
import type { VADCalibrationState } from '../types'

export interface VADCalibrationControllerOptions {
  getRecentPcmSamples: (seconds?: number) => Int16Array
  getDeviceId: () => string
  getDeviceDisplayName: () => string
  calibrationDurationSec?: number
}

export class VADCalibrationController {
  private state: VADCalibrationState = {
    step: 'idle',
    countdown: 3,
    samplingProgress: 0,
    safetyMarginDb: 6.0,
    calibrationResult: null,
    guardErrorMessage: null,
  }

  private listeners = new Set<(state: VADCalibrationState) => void>()
  private countdownTimer: ReturnType<typeof setInterval> | null = null
  private samplingTimer: ReturnType<typeof setInterval> | null = null
  private startTime = 0
  private options: VADCalibrationControllerOptions
  private readonly durationSec: number

  constructor(options: VADCalibrationControllerOptions) {
    this.options = options
    this.durationSec = options.calibrationDurationSec ?? 3.0
  }

  public setOptions(options: Partial<VADCalibrationControllerOptions>): void {
    this.options = { ...this.options, ...options }
  }

  public getState(): VADCalibrationState {
    return this.state
  }

  public subscribe(listener: (state: VADCalibrationState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private updateState(partial: Partial<VADCalibrationState>): void {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  public cleanupTimers(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer)
      this.samplingTimer = null
    }
  }

  public setSafetyMarginDb(marginDb: number): void {
    this.updateState({ safetyMarginDb: marginDb })
  }

  public async startCalibration(params: {
    startCapture: () => Promise<void>
    isCapturing: boolean
    sourceType: 'mic' | 'system'
    setSourceType: (type: 'mic' | 'system') => void
  }): Promise<void> {
    this.cleanupTimers()
    this.updateState({
      step: 'countdown',
      countdown: 3,
      guardErrorMessage: null,
      calibrationResult: null,
    })

    if (params.sourceType !== 'mic') {
      params.setSourceType('mic')
    }

    if (!params.isCapturing) {
      try {
        await params.startCapture()
      } catch (err) {
        console.error('[VADCalibrationController] Failed to start audio capture:', err)
        this.updateState({
          step: 'guard_error',
          guardErrorMessage: 'Không thể mở microphone để đo âm thanh. Vui lòng cấp quyền micro.',
        })
        return
      }
    }

    let remaining = 3
    this.countdownTimer = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        this.updateState({ countdown: remaining })
      } else {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer)
          this.countdownTimer = null
        }
        this.startSampling()
      }
    }, 1000)
  }

  public startSampling(): void {
    this.updateState({
      step: 'sampling',
      samplingProgress: 0,
    })
    this.startTime = performance.now()

    this.samplingTimer = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000
      const progress = Math.min(100, Math.round((elapsed / this.durationSec) * 100))
      this.updateState({ samplingProgress: progress })

      if (elapsed >= this.durationSec) {
        this.cleanupTimers()
        this.finishSamplingAndAnalyze()
      }
    }, 50)
  }

  public finishSamplingAndAnalyze(): void {
    try {
      const pcm16 = this.options.getRecentPcmSamples(this.durationSec)
      const deviceId = this.options.getDeviceId()
      const deviceName = this.options.getDeviceDisplayName()

      const result = analyzeCalibrationAudio(pcm16, deviceId, deviceName, {
        durationSec: this.durationSec,
        safetyMarginDb: this.state.safetyMarginDb,
      })

      this.updateState({
        calibrationResult: result,
        step: 'analyzed',
      })
    } catch (err: unknown) {
      console.warn('[VADCalibrationController] Guard triggered:', err)
      const message =
        err instanceof VADCalibrationGuardError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi không xác định khi phân tích âm thanh nền.'

      this.updateState({
        guardErrorMessage: message,
        step: 'guard_error',
      })
    }
  }

  public acceptCalibration(options: {
    setVadEnergyThreshold: (threshold: number) => void
  }): VADCalibrationRecord | null {
    if (!this.state.calibrationResult) return null

    const record = saveVADCalibration(this.state.calibrationResult)
    options.setVadEnergyThreshold(this.state.calibrationResult.speechThresholdRms)

    this.cleanupTimers()
    return record
  }

  public cancelCalibration(options?: {
    stopCapture?: () => void
    wasCapturingBefore?: boolean
  }): void {
    this.cleanupTimers()
    if (options?.stopCapture && !options?.wasCapturingBefore) {
      options.stopCapture()
    }
    if (
      this.state.step === 'idle' &&
      this.state.samplingProgress === 0 &&
      this.state.guardErrorMessage === null
    ) {
      return
    }
    this.updateState({
      step: 'idle',
      samplingProgress: 0,
      guardErrorMessage: null,
    })
  }

  public reset(): void {
    this.cleanupTimers()
    this.updateState({
      step: 'idle',
      countdown: 3,
      samplingProgress: 0,
      calibrationResult: null,
      guardErrorMessage: null,
    })
  }

  public destroy(): void {
    this.cleanupTimers()
    this.listeners.clear()
  }
}
