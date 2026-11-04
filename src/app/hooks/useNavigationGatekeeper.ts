import { useState, useCallback, useEffect } from 'react'
import type { ViewState } from '@/components/layout/types'
import type { AppMode } from '@/types/electron.d'
import { isPreflightLobbySkipped } from './usePreFlightLobby'
import { getCombatReadiness, type CombatReadinessResult } from '@/services/preflight'

export interface UseNavigationGatekeeperProps {
  currentView: ViewState
  mode: AppMode
  onViewChange: (view: ViewState) => void
  onHasVisitedMeetingChange: (visited: boolean) => void
}

export function useNavigationGatekeeper({
  mode,
  onViewChange,
  onHasVisitedMeetingChange,
}: UseNavigationGatekeeperProps) {
  const [isLobbyOpen, setIsLobbyOpen] = useState(false)
  const [isReturnToLobby, setIsReturnToLobby] = useState(false)
  const [combatReadiness, setCombatReadiness] = useState<CombatReadinessResult>(() =>
    getCombatReadiness(mode)
  )

  // Refresh combat readiness whenever storage or custom events trigger
  const refreshReadiness = useCallback(() => {
    setCombatReadiness(getCombatReadiness(mode))
  }, [mode])

  useEffect(() => {
    const handleSync = () => refreshReadiness()
    window.addEventListener('storage', handleSync)
    window.addEventListener('preflight-audio-verified', handleSync)
    window.addEventListener('preflight-ai-prewarmed', handleSync)
    window.addEventListener('meeting-context-updated', handleSync)
    window.addEventListener('preflight-screen-pinned', handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('preflight-audio-verified', handleSync)
      window.removeEventListener('preflight-ai-prewarmed', handleSync)
      window.removeEventListener('meeting-context-updated', handleSync)
      window.removeEventListener('preflight-screen-pinned', handleSync)
    }
  }, [refreshReadiness])

  const openLobby = useCallback(() => {
    refreshReadiness()
    setIsLobbyOpen(true)
  }, [refreshReadiness])

  const closeLobby = useCallback(() => {
    setIsLobbyOpen(false)
  }, [])

  const confirmLaunchMeeting = useCallback(() => {
    setIsLobbyOpen(false)
    setIsReturnToLobby(false)
    onHasVisitedMeetingChange(true)
    onViewChange('meeting')
  }, [onViewChange, onHasVisitedMeetingChange])

  const openAudioTestFromLobby = useCallback(() => {
    setIsLobbyOpen(false)
    setIsReturnToLobby(true)
    onViewChange('audio-test')
  }, [onViewChange])

  const openAIDiagnosticFromLobby = useCallback(() => {
    setIsLobbyOpen(false)
    setIsReturnToLobby(true)
    onViewChange('ai-diagnostic')
  }, [onViewChange])

  const returnToLobbyFromPage = useCallback(() => {
    setIsReturnToLobby(false)
    refreshReadiness()
    setIsLobbyOpen(true)
  }, [refreshReadiness])

  const dismissReturnBanner = useCallback(() => {
    setIsReturnToLobby(false)
  }, [])

  /**
   * Centralized Gatekeeper: intercepts all navigation requests across the app.
   */
  const requestNavigate = useCallback(
    (targetView: ViewState) => {
      if (targetView !== 'meeting') {
        onViewChange(targetView)
        return
      }

      // Bypass checks & lobby when recovering an interrupted session directly from crash
      const isPendingRestore =
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pending_session_restore')
      if (isPendingRestore) {
        onHasVisitedMeetingChange(true)
        onViewChange('meeting')
        return
      }

      // Step 1: Context Guard Check
      const currentReadiness = getCombatReadiness(mode)
      setCombatReadiness(currentReadiness)

      if (!currentReadiness.details.hasContext) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('meeting-context-missing', {
              detail: { mode },
            })
          )
        }
        onViewChange('home')
        return
      }

      // Step 2: Pre-Flight Readiness & Skip Check
      const isSkipped = isPreflightLobbySkipped()
      if (isSkipped || currentReadiness.isCombatReady) {
        // Condition met: Enter meeting directly (user skipped lobby OR combat ready)
        confirmLaunchMeeting()
      } else {
        // Condition not met: Open centralized PreFlightLobbyModal
        setIsLobbyOpen(true)
      }
    },
    [mode, onViewChange, confirmLaunchMeeting]
  )

  return {
    isLobbyOpen,
    isReturnToLobby,
    combatReadiness,
    refreshReadiness,
    requestNavigate,
    openLobby,
    closeLobby,
    confirmLaunchMeeting,
    openAudioTestFromLobby,
    openAIDiagnosticFromLobby,
    returnToLobbyFromPage,
    dismissReturnBanner,
  }
}
