// ── Domain Types for Automatic Voice Activity Detection Calibration ──────────────

export type EnvironmentQuality = 'pristine' | 'good' | 'moderate' | 'noisy' | 'critical'

export interface VADCalibrationOptions {
  durationSec?: number // Duration of silence calibration (default 3.0s)
  frameDurationMs?: number // Frame slice duration (default 50ms = 800 samples @ 16kHz)
  safetyMarginDb?: number // Safety margin above noise floor (default 6.0 dB)
  highNoiseThresholdDbfs?: number // Max allowable noise floor (default -20 dBFS)
  speechContaminationThresholdDbfs?: number // Threshold indicating speech/crying (default -28 dBFS)
  maxContaminationRatio?: number // Max fraction of speech-like frames allowed (default 0.40)
}

export interface VADCalibrationFrame {
  index: number
  sampleCount: number
  rms: number
  dbfs: number
  timestampMs: number
  isOutlier: boolean
}

export interface VADNoiseDistribution {
  minDbfs: number
  maxDbfs: number
  medianDbfs: number
  p65Dbfs: number
  q1Dbfs: number
  q3Dbfs: number
  iqr: number
  outlierCutoffDbfs: number
}

export interface VADCalibrationResult {
  deviceId: string
  deviceName?: string
  timestamp: number
  noiseFloorDbfs: number
  noiseFloorRms: number
  safetyMarginDb: number
  speechThresholdDbfs: number
  speechThresholdRms: number
  sensitivity: number // Normalized 0.0 (least sensitive / highest threshold) to 1.0 (most sensitive)
  quality: EnvironmentQuality
  qualityLabel: string
  totalFrames: number
  inlierFrames: number
  outlierFrames: number
  distribution: VADNoiseDistribution
}

export interface VADCalibrationRecord extends VADCalibrationResult {
  updatedAt: number
}

export class VADCalibrationGuardError extends Error {
  public readonly code: 'ENVIRONMENT_TOO_NOISY' | 'SPEECH_DETECTED' | 'INSUFFICIENT_AUDIO_SAMPLES'

  constructor(
    code: 'ENVIRONMENT_TOO_NOISY' | 'SPEECH_DETECTED' | 'INSUFFICIENT_AUDIO_SAMPLES',
    message: string
  ) {
    super(message)
    this.name = 'VADCalibrationGuardError'
    this.code = code
  }
}
