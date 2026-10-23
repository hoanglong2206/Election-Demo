import type {
  EnvironmentQuality,
  VADCalibrationFrame,
  VADCalibrationOptions,
  VADCalibrationResult,
  VADNoiseDistribution,
} from './types'
import { VADCalibrationGuardError } from './types'

export const DEFAULT_CALIBRATION_OPTIONS: Required<VADCalibrationOptions> = {
  durationSec: 3.0,
  frameDurationMs: 50,
  safetyMarginDb: 6.0,
  highNoiseThresholdDbfs: -20.0,
  speechContaminationThresholdDbfs: -28.0,
  maxContaminationRatio: 0.4,
}

/**
 * Calculates Root Mean Square (RMS) and decibels relative to full scale (dBFS)
 * for a PCM 16-bit audio segment.
 */
export function calculateRmsAndDbfs(samples: Int16Array): { rms: number; dbfs: number } {
  if (samples.length === 0) {
    return { rms: 0, dbfs: -96.0 }
  }

  let sumSq = 0
  for (let i = 0; i < samples.length; i++) {
    const norm = samples[i] / 32768.0
    sumSq += norm * norm
  }

  const rms = Math.sqrt(sumSq / samples.length)
  // Clamp minimal energy to avoid -Infinity for pure zero silence
  const safeRms = Math.max(rms, 0.0000158) // -96 dBFS baseline
  const dbfs = Math.round(20 * Math.log10(safeRms) * 10) / 10

  return { rms, dbfs }
}

/**
 * Slices contiguous PCM 16-bit audio into discrete short frames (e.g. 50ms)
 * and calculates individual RMS and dBFS metrics per frame.
 */
export function sliceAudioIntoFrames(
  pcm16: Int16Array,
  sampleRate = 16000,
  frameDurationMs = 50
): { index: number; sampleCount: number; rms: number; dbfs: number; timestampMs: number }[] {
  const samplesPerFrame = Math.max(16, Math.round((sampleRate * frameDurationMs) / 1000))
  const totalFrames = Math.floor(pcm16.length / samplesPerFrame)
  const frames: {
    index: number
    sampleCount: number
    rms: number
    dbfs: number
    timestampMs: number
  }[] = []

  for (let i = 0; i < totalFrames; i++) {
    const start = i * samplesPerFrame
    const slice = pcm16.subarray(start, start + samplesPerFrame)
    const { rms, dbfs } = calculateRmsAndDbfs(slice)

    frames.push({
      index: i,
      sampleCount: samplesPerFrame,
      rms,
      dbfs,
      timestampMs: Math.round((start / sampleRate) * 1000),
    })
  }

  return frames
}

/**
 * Computes statistical percentiles (e.g. p25, median, p65, p75) from a sorted array of numbers.
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  const validValues = sortedValues.filter(Number.isFinite)
  if (validValues.length === 0) return -96.0
  if (validValues.length === 1) return validValues[0]

  const safePercentile = Number.isFinite(percentile)
    ? Math.max(0, Math.min(100, percentile))
    : 50

  const rank = (safePercentile / 100) * (validValues.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  const weight = rank - low

  const result = validValues[low] + weight * (validValues[high] - validValues[low])
  return Number.isFinite(result) ? result : -96.0
}

/**
 * Evaluates distribution of noise frames and identifies transient outliers (keyboard clacks,
 * coughs, mic bumps) using Interquartile Range (IQR) analysis.
 */
