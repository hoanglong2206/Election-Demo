import {
  calculateRmsAndDbfs,
  sliceAudioIntoFrames,
  calculatePercentile,
  computeNoiseDistributionAndOutliers,
  classifyEnvironmentQuality,
  mapThresholdToSensitivity,
  analyzeCalibrationAudio,
  VADCalibrationGuardError,
  saveVADCalibration,
  getVADCalibration,
  getEffectiveVadEnergyThreshold,
  clearAllVADCalibrations,
  removeVADCalibration,
} from '../src/app/services/vad-calibration'
import {
  AudioBufferManager,
  TARGET_SAMPLE_RATE,
  VAD_ENERGY_THRESHOLD,
} from '../src/app/core/audio/AudioBufferManager'
import {
  getSavedAudioDeviceId,
  saveAudioDeviceId,
  PRESET_AUDIO_DEVICES,
} from '../src/app/services/audioDevices'

describe('Audio Test Page Full Functional Audit', () => {
  const memoryStorage = new Map<string, string>()

  beforeEach(() => {
    memoryStorage.clear()
    ;(globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => memoryStorage.get(k) || null,
        setItem: (k: string, v: string) => memoryStorage.set(k, v),
        removeItem: (k: string) => memoryStorage.delete(k),
        clear: () => memoryStorage.clear(),
      },
    }
    ;(globalThis as any).localStorage = (globalThis as any).window.localStorage
  })

  afterEach(() => {
    clearAllVADCalibrations()
  })

  // ── 1. Device Selection & Storage Association ──────────────────────────────
  describe('1. Device Selection & Storage Persistence', () => {
    test('loads default input device safely when none is saved', () => {
      const defaultId = getSavedAudioDeviceId()
      expect(defaultId).toBeDefined()
      expect(typeof defaultId).toBe('string')
      expect(defaultId.length).toBeGreaterThan(0)
    })

    test('saves and switches microphone device correctly', () => {
      saveAudioDeviceId('mic-usb-yeti-pro')
      expect(getSavedAudioDeviceId()).toBe('mic-usb-yeti-pro')

      saveAudioDeviceId('mic-headset-hyperx')
      expect(getSavedAudioDeviceId()).toBe('mic-headset-hyperx')
    })

    test('preset audio devices contain valid default and system devices', () => {
      expect(PRESET_AUDIO_DEVICES.length).toBeGreaterThan(0)
      const loopback = PRESET_AUDIO_DEVICES.find((d) => d.deviceId === 'default-loopback')
      expect(loopback).toBeDefined()
      expect(loopback?.type).toBe('system')
    })
  })

  // ── 2. Audio Pipeline Normalization (16kHz, 1-ch, 16-bit PCM) ─────────────
  describe('2. Audio Pipeline Normalization & Buffer Management', () => {
    test('AudioBufferManager initializes with 16kHz target rate and correct chunk size', () => {
      const mgr = new AudioBufferManager(15.0)
      expect(TARGET_SAMPLE_RATE).toBe(16000)
      expect(mgr.vadEnergyThreshold).toBe(VAD_ENERGY_THRESHOLD)
      expect(mgr.totalSamples).toBe(0)
      expect(mgr.hasBuffer).toBe(false)
    })

    test('buffers raw Int16Array PCM blocks and generates 1.0s STT chunks', () => {
      const mgr = new AudioBufferManager(15.0)
      const oneSecondPcm = new Int16Array(16000).fill(500)

      const chunk = mgr.appendSamples(oneSecondPcm)
      expect(chunk).not.toBeNull()
      expect(chunk?.sampleCount).toBe(16000)
      expect(chunk?.durationSec).toBe(1.0)
      expect(chunk?.sizeBytes).toBe(32000)
      expect(mgr.totalSamples).toBe(16000)
      expect(mgr.hasBuffer).toBe(true)
      expect(mgr.durationSec).toBe(1.0)
    })

    test('enforces bounded ring buffer memory capacity (no unbounded growth)', () => {
      const mgr = new AudioBufferManager(5.0) // 5 seconds max
      const block = new Int16Array(16000).fill(200)

      // Append 10 seconds of audio
      for (let i = 0; i < 10; i++) {
        mgr.appendSamples(block)
      }

      expect(mgr.totalSamples).toBe(160000) // 10s cumulative
      expect(mgr.bufferedSeconds).toBeLessThanOrEqual(5.5) // retained bounded window <= ~5s
      expect(mgr.estimatedMemoryMb).toBeLessThan(1.0) // RAM strictly bounded under 1MB
    })

    test('slices audio segments with accurate VAD energy detection', () => {
      const mgr = new AudioBufferManager(15.0)

      // 1. Silent segment (all zeros)
      const silence = new Int16Array(16000 * 2).fill(0)
      mgr.appendSamples(silence)
      const silentSeg = mgr.getAudioSegmentSince(0, 1.2)
      expect(silentSeg).not.toBeNull()
      expect(silentSeg?.hasAudio).toBe(false) // VAD drops silence

      // 2. Active voice segment (loud tone)
      const voice = new Int16Array(16000 * 2)
      for (let i = 0; i < voice.length; i++) {
        voice[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / 16000) * 12000)
      }
      mgr.appendSamples(voice)
      const voiceSeg = mgr.getAudioSegmentSince(16000 * 2, 1.2)
      expect(voiceSeg).not.toBeNull()
      expect(voiceSeg?.hasAudio).toBe(true) // Voice detected
    })

    test('getRecentPcmSamples returns correct sample window length', () => {
      const mgr = new AudioBufferManager(15.0)
      const samples = new Int16Array(16000 * 4).fill(100) // 4 seconds
      mgr.appendSamples(samples)

      const recent3s = mgr.getRecentPcmSamples(3.0)
      expect(recent3s.length).toBe(48000) // 3s * 16000
    })
  })

  // ── 3. VAD Math: RMS, dBFS & Percentile Calculation ───────────────────────
  describe('3. VAD Math: RMS, dBFS, Percentile & Guard Resilience', () => {
    test('calculateRmsAndDbfs computes correct metrics for silence and full scale', () => {
      // Pure digital silence
      const zero = new Int16Array(1600).fill(0)
      const silenceRes = calculateRmsAndDbfs(zero)
      expect(silenceRes.rms).toBe(0)
      expect(silenceRes.dbfs).toBe(-96.0)

      // Half scale amplitude (+-16384 -> RMS approx 0.5 -> -6 dBFS)
      const half = new Int16Array(1600).fill(16384)
      const halfRes = calculateRmsAndDbfs(half)
      expect(halfRes.rms).toBeCloseTo(0.5, 2)
      expect(halfRes.dbfs).toBeCloseTo(-6.0, 1)

      // Empty samples handling
      const empty = new Int16Array(0)
      expect(calculateRmsAndDbfs(empty)).toEqual({ rms: 0, dbfs: -96.0 })
    })

    test('calculatePercentile calculates accurate percentiles and handles invalid inputs', () => {
      const sorted = [-60, -50, -40, -30, -20]
      expect(calculatePercentile(sorted, 50)).toBe(-40) // median
      expect(calculatePercentile(sorted, 0)).toBe(-60)
      expect(calculatePercentile(sorted, 100)).toBe(-20)

      // Resilience to NaN or out of bounds percentiles
      expect(calculatePercentile(sorted, NaN)).toBe(-40) // defaults to median
      expect(calculatePercentile(sorted, -10)).toBe(-60) // clamped to min
      expect(calculatePercentile(sorted, 150)).toBe(-20) // clamped to max
      expect(calculatePercentile([], 50)).toBe(-96.0) // empty array safe
    })

    test('sliceAudioIntoFrames produces exact 50ms frames with timestamps', () => {
      const samples = new Int16Array(16000 * 3) // 3 seconds = 48000 samples
      const frames = sliceAudioIntoFrames(samples, 16000, 50)
      expect(frames.length).toBe(60)
      expect(frames[0].sampleCount).toBe(800) // 50ms @ 16kHz
      expect(frames[0].timestampMs).toBe(0)
      expect(frames[59].timestampMs).toBe(2950)
    })
  })

  // ── 4. VAD Calibration Under Various Acoustic Environments ────────────────
  describe('4. VAD Calibration Across Acoustic Environments', () => {
    const SAMPLE_RATE = 16000
    const DURATION = 3.0
    const TOTAL_SAMPLES = SAMPLE_RATE * DURATION

    test('Pristine quiet room (studio): classifies pristine and sets high sensitivity', () => {
      const quietSamples = new Int16Array(TOTAL_SAMPLES)
      // Subtle ambient mic noise around -65 dBFS (amplitude ~18)
      for (let i = 0; i < TOTAL_SAMPLES; i++) {
        quietSamples[i] = Math.round((Math.random() - 0.5) * 36)
      }

      const res = analyzeCalibrationAudio(quietSamples, 'mic-studio', 'Studio Mic')
      expect(res.quality).toBe('pristine')
      const expectedClampedThreshold = Math.max(-60.0, Math.round((res.noiseFloorDbfs + 6.0) * 10) / 10)
      expect(res.speechThresholdDbfs).toBe(expectedClampedThreshold)
      expect(res.speechThresholdRms).toBeGreaterThan(0)
      expect(res.sensitivity).toBeGreaterThan(0.9)
    })

    test('Steady fan noise / AC hum: measures elevated noise floor and clamps speech threshold safely above it', () => {
      const fanSamples = new Int16Array(TOTAL_SAMPLES)
      // Continuous background hum around -40 dBFS (amplitude ~328)
      for (let i = 0; i < TOTAL_SAMPLES; i++) {
        const hum = Math.sin((2 * Math.PI * 120 * i) / SAMPLE_RATE) * 300
        const whiteNoise = (Math.random() - 0.5) * 50
        fanSamples[i] = Math.round(hum + whiteNoise)
      }

      const res = analyzeCalibrationAudio(fanSamples, 'mic-desk', 'Desk Mic', {
        safetyMarginDb: 6.0,
      })
      expect(res.quality).toBe('moderate')
      expect(res.noiseFloorDbfs).toBeGreaterThan(-45.0)
      expect(res.speechThresholdDbfs).toBeGreaterThan(res.noiseFloorDbfs)
      expect(res.speechThresholdRms).toBeGreaterThan(res.noiseFloorRms)
    })

    test('Keyboard clicks & transient noise: IQR Tukey fences isolate and reject outliers', () => {
      const samples = new Int16Array(TOTAL_SAMPLES)
      // Steady quiet baseline at -55 dBFS
      for (let i = 0; i < TOTAL_SAMPLES; i++) {
        samples[i] = Math.round((Math.random() - 0.5) * 100)
      }

      // Add 4 brief keyboard clacks (each 40ms, loud at -25 dBFS)
      const clackOffsets = [8000, 16000, 24000, 32000]
      for (const offset of clackOffsets) {
        for (let i = 0; i < 600; i++) {
          samples[offset + i] = Math.round(Math.sin(i) * 2000)
        }
      }

      const res = analyzeCalibrationAudio(samples, 'mic-laptop', 'Laptop Mic')
      expect(res.outlierFrames).toBeGreaterThanOrEqual(4)
      expect(res.inlierFrames + res.outlierFrames).toBe(res.totalFrames)
      // Inliers should ensure noise floor reflects ambient, not the clacks
      expect(res.noiseFloorDbfs).toBeLessThan(-45.0)
    })

    test('Speech contamination guard: rejects calibration if user speaks during measurement', () => {
      const talkSamples = new Int16Array(TOTAL_SAMPLES)
      // Simulate speech during 60% of the duration (loud at -20 dBFS)
      for (let i = 0; i < TOTAL_SAMPLES * 0.6; i++) {
        talkSamples[i] = Math.round(Math.sin((2 * Math.PI * 300 * i) / SAMPLE_RATE) * 4000)
      }

      expect(() => {
        analyzeCalibrationAudio(talkSamples, 'mic-test')
      }).toThrow(VADCalibrationGuardError)

      try {
        analyzeCalibrationAudio(talkSamples, 'mic-test')
      } catch (err) {
        expect(err instanceof VADCalibrationGuardError).toBe(true)
        expect((err as VADCalibrationGuardError).code).toBe('SPEECH_DETECTED')
      }
    })

    test('Unusually loud environment guard: aborts calibration if room is excessively loud (> -20 dBFS)', () => {
      const concertSamples = new Int16Array(TOTAL_SAMPLES).fill(8000) // very loud continuous signal

      expect(() => {
        analyzeCalibrationAudio(concertSamples, 'mic-test')
      }).toThrow(VADCalibrationGuardError)

      try {
        analyzeCalibrationAudio(concertSamples, 'mic-test')
      } catch (err) {
        expect(err instanceof VADCalibrationGuardError).toBe(true)
        expect((err as VADCalibrationGuardError).code).toBe('ENVIRONMENT_TOO_NOISY')
      }
    })

    test('Insufficient audio samples guard: requires at least 0.5s of audio', () => {
      const shortSamples = new Int16Array(1000) // only ~62ms

      expect(() => {
        analyzeCalibrationAudio(shortSamples, 'mic-test')
      }).toThrow(VADCalibrationGuardError)
    })
  })

  // ── 5. Mathematical Guard Against NaN, Infinity, and Impossible Values ────
  describe('5. Mathematical Resilience Against NaN & Outliers', () => {
    test('guarantees speechThresholdDbfs and speechThresholdRms are always finite and valid numbers', () => {
      const samples = new Int16Array(16000 * 3)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (i % 2 === 0 ? 1 : -1) * 50
      }

      // Test with custom extreme or NaN options
      const res = analyzeCalibrationAudio(samples, 'mic-test', undefined, {
        safetyMarginDb: NaN as unknown as number, // Invalid NaN margin
      })

      expect(Number.isFinite(res.noiseFloorDbfs)).toBe(true)
      expect(Number.isFinite(res.speechThresholdDbfs)).toBe(true)
      expect(Number.isFinite(res.speechThresholdRms)).toBe(true)
      expect(res.speechThresholdRms).toBeGreaterThan(0)
      expect(res.speechThresholdDbfs).toBeGreaterThanOrEqual(-60.0)
      expect(res.speechThresholdDbfs).toBeLessThanOrEqual(-14.0)
    })

    test('getEffectiveVadEnergyThreshold returns fallback for invalid/corrupt records', () => {
      // Mock corrupted record with Infinity
      const corruptRecord = {
        deviceId: 'corrupt-mic',
        speechThresholdRms: Infinity,
        speechThresholdDbfs: 0,
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          'meeting_copilot_vad_calibrations',
          JSON.stringify({ 'corrupt-mic': corruptRecord })
        )
      }

      const threshold = getEffectiveVadEnergyThreshold('corrupt-mic')
      expect(threshold).toBe(VAD_ENERGY_THRESHOLD) // Correctly refused Infinity and returned safe default!
    })
  })

  // ── 6. Per-Device Calibration Association & Meeting Mode Consumption ──────
  describe('6. Per-Device Calibration Association & Meeting Mode Consumption', () => {
    test('calibrated threshold is bound strictly to deviceId and not reused by other devices', () => {
      const samplesA = new Int16Array(16000 * 3).fill(30)
      const calibA = analyzeCalibrationAudio(samplesA, 'device-yeti-mic')
      saveVADCalibration(calibA)

      const samplesB = new Int16Array(16000 * 3).fill(250)
      const calibB = analyzeCalibrationAudio(samplesB, 'device-hyperx-mic')
      saveVADCalibration(calibB)

      // Verify device A
      const storedA = getVADCalibration('device-yeti-mic')
      expect(storedA).not.toBeNull()
      expect(storedA?.deviceId).toBe('device-yeti-mic')
      expect(getEffectiveVadEnergyThreshold('device-yeti-mic')).toBe(calibA.speechThresholdRms)

      // Verify device B
      const storedB = getVADCalibration('device-hyperx-mic')
      expect(storedB).not.toBeNull()
      expect(storedB?.deviceId).toBe('device-hyperx-mic')
      expect(getEffectiveVadEnergyThreshold('device-hyperx-mic')).toBe(calibB.speechThresholdRms)

      // Verify uncalibrated device C
      const storedC = getVADCalibration('device-airpods-mic')
      expect(storedC).toBeNull()
      expect(getEffectiveVadEnergyThreshold('device-airpods-mic')).toBe(VAD_ENERGY_THRESHOLD)
    })

    test('Meeting Mode consumes the exact calibrated threshold for the active microphone', () => {
      saveAudioDeviceId('mic-meeting-active')

      const samples = new Int16Array(16000 * 3)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.round((Math.random() - 0.5) * 80)
      }
      const calibration = analyzeCalibrationAudio(samples, 'mic-meeting-active')
      saveVADCalibration(calibration)

      // Simulate Meeting Mode starting with active device
      const activeDevId = getSavedAudioDeviceId()
      const effectiveThreshold = getEffectiveVadEnergyThreshold(activeDevId)

      expect(effectiveThreshold).toBe(calibration.speechThresholdRms)

      // Buffer manager configured with effective threshold
      const meetingBufferManager = new AudioBufferManager(15.0)
      meetingBufferManager.setVadEnergyThreshold(effectiveThreshold)
      expect(meetingBufferManager.vadEnergyThreshold).toBe(calibration.speechThresholdRms)
    })
  })

  // ── 7. End-to-End User Flow Verification ──────────────────────────────────
  describe('7. End-to-End User Flow Verification', () => {
    test('Simulate complete flow: Select Mic -> Start Test -> Calibrate VAD -> Accept -> Stop -> Enter Meeting', () => {
      // Step 1: Select Microphone
      const chosenMicId = 'mic-shure-mv7'
      saveAudioDeviceId(chosenMicId)
      expect(getSavedAudioDeviceId()).toBe(chosenMicId)

      // Step 2: Start Audio Capture Pipeline
      const bufferManager = new AudioBufferManager(15.0)
      const currentThreshold = getEffectiveVadEnergyThreshold(chosenMicId)
      bufferManager.setVadEnergyThreshold(currentThreshold)
      expect(bufferManager.vadEnergyThreshold).toBe(VAD_ENERGY_THRESHOLD) // initially uncalibrated baseline

      // Step 3: Calibrate VAD (3 seconds ambient recording)
      const ambientSamples = new Int16Array(16000 * 3)
      for (let i = 0; i < ambientSamples.length; i++) {
        ambientSamples[i] = Math.round((Math.random() - 0.5) * 50)
      }
      const result = analyzeCalibrationAudio(ambientSamples, chosenMicId, 'Shure MV7')
      expect(result.speechThresholdDbfs).toBeLessThan(-30.0)

      // Step 4: Accept Calibration
      const record = saveVADCalibration(result)
      bufferManager.setVadEnergyThreshold(result.speechThresholdRms)
      expect(bufferManager.vadEnergyThreshold).toBe(record.speechThresholdRms)

      // Step 5: Stop Audio Test
      bufferManager.clear()
      expect(bufferManager.totalSamples).toBe(0)
      expect(bufferManager.hasBuffer).toBe(false)

      // Step 6: Enter Meeting Mode
      // Meeting Mode initializes with active microphone and reads calibrated threshold
      const meetingMicId = getSavedAudioDeviceId()
      const meetingThreshold = getEffectiveVadEnergyThreshold(meetingMicId)

      expect(meetingMicId).toBe(chosenMicId)
      expect(meetingThreshold).toBe(record.speechThresholdRms)
      expect(meetingThreshold).not.toBe(VAD_ENERGY_THRESHOLD) // Successfully consumes accepted calibration!
    })
  })
})
