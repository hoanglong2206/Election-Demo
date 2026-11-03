import { useState, useEffect, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { ViewState } from '@/components/layout/types'
import { usageTrackerService } from '@/services/usage-tracker'
import {
  getSavedSessions,
  initSessionStorage,
  subscribeSessions,
  type MeetingSession,
} from '@/services/session-history'
import { saveMeetingContext, type MeetingContextData } from '@/services/meeting-context'
import { jdKeywordExtractor } from '@/services/ai-model/stt'
import { profileContextService, type ProfilePreset } from '@/services/profile-preset'
import { isPreflightLobbySkipped, setPreflightLobbySkipped } from '@/hooks/usePreFlightLobby'

export interface UseHomeNavigationProps {
  mode: AppMode
  contextData: MeetingContextData
  activeProfile: ProfilePreset | null
  onViewChange: (view: ViewState) => void
  onInterviewTabChange?: (tab: 'cv' | 'jd') => void
  flushPendingContextSync: () => MeetingContextData | void
}

export interface UseHomeNavigationReturn {
  recentSessions: MeetingSession[]
  totalSessionsCount: number
  monthSummary: ReturnType<typeof usageTrackerService.getCurrentMonthSummary>
  meetingError: string | null
  setMeetingError: (err: string | null) => void
  handleLaunchMeeting: () => void
  handleOpenSession: (sessionId: string) => void
  isLobbyOpen: boolean
  setIsLobbyOpen: (open: boolean) => void
  handleConfirmLaunchMeeting: () => void
  isLobbySkipped: boolean
  handleResetLobbySkipped: () => void
  handleOpenLobby: () => void
}

export function useHomeNavigation({
  mode,
  contextData,
  activeProfile,
  onViewChange,
  onInterviewTabChange: _onInterviewTabChange,
  flushPendingContextSync,
}: UseHomeNavigationProps): UseHomeNavigationReturn {
  // Usage Tracker Monthly Summary
  const [monthSummary, setMonthSummary] = useState(() =>
    usageTrackerService.getCurrentMonthSummary()
  )
  useEffect(() => {
    const unsub = usageTrackerService.subscribe((updated) => {
      setMonthSummary(updated)
    })
    return () => unsub()
  }, [])

  // Recent Sessions State
  const [recentSessions, setRecentSessions] = useState<MeetingSession[]>(() =>
    getSavedSessions().slice(0, 2)
  )
  const [totalSessionsCount, setTotalSessionsCount] = useState<number>(
    () => getSavedSessions().length
  )

  useEffect(() => {
    // 1. Subscribe to real-time session changes
    const unsubscribe = subscribeSessions((updated) => {
      setRecentSessions(updated.slice(0, 2))
      setTotalSessionsCount(updated.length)
    })

    // 2. Ensure async init completes if it was still in flight
    initSessionStorage().then((loaded) => {
      const latest = getSavedSessions()
      const effective = latest.length > 0 ? latest : loaded
      setRecentSessions(effective.slice(0, 2))
      setTotalSessionsCount(effective.length)
    })

    return unsubscribe
  }, [])

  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [isLobbyOpen, setIsLobbyOpen] = useState(false)
  const [isLobbySkipped, setIsLobbySkipped] = useState(() => isPreflightLobbySkipped())

  useEffect(() => {
    const handleSyncSkipped = () => {
      setIsLobbySkipped(isPreflightLobbySkipped())
    }
    window.addEventListener('preflight-lobby-skipped-changed', handleSyncSkipped)
    window.addEventListener('storage', handleSyncSkipped)
    return () => {
      window.removeEventListener('preflight-lobby-skipped-changed', handleSyncSkipped)
      window.removeEventListener('storage', handleSyncSkipped)
    }
  }, [])

  const handleResetLobbySkipped = useCallback(() => {
    setPreflightLobbySkipped(false)
    setIsLobbySkipped(false)
  }, [])

  const handleOpenLobby = useCallback(() => {
    setIsLobbyOpen(true)
  }, [])

  const handleConfirmLaunchMeeting = useCallback(() => {
    setIsLobbyOpen(false)
    onViewChange('meeting')
  }, [onViewChange])

  const handleLaunchMeeting = useCallback(() => {
    setMeetingError(null)

    // Flush any pending debounced sync synchronously before proceeding and get latest content
    const flushedData = flushPendingContextSync()
    const effectiveContext = (flushedData as MeetingContextData) || contextData

    let finalKeywords = effectiveContext.keywords || []
    let finalDiscussionKeywords = effectiveContext.discussionKeywords || []

    if (mode === 'interview') {
      if (finalKeywords.length === 0 && effectiveContext.jobDescription?.trim()) {
        finalKeywords = jdKeywordExtractor.extractKeywords(effectiveContext.jobDescription)
      }
    } else {
      if (finalDiscussionKeywords.length === 0 && effectiveContext.discussionTopic?.trim()) {
        finalDiscussionKeywords = jdKeywordExtractor.extractKeywords(effectiveContext.discussionTopic)
      }
    }

    const snapshotData: MeetingContextData = {
      ...effectiveContext,
      keywords: finalKeywords,
      discussionKeywords: finalDiscussionKeywords,
    }

    try {
      // Persist immediately to meeting context storage and profile
      saveMeetingContext(snapshotData)
      if (mode === 'interview' && activeProfile) {
        profileContextService.updateProfile(activeProfile.id, {
          jobDescription: snapshotData.jobDescription,
          resumeContext: snapshotData.cvSummary,
          keywords: finalKeywords,
        })
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('meeting-context-updated', { detail: snapshotData }))
      }
      if (isPreflightLobbySkipped()) {
        onViewChange('meeting')
      } else {
        setIsLobbyOpen(true)
      }
    } catch (err) {
      console.error('[useHomeNavigation] Failed to persist meeting context before launch:', err)
      setMeetingError('Không thể lưu dữ liệu ngữ cảnh cuộc họp. Vui lòng thử lại.')
    }
  }, [mode, contextData, activeProfile, onViewChange, flushPendingContextSync])

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('meeting_copilot_selected_session_id', sessionId)
        }
      } catch {}
      onViewChange('history')
    },
    [onViewChange]
  )

  return {
    recentSessions,
    totalSessionsCount,
    monthSummary,
    meetingError,
    setMeetingError,
    handleLaunchMeeting,
    handleOpenSession,
    isLobbyOpen,
    setIsLobbyOpen,
    handleConfirmLaunchMeeting,
    isLobbySkipped,
    handleResetLobbySkipped,
    handleOpenLobby,
  }
}