export function computeNoiseDistributionAndOutliers(
  rawFrames: { index: number; sampleCount: number; rms: number; dbfs: number; timestampMs: number }[]
): {
  distribution: VADNoiseDistribution
  frames: VADCalibrationFrame[]
  inliers: VADCalibrationFrame[]
  outliers: VADCalibrationFrame[]
} {
  if (rawFrames.length === 0) {
    const emptyDist: VADNoiseDistribution = {
      minDbfs: -96,
      maxDbfs: -96,
      medianDbfs: -96,
      p65Dbfs: -96,
      q1Dbfs: -96,
      q3Dbfs: -96,
      iqr: 0,
      outlierCutoffDbfs: -96,
    }
    return { distribution: emptyDist, frames: [], inliers: [], outliers: [] }
  }

  // Sort by dBFS for statistical percentiles
  const sortedDbfs = rawFrames.map((f) => f.dbfs).sort((a, b) => a - b)

  const minDbfs = sortedDbfs[0]
  const maxDbfs = sortedDbfs[sortedDbfs.length - 1]
  const q1Dbfs = calculatePercentile(sortedDbfs, 25)
  const medianDbfs = calculatePercentile(sortedDbfs, 50)
  const p65Dbfs = calculatePercentile(sortedDbfs, 65)
  const q3Dbfs = calculatePercentile(sortedDbfs, 75)

  // Interquartile Range (IQR)
  const iqr = Math.max(0.5, q3Dbfs - q1Dbfs)
  // Tukey's fences: values strictly higher than Q3 + 1.5 * IQR are transient outliers
  const outlierCutoffDbfs = Math.round((q3Dbfs + 1.5 * iqr) * 10) / 10

  const frames: VADCalibrationFrame[] = []
  const inliers: VADCalibrationFrame[] = []
  const outliers: VADCalibrationFrame[] = []

  for (const raw of rawFrames) {
    const isOutlier = raw.dbfs > outlierCutoffDbfs
    const frame: VADCalibrationFrame = {
      ...raw,
      isOutlier,
    }
    frames.push(frame)
    if (isOutlier) {
      outliers.push(frame)
    } else {
      inliers.push(frame)
    }
  }

  const distribution: VADNoiseDistribution = {
    minDbfs,
    maxDbfs,
    medianDbfs,
    p65Dbfs,
    q1Dbfs,
    q3Dbfs,
    iqr,
    outlierCutoffDbfs,
  }

  return { distribution, frames, inliers, outliers }
}

/**
 * Classifies room environment noise quality.
 */
export function classifyEnvironmentQuality(noiseFloorDbfs: number): {
  quality: EnvironmentQuality
  qualityLabel: string
} {
  if (noiseFloorDbfs < -55.0) {
    return {
      quality: 'pristine',
      qualityLabel: 'Rất yên tĩnh (Phòng thu / Cách âm)',
    }
  }
  if (noiseFloorDbfs < -45.0) {
    return {
      quality: 'good',
      qualityLabel: 'Tốt (Môi trường văn phòng / Phòng yên tĩnh)',
    }
  }
  if (noiseFloorDbfs < -35.0) {
    return {
      quality: 'moderate',
      qualityLabel: 'Trung bình (Có tiếng quạt hoặc điều hòa nhẹ)',
    }
  }
  if (noiseFloorDbfs < -25.0) {
    return {
      quality: 'noisy',
      qualityLabel: 'Ồn (Nhiều tạp âm nền, tiếng ồn bên ngoài)',
    }
  }
  return {
    quality: 'critical',
    qualityLabel: 'Quá ồn (Ảnh hưởng lớn tới nhận diện STT)',
  }
}

/**
 * Maps calibrated threshold dBFS into a normalized sensitivity rating from 0.0 to 1.0.
 * Lower threshold = higher sensitivity (picks up softer speech).
 * -50 dBFS or lower maps to ~0.95 sensitivity.
 * -20 dBFS or higher maps to ~0.10 sensitivity.
 */
export function mapThresholdToSensitivity(thresholdDbfs: number): number {
  const norm = (-thresholdDbfs - 20) / 30 // -20 dBFS -> 0.0, -50 dBFS -> 1.0
  const clamped = Math.max(0.05, Math.min(0.98, norm))
  return Math.round(clamped * 100) / 100
}

/**
 * Core Algorithm: Analyzes recorded calibration PCM samples, applies IQR outlier filtering,
 * checks guards, calculates room noise floor, and computes recommended speech detection threshold.
 */
