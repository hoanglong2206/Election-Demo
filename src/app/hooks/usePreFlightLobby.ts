import { useState, useEffect, useCallback, useRef } from 'react'
import { playSystemTestChime } from '@/core/audio'
import {
  getAllAIModels,
  getSavedAIModelId,
  saveAIModelId,
  runAILatencyBenchmark,
  type AIModelConfig,
  type AIBenchmarkResult,
} from '@/services/ai-model/aiModels'
import {
  getSavedMeetingContext,
  saveMeetingContext,
} from '@/services/meeting-context'
import {
  getTacticalRecommendation,
  type TacticalRecommendation,
} from '@/features/ai-diagnostic/utils/benchmarkFormatters'
import { DEFAULT_JARGON_PRESETS } from '@/features/audio-test/components/jargon/TechnicalJargonTrainer'
import {
  isVADCalibrated,
  setAIPrewarmed,
  setSystemAudioVerified,
  isAIPrewarmed,
} from '@/services/preflight'
import {
  saveVADCalibration,
  analyzeCalibrationAudio,
  getVADCalibration,
} from '@/services/vad-calibration'

export const PREFLIGHT_SKIP_STORAGE_KEY = 'election_preflight_skip_lobby'
const AUDIO_VERIFIED_STORAGE_KEY = 'election_audio_system_verification'

export function isPreflightLobbySkipped(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(PREFLIGHT_SKIP_STORAGE_KEY) === 'true'
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(PREFLIGHT_SKIP_STORAGE_KEY) === 'true'
    }
  } catch {}
  return false
}

export function setPreflightLobbySkipped(skipped: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFLIGHT_SKIP_STORAGE_KEY, String(skipped))
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PREFLIGHT_SKIP_STORAGE_KEY, String(skipped))
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('preflight-lobby-skipped-changed'))
    }
  } catch {}
}

