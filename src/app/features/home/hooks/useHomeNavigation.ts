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
import { validateMeetingLaunch } from '../utils/validation'

export interface UseHomeNavigationProps {
  mode: AppMode
  contextData: MeetingContextData
  activeProfile: ProfilePreset | null
  onViewChange: (view: ViewState) => void
  onInterviewTabChange?: (tab: 'cv' | 'jd') => void
  flushPendingContextSync: () => void
}

export interface UseHomeNavigationReturn {
  recentSessions: MeetingSession[]
  totalSessionsCount: number
  monthSummary: ReturnType<typeof usageTrackerService.getCurrentMonthSummary>
  meetingError: string | null
  setMeetingError: (err: string | null) => void
  handleLaunchMeeting: () => void
}

export function useHomeNavigation({
  mode,
  contextData,
  activeProfile,
  onViewChange,
  onInterviewTabChange,
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
    const unsubscribe = subscribeSessions((updated) => {
      setRecentSessions(updated.slice(0, 2))
      setTotalSessionsCount(updated.length)
    })
    initSessionStorage().then((loaded) => {
      setRecentSessions(loaded.slice(0, 2))
      setTotalSessionsCount(loaded.length)
    })
    return unsubscribe
  }, [])

  const [meetingError, setMeetingError] = useState<string | null>(null)

  const handleLaunchMeeting = useCallback(() => {
    const validation = validateMeetingLaunch(mode, contextData)
    if (!validation.canLaunch) {
      setMeetingError(validation.error)
      if (validation.targetTab && onInterviewTabChange) {
        onInterviewTabChange(validation.targetTab)
      }
      return
    }

    setMeetingError(null)

    // Flush any pending debounced sync
    flushPendingContextSync()

    // Ensure keywords exist if text is present
    let finalKeywords = contextData.keywords || []
    if (finalKeywords.length === 0) {
      const targetText =
        mode === 'interview' ? contextData.jobDescription : contextData.discussionTopic || ''
      if (targetText && targetText.trim()) {
        finalKeywords = jdKeywordExtractor.extractKeywords(targetText)
      }
    }

    const snapshotData = {
      ...contextData,
      keywords: finalKeywords,
    }

    // Persist immediately to meeting context storage and profile
    saveMeetingContext(snapshotData)
    if (mode === 'interview' && activeProfile) {
      profileContextService.updateProfile(activeProfile.id, {
        jobDescription: snapshotData.jobDescription,
        resumeContext: snapshotData.cvSummary,
        keywords: finalKeywords,
      })
    }

    onViewChange('meeting')
  }, [mode, contextData, activeProfile, onViewChange, onInterviewTabChange, flushPendingContextSync])

  return {
    recentSessions,
    totalSessionsCount,
    monthSummary,
    meetingError,
    setMeetingError,
    handleLaunchMeeting,
  }
}