export function analyzeCalibrationAudio(
  pcm16: Int16Array,
  deviceId: string,
  deviceName?: string,
  options: VADCalibrationOptions = {}
): VADCalibrationResult {
  const opts = { ...DEFAULT_CALIBRATION_OPTIONS, ...options }

  // 1. Guard check: Minimum audio length (at least 0.5s required)
  const minSamples = Math.round(16000 * 0.5)
  if (pcm16.length < minSamples) {
    throw new VADCalibrationGuardError(
      'INSUFFICIENT_AUDIO_SAMPLES',
      `Không đủ mẫu âm thanh để phân tích (${pcm16.length} mẫu, tối thiểu cần ${minSamples}). Vui lòng kiểm tra microphone.`
    )
  }

  // 2. Slice into short 50ms frames
  const rawFrames = sliceAudioIntoFrames(pcm16, 16000, opts.frameDurationMs)
  if (rawFrames.length < 5) {
    throw new VADCalibrationGuardError(
      'INSUFFICIENT_AUDIO_SAMPLES',
      'Số khung audio quá ít để phân tích phân phối tiếng ồn.'
    )
  }

  // 3. Compute distribution and reject outliers
  const { distribution, inliers, outliers } = computeNoiseDistributionAndOutliers(rawFrames)

  // 4. Guard check: Excessive noise floor
  if (distribution.medianDbfs > opts.highNoiseThresholdDbfs) {
    throw new VADCalibrationGuardError(
      'ENVIRONMENT_TOO_NOISY',
      `Môi trường quá ồn (độ ồn trung vị ${distribution.medianDbfs} dBFS > ${opts.highNoiseThresholdDbfs} dBFS). Không thể thiết lập ngưỡng VAD chính xác.`
    )
  }

  // 5. Guard check: Continuous speech / loud talking during calibration
  const loudFrames = rawFrames.filter((f) => f.dbfs > opts.speechContaminationThresholdDbfs)
  const contaminationRatio = loudFrames.length / rawFrames.length
  if (contaminationRatio > opts.maxContaminationRatio) {
    throw new VADCalibrationGuardError(
      'SPEECH_DETECTED',
      `Phát hiện giọng nói hoặc âm thanh lớn liên tục trong khi đo (${Math.round(contaminationRatio * 100)}% thời gian). Vui lòng giữ im lặng trong 3 giây và thử lại.`
    )
  }

  // 6. Compute noise floor from inliers (use 65th percentile of inliers to capture steady ambient floor)
  const cleanFrames = inliers.length > 0 ? inliers : rawFrames
  const sortedInlierDbfs = cleanFrames.map((f) => f.dbfs).sort((a, b) => a - b)
  const rawNoiseFloorDbfs = Math.round(calculatePercentile(sortedInlierDbfs, 65) * 10) / 10
  const noiseFloorDbfs = Number.isFinite(rawNoiseFloorDbfs) ? rawNoiseFloorDbfs : -50.0
  const noiseFloorRms = Math.pow(10, noiseFloorDbfs / 20)

  // 7. Calculate speech threshold: noise floor + safety margin
  const safeMargin = Number.isFinite(opts.safetyMarginDb)
    ? Math.max(1.0, Math.min(20.0, opts.safetyMarginDb))
    : 6.0
  const rawSpeechThresholdDbfs = noiseFloorDbfs + safeMargin
  // Clamp threshold between -60 dBFS and -14 dBFS for stability
  const clampedDbfs = Math.max(-60.0, Math.min(-14.0, rawSpeechThresholdDbfs))
  const speechThresholdDbfs = Number.isFinite(clampedDbfs)
    ? Math.round(clampedDbfs * 10) / 10
    : -42.0
  const calculatedRms = Math.round(Math.pow(10, speechThresholdDbfs / 20) * 100000) / 100000
  const speechThresholdRms = (Number.isFinite(calculatedRms) && calculatedRms > 0)
    ? calculatedRms
    : 0.008

  // 8. Quality classification and sensitivity mapping
  const { quality, qualityLabel } = classifyEnvironmentQuality(noiseFloorDbfs)
  const sensitivity = mapThresholdToSensitivity(speechThresholdDbfs)

  return {
    deviceId,
    deviceName,
    timestamp: Date.now(),
    noiseFloorDbfs,
    noiseFloorRms,
    safetyMarginDb: opts.safetyMarginDb,
    speechThresholdDbfs,
    speechThresholdRms,
    sensitivity,
    quality,
    qualityLabel,
    totalFrames: rawFrames.length,
    inlierFrames: inliers.length,
    outlierFrames: outliers.length,
    distribution,
  }
}
