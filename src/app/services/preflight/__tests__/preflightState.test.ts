import '@/test/setupDom'
import { describe, it, expect, beforeEach } from 'bun:test'
import {
  isVADCalibrated,
  isSystemAudioVerified,
  setSystemAudioVerified,
  isAIPrewarmed,
  setAIPrewarmed,
  getPinnedScreenSource,
  setPinnedScreenSource,
  getCombatReadiness,
  AI_PREWARMED_STORAGE_KEY,
} from '../preflightState'
import { saveVADCalibration, clearAllVADCalibrations } from '@/services/vad-calibration/vadCalibrationStorage'
import { saveMeetingContext } from '@/services/meeting-context/repository'

describe('preflightState Service', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearAllVADCalibrations()
  })

  describe('isVADCalibrated', () => {
    it('returns false when no calibrations exist', () => {
      expect(isVADCalibrated()).toBe(false)
      expect(isVADCalibrated('mic-1')).toBe(false)
    })

    it('returns true when calibration is recorded', () => {
      saveVADCalibration({
        deviceId: 'mic-1',
        deviceName: 'Headset Mic',
        speechThresholdDbfs: -32,
        noiseFloorDbfs: -48,
        quality: 'good',
        qualityLabel: 'Tốt',
        timestamp: Date.now(),
        noiseFloorRms: 0.005,
        safetyMarginDb: 6,
        speechThresholdRms: 0.02,
        sensitivity: 0.8,
        totalFrames: 40,
        inlierFrames: 39,
        outlierFrames: 1,
        distribution: {
          minDbfs: -60,
          maxDbfs: -40,
          medianDbfs: -48,
          p65Dbfs: -46,
          q1Dbfs: -50,
          q3Dbfs: -45,
          iqr: 5,
          outlierCutoffDbfs: -35,
        },
      })

      expect(isVADCalibrated()).toBe(true)
      expect(isVADCalibrated('mic-1')).toBe(true)
      expect(isVADCalibrated('other-mic')).toBe(false)
    })
  })

  describe('systemAudioVerification', () => {
    it('defaults to false when unverified', () => {
      expect(isSystemAudioVerified()).toBe(false)
    })

    it('marks system audio loopback verified and persists to storage', () => {
      setSystemAudioVerified(-18)
      expect(isSystemAudioVerified()).toBe(true)
    })
  })

  describe('AIPrewarmed', () => {
    it('returns false initially', () => {
      expect(isAIPrewarmed()).toBe(false)
    })

    it('returns true after setting prewarmed within 30 min window', () => {
      setAIPrewarmed(180, 'gemini-1.5-flash')
      expect(isAIPrewarmed()).toBe(true)
    })

    it('returns false if prewarm expired (>30 minutes ago)', () => {
      const expiredTimestamp = Date.now() - 31 * 60 * 1000
      sessionStorage.setItem(
        AI_PREWARMED_STORAGE_KEY,
        JSON.stringify({ timestamp: expiredTimestamp, ttftMs: 200, modelId: 'test' })
      )
      expect(isAIPrewarmed()).toBe(false)
    })
  })

  describe('pinnedScreenSource', () => {
    it('defaults to null', () => {
      expect(getPinnedScreenSource()).toBeNull()
    })

    it('persists and retrieves pinned screen capture source', () => {
      setPinnedScreenSource({
        sourceId: 'screen:0:0',
        name: 'Entire Screen 1',
        sourceType: 'screen',
      })

      const pinned = getPinnedScreenSource()
      expect(pinned).not.toBeNull()
      expect(pinned?.sourceId).toBe('screen:0:0')
      expect(pinned?.name).toBe('Entire Screen 1')
      expect(pinned?.sourceType).toBe('screen')
      expect(pinned?.pinnedAt).toBeGreaterThan(0)
    })
  })

  describe('getCombatReadiness', () => {
    it('calculates 0 readiness when everything is empty', () => {
      saveMeetingContext({ cvSummary: '', jobDescription: '', discussionTopic: '', keywords: [] })
      const res = getCombatReadiness('interview')
      expect(res.score).toBe(0)
      expect(res.isCombatReady).toBe(false)
      expect(res.details.hasContext).toBe(false)
    })

    it('recognizes valid interview context (CV + JD)', () => {
      saveMeetingContext({
        cvSummary: 'Experienced Senior Frontend React Engineer with 5 years exp building systems...',
        jobDescription: 'Looking for a Senior Fullstack React and Node Engineer to build cloud apps...',
        discussionTopic: '',
        keywords: [],
      })

      const res = getCombatReadiness('interview')
      expect(res.details.hasContext).toBe(true)
      expect(res.score).toBe(30)
    })

    it('recognizes valid discussion topic (>=5 characters)', () => {
      saveMeetingContext({
        cvSummary: '',
        jobDescription: '',
        discussionTopic: 'Q3 Product Architecture Review and Roadmap Planning',
        keywords: [],
      })

      const res = getCombatReadiness('discussion')
      expect(res.details.hasContext).toBe(true)
      expect(res.score).toBe(30)
    })

    it('reaches combat readiness (>= 80%) when all requirements met', () => {
      // 1. Context: 30%
      saveMeetingContext({
        cvSummary: 'Senior Fullstack React & TypeScript Engineer with 5 years experience building systems',
        jobDescription: 'We are looking for a Senior Frontend Architect proficient in React and TypeScript',
        discussionTopic: '',
        keywords: ['React', 'TypeScript', 'WebRTC'], // 10%
      })

      // 2. Audio: VAD 20% + Chime Loopback 15% = 35%
      saveVADCalibration({
        deviceId: 'default-mic',
        deviceName: 'Default Mic',
        speechThresholdDbfs: -30,
        noiseFloorDbfs: -50,
        quality: 'good',
        qualityLabel: 'Tốt',
        timestamp: Date.now(),
        noiseFloorRms: 0.005,
        safetyMarginDb: 6,
        speechThresholdRms: 0.02,
        sensitivity: 0.8,
        totalFrames: 40,
        inlierFrames: 39,
        outlierFrames: 1,
        distribution: {
          minDbfs: -60,
          maxDbfs: -40,
          medianDbfs: -48,
          p65Dbfs: -46,
          q1Dbfs: -50,
          q3Dbfs: -45,
          iqr: 5,
          outlierCutoffDbfs: -35,
        },
      })
      setSystemAudioVerified(-18)

      // 3. AI: 25%
      setAIPrewarmed(150, 'test-model')

      const res = getCombatReadiness('interview')
      // 30 (context) + 20 (VAD) + 15 (Audio Chime) + 25 (AI) + 10 (Keywords) = 100%
      expect(res.score).toBe(100)
      expect(res.isCombatReady).toBe(true)
      expect(res.details.hasContext).toBe(true)
      expect(res.details.hasVAD).toBe(true)
      expect(res.details.hasAudioVerified).toBe(true)
      expect(res.details.isAIPrewarmed).toBe(true)
      expect(res.details.hasKeywords).toBe(true)
    })
  })
})