function isSystemAudioPreVerified(): boolean {
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

export interface UsePreFlightLobbyProps {
  isOpen?: boolean
  onEnterMeeting?: () => void
  isCapturing?: boolean
  db?: number
}

export function usePreFlightLobby({
  isOpen: externalIsOpen,
  onEnterMeeting,
  isCapturing = false,
  db = -60,
}: UsePreFlightLobbyProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isLobbyOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen

  const [skipLobby, setSkipLobbyState] = useState(() => isPreflightLobbySkipped())

  // Synchronize skip preference whenever modal opens or external storage/events fire
  useEffect(() => {
    if (isLobbyOpen) {
      setSkipLobbyState(isPreflightLobbySkipped())
    }
  }, [isLobbyOpen])

  useEffect(() => {
    const handleSyncSkipped = () => {
      setSkipLobbyState(isPreflightLobbySkipped())
    }
    window.addEventListener('preflight-lobby-skipped-changed', handleSyncSkipped)
    window.addEventListener('storage', handleSyncSkipped)
    return () => {
      window.removeEventListener('preflight-lobby-skipped-changed', handleSyncSkipped)
      window.removeEventListener('storage', handleSyncSkipped)
    }
  }, [])

  // Audio Verification State
  const [audioVerified, setAudioVerified] = useState(() => isSystemAudioPreVerified())
  const [isPlayingChime, setIsPlayingChime] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  // VAD Quick Calibration State
  const [vadCalibrated, setVadCalibrated] = useState(() => isVADCalibrated())
  const [isQuickCalibrating, setIsQuickCalibrating] = useState(false)
  const [quickCalibrateError, setQuickCalibrateError] = useState<string | null>(null)

  // AI Model & Benchmark State
  const [allModels, setAllModels] = useState<AIModelConfig[]>(() => getAllAIModels())
  const [activeModelId, setActiveModelId] = useState<string>(() => getSavedAIModelId())
  const [benchmarkResult, setBenchmarkResult] = useState<AIBenchmarkResult | null>(null)
  const [isBenchmarking, setIsBenchmarking] = useState(false)

  // Keywords State
  const [keywords, setKeywords] = useState<string[]>(() => {
    const saved = getSavedMeetingContext().keywords
    if (Array.isArray(saved) && saved.length > 0) return saved
    return DEFAULT_JARGON_PRESETS
  })

  // Synchronize audio verification if capturing with audio signal
  useEffect(() => {
    if (isCapturing && db > -45) {
      setAudioVerified(true)
      setSystemAudioVerified(-18)
    }
  }, [isCapturing, db])

  // Synchronize VAD calibration and AI Pre-warmed status
  useEffect(() => {
    const handleSync = () => {
      setVadCalibrated(isVADCalibrated())
      setAudioVerified(isSystemAudioPreVerified())
    }
    window.addEventListener('storage', handleSync)
    window.addEventListener('preflight-audio-verified', handleSync)
    window.addEventListener('preflight-vad-calibrated', handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('preflight-audio-verified', handleSync)
      window.removeEventListener('preflight-vad-calibrated', handleSync)
    }
  }, [])

  // Synchronize model updates from other tabs
  useEffect(() => {
    const handleModelUpdate = () => {
      setActiveModelId(getSavedAIModelId())
      setAllModels(getAllAIModels())
    }
    window.addEventListener('ai-models-updated', handleModelUpdate)
    window.addEventListener('storage', handleModelUpdate)
    return () => {
      window.removeEventListener('ai-models-updated', handleModelUpdate)
      window.removeEventListener('storage', handleModelUpdate)
    }
  }, [])

  // Audio: Play pleasant test chime (C5 -> E5 -> G5)
  const handlePlayChime = useCallback(async () => {
    if (isPlayingChime) return
    setIsPlayingChime(true)

    const success = await playSystemTestChime(audioContextRef.current)
    if (success) {
      setAudioVerified(true)
      setSystemAudioVerified(-18)
    }

    setTimeout(() => {
      setIsPlayingChime(false)
    }, 1100)
  }, [isPlayingChime])

  // VAD: Quick 2s ambient noise measurement
  const handleQuickCalibrateVAD = useCallback(async () => {
    if (isQuickCalibrating) return
    setIsQuickCalibrating(true)
    setQuickCalibrateError(null)

    try {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error('Microphone không được hỗ trợ trong môi trường này')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioContextClass({ sampleRate: 16000 })
      const sourceNode = audioCtx.createMediaStreamSource(stream)
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []

      scriptNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        chunks.push(new Float32Array(inputData))
      }

      sourceNode.connect(scriptNode)
      scriptNode.connect(audioCtx.destination)

      await new Promise((resolve) => setTimeout(resolve, 2000))

      scriptNode.disconnect()
      sourceNode.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      await audioCtx.close()

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const pcm16 = new Int16Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]))
          pcm16[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
      }

      const result = analyzeCalibrationAudio(pcm16, 'default-mic', 'Microphone Mặc Định (Quick)', {
        durationSec: 2.0,
      })
      saveVADCalibration(result)
      setVadCalibrated(true)
      window.dispatchEvent(new CustomEvent('preflight-vad-calibrated'))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đo ồn nhanh từ microphone'
      console.warn('[usePreFlightLobby] Quick VAD calibration failed:', msg)
      setQuickCalibrateError(msg)
    } finally {
      setIsQuickCalibrating(false)
    }
  }, [isQuickCalibrating])

  // AI: Switch model on the fly
  const handleSwitchModel = useCallback((newModelId: string) => {
    setActiveModelId(newModelId)
    saveAIModelId(newModelId)
    setBenchmarkResult(null)
  }, [])

  // AI: Run quick latency ping & pre-warm connection
  const handlePingModel = useCallback(async () => {
    if (isBenchmarking) return
    setIsBenchmarking(true)
    try {
      const res = await runAILatencyBenchmark(activeModelId, 'Hello, test latency.', 30)
      setBenchmarkResult(res)
      if (res && typeof res.latencyMs === 'number') {
        setAIPrewarmed(res.latencyMs, activeModelId)
      }
    } catch {
      // BenchmarkResult captures or remains null
    } finally {
      setIsBenchmarking(false)
    }
  }, [isBenchmarking, activeModelId])

  // Keywords: Add keyword
  const handleAddKeyword = useCallback((newKw: string) => {
    const trimmed = newKw.trim()
    if (!trimmed) return
    setKeywords((prev) => {
      if (prev.includes(trimmed)) return prev
      const updated = [...prev, trimmed]
      const current = getSavedMeetingContext()
      saveMeetingContext({ ...current, keywords: updated })
      return updated
    })
  }, [])

  // Keywords: Remove keyword
  const handleRemoveKeyword = useCallback((kwToRemove: string) => {
    setKeywords((prev) => {
      const updated = prev.filter((k) => k !== kwToRemove)
      const current = getSavedMeetingContext()
      saveMeetingContext({ ...current, keywords: updated })
      return updated
    })
  }, [])

  // Toggle "Don't show lobby again"
  const handleToggleSkipLobby = useCallback((newVal: boolean) => {
    setSkipLobbyState(newVal)
    setPreflightLobbySkipped(newVal)
  }, [])

  // Calculate combat readiness score (0 - 100%)
  const tacticalAdvice: TacticalRecommendation | null = getTacticalRecommendation(benchmarkResult)
  const isAIPrewarmOk = isAIPrewarmed()
  const isAITested = benchmarkResult !== null || isAIPrewarmOk
  const isAIRisk = tacticalAdvice?.category === 'risky'
  const isAIPassed = (benchmarkResult !== null && !isAIRisk) || isAIPrewarmOk

  let readinessScore = 0
  if (audioVerified) readinessScore += 40
  else if (vadCalibrated) readinessScore += 25

  if (isAIPassed) readinessScore += 40
  else if (isAITested && isAIRisk) readinessScore += 15

  if (keywords.length > 0) readinessScore += 20

  const isAllChecksPassed = Boolean((audioVerified || vadCalibrated) && isAIPassed && keywords.length > 0)

  const openLobby = () => setInternalIsOpen(true)
  const closeLobby = () => setInternalIsOpen(false)

  const handleProceedToMeeting = () => {
    setInternalIsOpen(false)
    onEnterMeeting?.()
  }

  // Get active VAD record for telemetry display
  const activeVadRecord = getVADCalibration('default-mic')

  return {
    isOpen: isLobbyOpen,
    openLobby,
    closeLobby,
    skipLobby,
    handleToggleSkipLobby,
    // Audio Loopback
    audioVerified,
    isPlayingChime,
    handlePlayChime,
    audioDb: db,
    isCapturing,
    // VAD Quick Check
    vadCalibrated,
    isQuickCalibrating,
    quickCalibrateError,
    handleQuickCalibrateVAD,
    activeVadRecord,
    // AI
    activeModelId,
    allModels,
    handleSwitchModel,
    handlePingModel,
    isBenchmarking,
    isAITested,
    isAIPassed,
    isAIRisky: isAIRisk,
    tacticalAdvice,
    // Keywords
    keywords,
    handleAddKeyword,
    handleRemoveKeyword,
    // Readiness
    readinessScore,
    isAllChecksPassed,
    handleProceedToMeeting,
  }
}
