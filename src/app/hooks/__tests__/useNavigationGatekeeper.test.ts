import '@/test/setupDom'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useNavigationGatekeeper } from '../useNavigationGatekeeper'
import { setPreflightLobbySkipped } from '../usePreFlightLobby'
import { saveMeetingContext } from '@/services/meeting-context/repository'
import { saveVADCalibration, clearAllVADCalibrations } from '@/services/vad-calibration/vadCalibrationStorage'
import { setSystemAudioVerified, setAIPrewarmed } from '@/services/preflight'

describe('useNavigationGatekeeper Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearAllVADCalibrations()
    setPreflightLobbySkipped(false)
  })

  it('allows navigation directly to non-meeting views without gatekeeper check', () => {
    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    act(() => {
      result.current.requestNavigate('audio-test')
    })

    expect(onViewChange).toHaveBeenCalledWith('audio-test')
    expect(result.current.isLobbyOpen).toBe(false)
  })

  it('blocks navigation to meeting and redirects to home when interview context is missing', () => {
    saveMeetingContext({ cvSummary: '', jobDescription: '', discussionTopic: '', keywords: [] })

    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})
    let missingEventFired = false

    const handleMissing = () => {
      missingEventFired = true
    }
    window.addEventListener('meeting-context-missing', handleMissing)

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    act(() => {
      result.current.requestNavigate('meeting')
    })

    window.removeEventListener('meeting-context-missing', handleMissing)

    expect(missingEventFired).toBe(true)
    expect(onViewChange).toHaveBeenCalledWith('home')
    expect(result.current.isLobbyOpen).toBe(false)
  })

  it('opens PreFlightLobbyModal when context exists but readiness score is below 80%', () => {
    saveMeetingContext({
      cvSummary: 'Experienced Senior Frontend React Engineer with 5 years exp building systems...',
      jobDescription: 'Looking for a Senior Fullstack React and Node Engineer to build cloud apps...',
      discussionTopic: '',
      keywords: [],
    })

    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    act(() => {
      result.current.requestNavigate('meeting')
    })

    expect(result.current.isLobbyOpen).toBe(true)
    expect(onViewChange).not.toHaveBeenCalledWith('meeting')
  })

  it('enters meeting directly without opening lobby when skipped is true AND readiness score >= 80%', () => {
    // 1. Context: 30% + Keywords: 10%
    saveMeetingContext({
      cvSummary: 'Senior Fullstack React & TypeScript Engineer with 5 years experience building systems',
      jobDescription: 'We are looking for a Senior Frontend Architect proficient in React and TypeScript',
      discussionTopic: '',
      keywords: ['React', 'TypeScript', 'WebRTC'],
    })

    // 2. Audio: VAD 20% + Chime Loopback 15%
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

    // 4. Mark lobby as skipped
    setPreflightLobbySkipped(true)

    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    act(() => {
      result.current.requestNavigate('meeting')
    })

    expect(result.current.isLobbyOpen).toBe(false)
    expect(onViewChange).toHaveBeenCalledWith('meeting')
    expect(onHasVisitedMeetingChange).toHaveBeenCalledWith(true)
  })

  it('enters meeting directly without opening lobby when skipped is true even if readiness score is below 80%', () => {
    // Only basic context (score = 30%)
    saveMeetingContext({
      cvSummary: 'Senior React Developer with 5 years exp',
      jobDescription: 'Senior Frontend Developer opening at tech company',
      discussionTopic: '',
      keywords: [],
    })

    // User checked "Don't show lobby again"
    setPreflightLobbySkipped(true)

    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    act(() => {
      result.current.requestNavigate('meeting')
    })

    expect(result.current.isLobbyOpen).toBe(false)
    expect(onViewChange).toHaveBeenCalledWith('meeting')
    expect(onHasVisitedMeetingChange).toHaveBeenCalledWith(true)
  })

  it('manages deep link navigation to AudioTest and AIDiagnostic with return banner state', () => {
    const onViewChange = mock(() => {})
    const onHasVisitedMeetingChange = mock(() => {})

    const { result } = renderHook(() =>
      useNavigationGatekeeper({
        currentView: 'home',
        mode: 'interview',
        onViewChange,
        onHasVisitedMeetingChange,
      })
    )

    // Open AudioTest from lobby
    act(() => {
      result.current.openAudioTestFromLobby()
    })
    expect(result.current.isReturnToLobby).toBe(true)
    expect(result.current.isLobbyOpen).toBe(false)
    expect(onViewChange).toHaveBeenCalledWith('audio-test')

    // Return to lobby from page banner
    act(() => {
      result.current.returnToLobbyFromPage()
    })
    expect(result.current.isReturnToLobby).toBe(false)
    expect(result.current.isLobbyOpen).toBe(true)

    // Open AIDiagnostic from lobby
    act(() => {
      result.current.openAIDiagnosticFromLobby()
    })
    expect(result.current.isReturnToLobby).toBe(true)
    expect(onViewChange).toHaveBeenCalledWith('ai-diagnostic')

    // Dismiss banner
    act(() => {
      result.current.dismissReturnBanner()
    })
    expect(result.current.isReturnToLobby).toBe(false)
  })
})
