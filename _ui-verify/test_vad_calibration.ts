import {
  analyzeCalibrationAudio,
  calculateRmsAndDbfs,
  sliceAudioIntoFrames,
  computeNoiseDistributionAndOutliers,
  classifyEnvironmentQuality,
  mapThresholdToSensitivity,
  saveVADCalibration,
  getVADCalibration,
  getEffectiveVadEnergyThreshold,
  clearAllVADCalibrations,
  VADCalibrationGuardError,
  type VADCalibrationResult,
} from '../src/app/services/vad-calibration'
import { VAD_ENERGY_THRESHOLD } from '../src/app/core/audio/AudioBufferManager'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`  ✓ ${msg}`)
}

console.log('─── Starting VAD Automatic Calibration Test Suite ───')

// Helper: Synthesize PCM 16-bit audio
function synthesizeSineWithNoise(
  durationSec: number,
  sineFreq: number,
  sineAmp: number,
  noiseAmp: number,
  sampleRate = 16000
): Int16Array {
  const totalSamples = Math.round(durationSec * sampleRate)
  const buffer = new Int16Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const sine = sineAmp * Math.sin(2 * Math.PI * sineFreq * t)
    const noise = (Math.random() * 2 - 1) * noiseAmp
    const sample = Math.max(-32768, Math.min(32767, Math.round(sine + noise)))
    buffer[i] = sample
  }
  return buffer
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Pristine / Quiet Studio Room
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 1] Pristine Quiet Room Calibration:')
{
  // Very low background noise (approx -58 dBFS, amp ~ 40)
  const quietPcm = synthesizeSineWithNoise(3.0, 0, 0, 40)
  const result = analyzeCalibrationAudio(quietPcm, 'mic-studio-01', 'Studio Mic', {
    safetyMarginDb: 6.0,
  })

  assert(result.totalFrames === 60, `Generates 60 frames for 3.0s @ 50ms (got ${result.totalFrames})`)
  assert(
    result.noiseFloorDbfs < -52,
    `Quiet room noise floor is low (measured: ${result.noiseFloorDbfs} dBFS)`
  )
  assert(
    result.quality === 'pristine',
    `Quality correctly categorized as 'pristine' (got ${result.quality})`
  )
  assert(
    result.speechThresholdDbfs === Math.round((result.noiseFloorDbfs + 6.0) * 10) / 10,
    `Speech threshold matches noiseFloor + 6.0 dB safety margin (${result.speechThresholdDbfs} dBFS)`
  )
  assert(
    result.sensitivity >= 0.85,
    `High sensitivity for quiet room: ${(result.sensitivity * 100).toFixed(0)}%`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Room with Constant Fan Hum (Ambient AC / Fan Noise)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[Test 2] Continuous Fan Hum / Ambient AC Noise:')
{
  // Continuous 120Hz fan hum + motor vibration (approx -40 dBFS, amp ~ 320)
  const fanPcm = synthesizeSineWithNoise(3.0, 120, 250, 200)
  const result = analyzeCalibrationAudio(fanPcm, 'mic-laptop-fan', 'Laptop Mic with Fan', {
    safetyMarginDb: 6.0,
  })

  assert(
    result.noiseFloorDbfs >= -45 && result.noiseFloorDbfs <= -36,
    `Measures fan noise floor accurately (measured: ${result.noiseFloorDbfs} dBFS)`
  )
  assert(
    result.quality === 'moderate',
    `Quality correctly categorized as 'moderate' (got ${result.quality})`
  )
  assert(
    result.speechThresholdDbfs > result.noiseFloorDbfs,
    `Speech threshold is above fan noise (${result.speechThresholdDbfs} dBFS > ${result.noiseFloorDbfs} dBFS)`
  )
  // Speech threshold RMS should be greater than noise floor RMS
  assert(
    result.speechThresholdRms > result.noiseFloorRms,
    `speechThresholdRms (${result.speechThresholdRms}) > noiseFloorRms (${result.noiseFloorRms})`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Keyboard Noise & Transient Outlier Removal (IQR Tukey Fences)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 3] Outlier Rejection (Keyboard typing / Mouse clicks during 3s silence):')
{
  // Baseline quiet room (-52 dBFS)
  const pcm = synthesizeSineWithNoise(3.0, 0, 0, 75)

  // Inject 4 sharp keyboard clicks into isolated frames:
  // Frame 10 (at 0.5s), Frame 25 (at 1.25s), Frame 40 (at 2.0s), Frame 50 (at 2.5s)
  const clickIndices = [10, 25, 40, 50]
  const samplesPerFrame = 800 // 50ms @ 16kHz

  for (const fIdx of clickIndices) {
    const startSample = fIdx * samplesPerFrame
    for (let i = 0; i < 400; i++) {
      // High transient energy (~ -14 dBFS click)
      pcm[startSample + i] = Math.round((Math.random() * 2 - 1) * 6500)
    }
  }

  const result = analyzeCalibrationAudio(pcm, 'mic-desktop-keys', 'Desktop Mic', {
    safetyMarginDb: 6.0,
  })

  assert(
    result.outlierFrames >= 4,
    `Detected and isolated at least 4 transient keyboard outliers (detected: ${result.outlierFrames})`
  )
  assert(
    result.noiseFloorDbfs < -46,
    `Outliers did not skew the noise floor upward (clean noise floor: ${result.noiseFloorDbfs} dBFS)`
  )
  assert(
    result.inlierFrames === result.totalFrames - result.outlierFrames,
    `Inlier count (${result.inlierFrames}) + outlier count (${result.outlierFrames}) == total (${result.totalFrames})`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Guard Check: Environment Too Noisy (> -20 dBFS)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 4] Guard Protection: Environment Too Noisy:')
{
  // Very loud background drone (approx -16 dBFS, amp ~ 5000)
  const loudNoisePcm = synthesizeSineWithNoise(3.0, 200, 4500, 2000)

  let errorThrown = false
  try {
    analyzeCalibrationAudio(loudNoisePcm, 'mic-loud-room', 'Construction Mic', {
      highNoiseThresholdDbfs: -20.0,
    })
  } catch (err: unknown) {
    if (err instanceof VADCalibrationGuardError && err.code === 'ENVIRONMENT_TOO_NOISY') {
      errorThrown = true
      console.log(`  ✓ Successfully triggered ENVIRONMENT_TOO_NOISY guard: "${err.message}"`)
    }
  }

  assert(errorThrown, 'Properly aborted calibration when noise floor exceeded -20 dBFS')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Guard Check: Speech Contamination (> 40% speech during silence test)
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 5] Guard Protection: User Spoke During Calibration:')
{
  // User talks through > 50% of the calibration window (-22 dBFS speech)
  const speechPcm = synthesizeSineWithNoise(3.0, 300, 2800, 1000)

  let errorThrown = false
  try {
    analyzeCalibrationAudio(speechPcm, 'mic-talking-user', 'Speaking Mic', {
      speechContaminationThresholdDbfs: -28.0,
      maxContaminationRatio: 0.4,
    })
  } catch (err: unknown) {
    if (err instanceof VADCalibrationGuardError && err.code === 'SPEECH_DETECTED') {
      errorThrown = true
      console.log(`  ✓ Successfully triggered SPEECH_DETECTED guard: "${err.message}"`)
    }
  }

  assert(errorThrown, 'Properly aborted calibration when continuous speech was detected')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Per-Device Isolation & Independent Storage Persistence
// ─────────────────────────────────────────────────────────────────────
console.log('\n[Test 6] Device Isolation & Storage Persistence:')
{
  // Mock localStorage for test environment if not present
  if (typeof window === 'undefined' || !globalThis.localStorage) {
    const memoryStorage = new Map<string, string>()
    ;(globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => memoryStorage.get(k) || null,
        setItem: (k: string, v: string) => memoryStorage.set(k, v),
        removeItem: (k: string) => memoryStorage.delete(k),
        clear: () => memoryStorage.clear(),
      },
    }
    ;(globalThis as any).localStorage = (globalThis as any).window.localStorage
  }

  clearAllVADCalibrations()

  // Calibration for Yeti Mic
  const yetiResult: VADCalibrationResult = {
    deviceId: 'mic_usb_blue_yeti',
    deviceName: 'Blue Yeti Pro USB',
    timestamp: Date.now(),
    noiseFloorDbfs: -52.0,
    noiseFloorRms: 0.00251,
    safetyMarginDb: 6.0,
    speechThresholdDbfs: -46.0,
    speechThresholdRms: 0.00501,
    sensitivity: 0.87,
    quality: 'good',
    qualityLabel: 'Tốt (Môi trường văn phòng)',
    totalFrames: 60,
    inlierFrames: 58,
    outlierFrames: 2,
    distribution: {
      minDbfs: -54,
      maxDbfs: -35,
      medianDbfs: -52,
      p65Dbfs: -52,
      q1Dbfs: -53,
      q3Dbfs: -51,
      iqr: 2,
      outlierCutoffDbfs: -48,
    },
  }

  // Calibration for Gaming Headset Mic
  const headsetResult: VADCalibrationResult = {
    deviceId: 'mic_headset_hyperx',
    deviceName: 'HyperX Cloud II',
    timestamp: Date.now(),
    noiseFloorDbfs: -42.0,
    noiseFloorRms: 0.00794,
    safetyMarginDb: 6.0,
    speechThresholdDbfs: -36.0,
    speechThresholdRms: 0.01584,
    sensitivity: 0.53,
    quality: 'moderate',
    qualityLabel: 'Trung bình',
    totalFrames: 60,
    inlierFrames: 55,
    outlierFrames: 5,
    distribution: {
      minDbfs: -44,
      maxDbfs: -25,
      medianDbfs: -42,
      p65Dbfs: -42,
      q1Dbfs: -43,
      q3Dbfs: -41,
      iqr: 2,
      outlierCutoffDbfs: -38,
    },
  }

  saveVADCalibration(yetiResult)
  saveVADCalibration(headsetResult)

  // 1. Yeti look up
  const yetiCalib = getVADCalibration('mic_usb_blue_yeti')
  assert(yetiCalib !== null, 'Found Yeti calibration')
  assert(yetiCalib?.speechThresholdDbfs === -46.0, 'Yeti threshold is -46.0 dBFS')
  assert(
    getEffectiveVadEnergyThreshold('mic_usb_blue_yeti') === 0.00501,
    'Effective VAD energy threshold for Yeti is 0.00501'
  )

  // 2. Headset look up
  const headsetCalib = getVADCalibration('mic_headset_hyperx')
  assert(headsetCalib !== null, 'Found HyperX calibration')
  assert(headsetCalib?.speechThresholdDbfs === -36.0, 'HyperX threshold is -36.0 dBFS')
  assert(
    getEffectiveVadEnergyThreshold('mic_headset_hyperx') === 0.01584,
    'Effective VAD energy threshold for HyperX is 0.01584'
  )

  // 3. Device isolation: Uncalibrated device must NOT inherit other devices' calibrations!
  const uncalibratedDevice = 'mic_airpods_bluetooth'
  const uncalibratedRecord = getVADCalibration(uncalibratedDevice)
  assert(
    uncalibratedRecord === null,
    `Uncalibrated device "${uncalibratedDevice}" correctly returns null calibration`
  )
  const defaultThreshold = getEffectiveVadEnergyThreshold(uncalibratedDevice)
  assert(
    defaultThreshold === VAD_ENERGY_THRESHOLD,
    `Uncalibrated device falls back strictly to baseline VAD_ENERGY_THRESHOLD (${VAD_ENERGY_THRESHOLD})`
  )
}

console.log('\n============================================================')
console.log('🎉 ALL VAD AUTOMATIC CALIBRATION TESTS PASSED PERFECTLY!')
console.log('============================================================\n')
