import { getAllVADCalibrations, getVADCalibration } from '@/services/vad-calibration/vadCalibrationStorage'
import { getSavedMeetingContext } from '@/services/meeting-context/repository'
import { isValidCvContent, isValidJdContent } from '@/services/meeting-context/validation'
import type { AppMode } from '@/types/electron.d'

export const PREFLIGHT_SKIP_STORAGE_KEY = 'election_preflight_skip_lobby'
export const AUDIO_VERIFIED_STORAGE_KEY = 'election_audio_system_verification'
export const AI_PREWARMED_STORAGE_KEY = 'election_ai_prewarmed'
export const SCREEN_PRESET_STORAGE_KEY = 'election_screen_capture_preset'

const PREWARM_EXPIRATION_MS = 30 * 60 * 1000 // 30 minutes

export interface PinnedScreenSource {
  sourceId: string
  name: string
  sourceType: 'screen' | 'window'
  pinnedAt: number
}

export interface CombatReadinessDetails {
  hasContext: boolean
  hasVAD: boolean
  hasAudioVerified: boolean
  isAIPrewarmed: boolean
  hasKeywords: boolean
}

export interface CombatReadinessResult {
  score: number // 0 - 100
  isCombatReady: boolean // score >= 80
  details: CombatReadinessDetails
}

/**
 * Checks whether user has calibrated VAD on any device or a specific deviceId.
 */
export function isVADCalibrated(deviceId?: string): boolean {
  if (deviceId) {
    return getVADCalibration(deviceId) !== null
  }
  const all = getAllVADCalibrations()
  return Object.keys(all).length > 0
}

/**
 * Checks whether 2-way system loopback chime test has been verified.
 */
export function isSystemAudioVerified(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const raw =
        window.sessionStorage?.getItem(AUDIO_VERIFIED_STORAGE_KEY) ||
        window.localStorage?.getItem(AUDIO_VERIFIED_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return Boolean(parsed.systemVerified)
      }
    }
  } catch {}
  return false
}

/**
 * Marks system loopback chime as verified.
 */
export function setSystemAudioVerified(maxDb = -18): void {
  try {
    if (typeof window !== 'undefined') {
      const payload = JSON.stringify({ systemVerified: true, systemMaxDb: maxDb, timestamp: Date.now() })
      window.sessionStorage?.setItem(AUDIO_VERIFIED_STORAGE_KEY, payload)
      window.localStorage?.setItem(AUDIO_VERIFIED_STORAGE_KEY, payload)
      window.dispatchEvent(new CustomEvent('preflight-audio-verified'))
    }
  } catch {}
}

/**
 * Checks whether AI persistent connection has been pre-warmed within last 30 minutes.
 */
export function isAIPrewarmed(): boolean {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(AI_PREWARMED_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.timestamp && Date.now() - parsed.timestamp < PREWARM_EXPIRATION_MS) {
          return true
        }
      }
    }
  } catch {}
  return false
}

/**
 * Saves AI pre-warmed state with latency metrics into sessionStorage.
 */
export function setAIPrewarmed(ttftMs?: number, modelId?: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const payload = JSON.stringify({
        timestamp: Date.now(),
        ttftMs: ttftMs || 0,
        modelId: modelId || 'default',
      })
      window.sessionStorage.setItem(AI_PREWARMED_STORAGE_KEY, payload)
      window.dispatchEvent(new CustomEvent('preflight-ai-prewarmed'))
    }
  } catch {}
}

/**
 * Gets pinned screen capture window source preset.
 */
export function getPinnedScreenSource(): PinnedScreenSource | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SCREEN_PRESET_STORAGE_KEY)
      if (raw) return JSON.parse(raw) as PinnedScreenSource
    }
  } catch {}
  return null
}

/**
 * Saves pinned screen capture window source preset.
 */
export function setPinnedScreenSource(preset: Omit<PinnedScreenSource, 'pinnedAt'>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const full: PinnedScreenSource = { ...preset, pinnedAt: Date.now() }
      localStorage.setItem(SCREEN_PRESET_STORAGE_KEY, JSON.stringify(full))
      window.dispatchEvent(new CustomEvent('preflight-screen-pinned'))
    }
  } catch {}
}

/**
 * Evaluates full Combat Readiness Score (0 - 100%) and criteria breakdown.
 */
export function getCombatReadiness(mode: AppMode = 'interview', deviceId?: string): CombatReadinessResult {
  const context = getSavedMeetingContext()
  let hasContext = false

  if (mode === 'interview') {
    hasContext = isValidCvContent(context.cvSummary) && isValidJdContent(context.jobDescription)
  } else {
    // Discussion mode
    hasContext = Boolean(context.discussionTopic && context.discussionTopic.trim().length >= 5)
  }

  const hasVAD = isVADCalibrated(deviceId)
  const hasAudioVerified = isSystemAudioVerified()
  const aiPrewarmed = isAIPrewarmed()
  const hasKeywords = Array.isArray(context.keywords) && context.keywords.length > 0

  let score = 0
  // Context: 30%
  if (hasContext) score += 30

  // Audio: 35% (VAD: 20%, Loopback chime: 15%)
  if (hasVAD) score += 20
  if (hasAudioVerified) score += 15

  // AI Connection: 25%
  if (aiPrewarmed) score += 25

  // Tech keywords: 10%
  if (hasKeywords) score += 10

  return {
    score: Math.min(100, score),
    isCombatReady: score >= 80,
    details: {
      hasContext,
      hasVAD,
      hasAudioVerified,
      isAIPrewarmed: aiPrewarmed,
      hasKeywords,
    },
  }
}
