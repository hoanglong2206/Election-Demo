import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine } from '../types'
import { sessionsPort } from '@/infrastructure/ipc'
import { usageTrackerService } from '@/services/usage-tracker'
import { transcriptStore } from '../controllers/transcriptStore'
import type { VisualQuestionItem } from '@/services/screen-capture'

export interface UseSessionRecoveryProps {
  sessionId: string
  sessionTitle: string
  mode: AppMode
  meetingStartTime: number
  validLines: TranscriptLine[]
  visualQuestionsHistory: VisualQuestionItem[]
  onSessionRestored?: (recoveredSessionId: string) => void
}

export interface UseSessionRecoveryReturn {
  unfinishedRecovery: any | null
  isRecoveryOpen: boolean
  handleRestoreRecovery: () => void
  handleCompleteRecovery: (lifecycle: 'completed' | 'discarded') => Promise<void>
  triggerCheckpoint: () => void
}

export function useSessionRecovery({
  sessionId,
  sessionTitle,
  mode,
  meetingStartTime,
  validLines,
  visualQuestionsHistory,
  onSessionRestored,
}: UseSessionRecoveryProps): UseSessionRecoveryReturn {
  const [unfinishedRecovery, setUnfinishedRecovery] = useState<any | null>(null)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(true)

  const recordedLineIdsRef = useRef<Set<string | number>>(new Set())
  const recordedTranslationsRef = useRef<Map<string | number, string>>(new Map())

  const sessionTitleRef = useRef(sessionTitle)
  const modeRef = useRef(mode)
  const visualQuestionsRef = useRef(visualQuestionsHistory)

  useEffect(() => {
    sessionTitleRef.current = sessionTitle
    modeRef.current = mode
    visualQuestionsRef.current = visualQuestionsHistory
  }, [sessionTitle, mode, visualQuestionsHistory])

  // Initial recovery scan (skipping currently active session)
  useEffect(() => {
    let cancelled = false
    void sessionsPort.recovery
      .list({ activeSessionId: sessionId })
      .then((records) => {
        if (!cancelled && records.length > 0) {
          setUnfinishedRecovery(records[0])
        }
      })
      .catch((error) => console.warn('[useSessionRecovery] Recovery scan failed:', error))

    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Giây 0: Ngay khi bắt đầu phiên, ghi meeting:metadata và checkpoint đầu tiên
  useEffect(() => {
    void sessionsPort.recovery
      .append({
        eventId: `meta:${sessionId}`,
        sessionId,
        type: 'meeting:metadata',
        timestamp: meetingStartTime,
        payload: {
          id: sessionId,
          title: sessionTitleRef.current,
          mode: modeRef.current,
          startedAt: meetingStartTime,
          lifecycle: 'active',
        },
      })
      .catch((error) => console.warn('[useSessionRecovery] Giây 0 metadata append failed:', error))

    void sessionsPort.recovery
      .checkpoint(sessionId, {
        id: sessionId,
        title: sessionTitleRef.current,
        mode: modeRef.current,
        startedAt: meetingStartTime,
        lifecycle: 'active',
      })
      .catch((error) => console.warn('[useSessionRecovery] Giây 0 checkpoint failed:', error))
  }, [sessionId, meetingStartTime])

  // Recovery Journaling: transcript:segment và late transcript:patch
  useEffect(() => {
    if (validLines.length === 0) return

    for (const line of validLines) {
      if (!line || line.id === undefined) continue
      const lineId = line.id

      if (!recordedLineIdsRef.current.has(lineId)) {
        recordedLineIdsRef.current.add(lineId)
        if (line.translated) {
          recordedTranslationsRef.current.set(lineId, line.translated)
        }
        void sessionsPort.recovery
          .append({
            eventId: `transcript:${sessionId}:${lineId}`,
            sessionId,
            type: 'transcript:segment',
            timestamp: Date.now(),
            payload: line,
          })
          .catch((error) => console.warn('[useSessionRecovery] Journal append failed:', error))
      } else if (
        line.translated &&
        line.translated !== recordedTranslationsRef.current.get(lineId)
      ) {
        recordedTranslationsRef.current.set(lineId, line.translated)
        void sessionsPort.recovery
          .append({
            eventId: `patch:${sessionId}:${lineId}:${Date.now()}`,
            sessionId,
            type: 'transcript:patch',
            timestamp: Date.now(),
            payload: {
              id: lineId,
              translated: line.translated,
            },
          })
          .catch((error) => console.warn('[useSessionRecovery] Journal patch failed:', error))
      }
    }
  }, [validLines, sessionId])

  const triggerCheckpoint = useCallback(() => {
    if (!sessionId) return

    void sessionsPort.recovery
      .checkpoint(sessionId, {
        id: sessionId,
        title: sessionTitleRef.current,
        mode: modeRef.current,
        screenshotQuestions: visualQuestionsRef.current,
        usageRecords: [usageTrackerService.getSessionUsageSummary(sessionId)],
        lifecycle: 'active',
      })
      .catch((error) => console.warn('[useSessionRecovery] Checkpoint failed:', error))
  }, [sessionId])

  // Checkpoint Timer: MỘT interval (20s) cho cả phiên, không reset khi có dòng mới
  useEffect(() => {
    const timer = setInterval(triggerCheckpoint, 20000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerCheckpoint()
        void sessionsPort.recovery.flush(sessionId)
      }
    }

    const handleBeforeUnload = () => {
      triggerCheckpoint()
      void sessionsPort.recovery.flush(sessionId)
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(timer)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionId, triggerCheckpoint])

  const handleRestoreRecovery = useCallback(() => {
    const recovered = unfinishedRecovery?.snapshot
    if (!recovered) return

    const recoveredLines = Array.isArray(recovered.transcripts) ? recovered.transcripts : []
    transcriptStore.setLines(recoveredLines)

    if (typeof recovered.id === 'string' && onSessionRestored) {
      onSessionRestored(recovered.id)
    }

    setUnfinishedRecovery(null)
    setIsRecoveryOpen(false)
  }, [unfinishedRecovery, onSessionRestored])

  const handleCompleteRecovery = useCallback(
    async (lifecycle: 'completed' | 'discarded') => {
      const recoverySessionId = unfinishedRecovery?.sessionId
      if (recoverySessionId) {
        await sessionsPort.recovery.complete(recoverySessionId, lifecycle)
      }
      setUnfinishedRecovery(null)
      setIsRecoveryOpen(false)
    },
    [unfinishedRecovery]
  )

  return {
    unfinishedRecovery,
    isRecoveryOpen,
    handleRestoreRecovery,
    handleCompleteRecovery,
    triggerCheckpoint,
  }
}
