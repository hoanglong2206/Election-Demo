import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getSavedSessions,
  initSessionStorage,
  loadFullSession,
  subscribeSessions,
  getSavedRetentionDays,
  saveRetentionDays,
  applySessionRetention,
  type MeetingSession,
} from '@/services/session-history'

export interface UseSessionHistoryDataReturn {
  sessions: MeetingSession[]
  setSessions: React.Dispatch<React.SetStateAction<MeetingSession[]>>
  selectedSessionId: string
  setSelectedSessionId: React.Dispatch<React.SetStateAction<string>>
  currentSession: MeetingSession | null
  retentionDays: number
  handleRetentionChange: (days: number) => void
}

export function useSessionHistoryData(
  filteredFallbackSessions?: MeetingSession[]
): UseSessionHistoryDataReturn {
  const [sessions, setSessions] = useState<MeetingSession[]>(() => getSavedSessions())
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const preselected = sessionStorage.getItem('meeting_copilot_selected_session_id')
        if (preselected) {
          sessionStorage.removeItem('meeting_copilot_selected_session_id')
          return preselected
        }
      }
    } catch {}
    const list = getSavedSessions()
    return list.length > 0 ? list[0].id : ''
  })
  const [retentionDays, setRetentionDays] = useState<number>(() => getSavedRetentionDays())

  useEffect(() => {
    let isSubscribed = true

    // 1. Immediately sync with current in-memory cache upon mount
    const current = getSavedSessions()
    if (current && current.length > 0) {
      setSessions([...current])
      setSelectedSessionId((curr) => {
        if (!curr || !current.some((s) => s.id === curr)) {
          return current[0].id
        }
        return curr
      })
    }

    // 2. Subscribe to real-time session updates
    const unsubscribe = subscribeSessions((updated) => {
      if (!isSubscribed) return
      setSessions([...updated])
      if (updated.length > 0) {
        setSelectedSessionId((curr) => {
          if (!curr || !updated.some((s) => s.id === curr)) {
            return updated[0].id
          }
          return curr
        })
      } else {
        setSelectedSessionId('')
      }
    })

    // 3. Ensure async init completes if still in-flight
    initSessionStorage().then((loaded) => {
      if (!isSubscribed) return
      const currentSaved = getSavedSessions()
      const effective = currentSaved.length > 0 ? currentSaved : (loaded && loaded.length > 0 ? loaded : [])
      setSessions([...effective])
      if (effective.length > 0) {
        setSelectedSessionId((curr) => {
          if (!curr || !effective.some((s) => s.id === curr)) {
            return effective[0].id
          }
          return curr
        })
      }
    })

    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [])

  // Async lazy full-session loader
  useEffect(() => {
    if (!selectedSessionId) return
    let isMounted = true

    loadFullSession(selectedSessionId).then((full) => {
      if (!isMounted || !full) return
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === selectedSessionId)
        if (idx === -1) return prev
        if (prev[idx]._isFullyLoaded) return prev
        const clone = [...prev]
        clone[idx] = full
        return clone
      })
    })

    return () => {
      isMounted = false
    }
  }, [selectedSessionId])

  // Current selected session instance
  const currentSession = useMemo(() => {
    const found = sessions.find((s) => s.id === selectedSessionId)
    if (found) return found
    if (filteredFallbackSessions && filteredFallbackSessions.length > 0) {
      return filteredFallbackSessions[0]
    }
    return sessions.length > 0 ? sessions[0] : null
  }, [sessions, selectedSessionId, filteredFallbackSessions])

  const handleRetentionChange = useCallback((days: number) => {
    setRetentionDays(days)
    saveRetentionDays(days)
    if (days > 0) {
      const res = applySessionRetention(days)
      setSessions([...res.remainingSessions])
    }
  }, [])

  return {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    currentSession,
    retentionDays,
    handleRetentionChange,
  }
}
