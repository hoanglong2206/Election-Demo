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
    const list = getSavedSessions()
    return list.length > 0 ? list[0].id : ''
  })
  const [retentionDays, setRetentionDays] = useState<number>(() => getSavedRetentionDays())

  useEffect(() => {
    let isSubscribed = true

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

    initSessionStorage().then((loaded) => {
      if (!isSubscribed) return
      const currentSaved = getSavedSessions()
      const effective = loaded && loaded.length > 0 ? loaded : currentSaved
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

  // Lazy-load full session details (transcripts & suggestions) on demand
  useEffect(() => {
    if (!selectedSessionId) return
    const current = sessions.find((s) => s.id === selectedSessionId)
    if (current && !current._isFullyLoaded) {
      loadFullSession(selectedSessionId).then((full) => {
        if (full) {
          setSessions((prev) => prev.map((s) => (s.id === full.id ? full : s)))
        }
      })
    }
  }, [selectedSessionId, sessions])

  const currentSession = useMemo(() => {
    const selected = sessions.find((s) => s.id === selectedSessionId)
    if (selected) return selected
    return selectedSessionId ? null : (filteredFallbackSessions && filteredFallbackSessions[0]) || null
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

