import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine } from '../types'
import { sessionsPort } from '@/infrastructure/ipc'
import { usageTrackerService } from '@/services/usage-tracker'
import { transcriptStore } from '../controllers/transcriptStore'
import type { VisualQuestionItem } from '@/services/screen-capture'

export interface RecoveredSessionData {
  sessionId: string
  title?: string
  mode?: AppMode
  startedAt?: number
  discussionTopic?: string
  discussionKeywords?: string[]
  screenshotQuestions?: VisualQuestionItem[]
  transcripts?: TranscriptLine[]
}

export interface UseSessionRecoveryProps {
  sessionId: string
  sessionTitle: string
  mode: AppMode
  meetingStartTime: number
  validLines: TranscriptLine[]
  visualQuestionsHistory: VisualQuestionItem[]
  isSavedToHistory?: boolean
  discussionTopic?: string
  discussionKeywords?: string[]
  onSessionRestored?: (recovered: RecoveredSessionData) => void
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
  isSavedToHistory = false,
  discussionTopic,
  discussionKeywords,
  onSessionRestored,
}: UseSessionRecoveryProps): UseSessionRecoveryReturn {
  const [unfinishedRecovery, setUnfinishedRecovery] = useState<any | null>(null)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(true)

  const recordedLineIdsRef = useRef<Set<string | number>>(new Set())
  const recordedTranslationsRef = useRef<Map<string | number, string>>(new Map())

  const sessionTitleRef = useRef(sessionTitle)
  const modeRef = useRef(mode)
  const visualQuestionsRef = useRef(visualQuestionsHistory)
  const isSavedRef = useRef(isSavedToHistory)
  const discussionTopicRef = useRef(discussionTopic)
  const discussionKeywordsRef = useRef(discussionKeywords)

  useEffect(() => {
    sessionTitleRef.current = sessionTitle
    modeRef.current = mode
    visualQuestionsRef.current = visualQuestionsHistory
    discussionTopicRef.current = discussionTopic
    discussionKeywordsRef.current = discussionKeywords
  }, [sessionTitle, mode, visualQuestionsHistory, discussionTopic, discussionKeywords])

  const extractRecoveredData = useCallback((record: any): RecoveredSessionData | null => {
    const snap = record?.snapshot
    if (!snap) return null
    const recoveredLines = Array.isArray(snap.transcripts) ? snap.transcripts : []
    const recoveredTitle = typeof snap.title === 'string' ? snap.title : undefined
    const recoveredMode = snap.mode === 'discussion' || snap.mode === 'interview' ? snap.mode : undefined
    const recoveredStartedAt = typeof snap.startedAt === 'number' ? snap.startedAt : undefined

    let recoveredTopic =
      typeof snap.discussionTopic === 'string' && snap.discussionTopic.trim()
        ? snap.discussionTopic.trim()
        : undefined

    if (!recoveredTopic && recoveredTitle && recoveredTitle.startsWith('Thảo luận:')) {
      const extracted = recoveredTitle.replace(/^Thảo luận:\s*/i, '').trim()
      if (extracted) recoveredTopic = extracted
    }

    return {
      sessionId: String(snap.id || record.sessionId),
      title: recoveredTitle,
      mode: recoveredMode,
      startedAt: recoveredStartedAt,
      discussionTopic: recoveredTopic,
      discussionKeywords: Array.isArray(snap.discussionKeywords) ? snap.discussionKeywords : undefined,
      screenshotQuestions: Array.isArray(snap.screenshotQuestions) ? snap.screenshotQuestions : undefined,
      transcripts: recoveredLines,
    }
  }, [])

  // Theo dõi trạng thái đã lưu: nếu đã lưu thì complete recovery và khóa checkpoint
  useEffect(() => {
    isSavedRef.current = isSavedToHistory
    if (isSavedToHistory && sessionId) {
      void sessionsPort.recovery.complete(sessionId, 'completed')
    }
  }, [isSavedToHistory, sessionId])

  // Initial recovery scan (skipping currently active session)
  useEffect(() => {
    let cancelled = false
    void sessionsPort.recovery
      .list({ activeSessionId: sessionId })
      .then((records) => {
        if (!cancelled && records.length > 0) {
          const first = records[0]
          setUnfinishedRecovery(first)

          // Check if auto-restore was requested from Home
          const pendingRestoreId =
            typeof sessionStorage !== 'undefined'
              ? sessionStorage.getItem('pending_session_restore')
              : null

          if (pendingRestoreId && (pendingRestoreId === first.sessionId || pendingRestoreId === 'any')) {
            sessionStorage.removeItem('pending_session_restore')
            const recData = extractRecoveredData(first)
            if (recData) {
              transcriptStore.setLines(recData.transcripts || [])
              onSessionRestored?.(recData)
              void sessionsPort.recovery.complete(first.sessionId, 'completed')
              setUnfinishedRecovery(null)
              setIsRecoveryOpen(false)
            }
          }
        }
      })
      .catch((error) => console.warn('[useSessionRecovery] Recovery scan failed:', error))

    return () => {
      cancelled = true
    }
  }, [sessionId, extractRecoveredData, onSessionRestored])

  const hasRecordedMetaRef = useRef<string | null>(null)

  // Ghi meeting:metadata và checkpoint lần đầu CHỈ KHI phiên họp thực sự có dữ liệu và chưa lưu
  useEffect(() => {
    const hasContent = validLines.length > 0 || visualQuestionsHistory.length > 0
    if (!hasContent || isSavedToHistory || hasRecordedMetaRef.current === sessionId) return

    hasRecordedMetaRef.current = sessionId

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
          discussionTopic: discussionTopicRef.current,
          discussionKeywords: discussionKeywordsRef.current,
          lifecycle: 'active',
        },
      })
      .catch((error) => console.warn('[useSessionRecovery] Metadata append failed:', error))

    void sessionsPort.recovery
      .checkpoint(sessionId, {
        id: sessionId,
        title: sessionTitleRef.current,
        mode: modeRef.current,
        startedAt: meetingStartTime,
        discussionTopic: discussionTopicRef.current,
        discussionKeywords: discussionKeywordsRef.current,
        lifecycle: 'active',
      })
      .catch((error) => console.warn('[useSessionRecovery] Initial checkpoint failed:', error))
  }, [sessionId, meetingStartTime, validLines.length, visualQuestionsHistory.length, isSavedToHistory])

  // Recovery Journaling: transcript:segment và late transcript:patch
  useEffect(() => {
    if (validLines.length === 0 || isSavedToHistory) return

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
  }, [validLines, sessionId, isSavedToHistory])

  const triggerCheckpoint = useCallback(() => {
    if (!sessionId || isSavedRef.current) return
    // Không ghi checkpoint nếu phiên họp chưa có dữ liệu nào hoặc đã lưu vào lịch sử
    const hasContent = validLines.length > 0 || visualQuestionsRef.current.length > 0
    if (!hasContent) return

    void sessionsPort.recovery
      .checkpoint(sessionId, {
        id: sessionId,
        title: sessionTitleRef.current,
        mode: modeRef.current,
        startedAt: meetingStartTime,
        discussionTopic: discussionTopicRef.current,
        discussionKeywords: discussionKeywordsRef.current,
        screenshotQuestions: visualQuestionsRef.current,
        usageRecords: [usageTrackerService.getSessionUsageSummary(sessionId)],
        lifecycle: 'active',
      })
      .catch((error) => console.warn('[useSessionRecovery] Checkpoint failed:', error))
  }, [sessionId, meetingStartTime, validLines.length])

  // Checkpoint Timer: MỘT interval (20s) cho cả phiên, không reset khi có dòng mới
  useEffect(() => {
    const timer = setInterval(triggerCheckpoint, 20000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isSavedRef.current) {
        triggerCheckpoint()
        void sessionsPort.recovery.flush(sessionId)
      }
    }

    const handleBeforeUnload = () => {
      if (!isSavedRef.current) {
        triggerCheckpoint()
        void sessionsPort.recovery.flush(sessionId)
      }
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
    if (!unfinishedRecovery) return
    const recData = extractRecoveredData(unfinishedRecovery)
    if (!recData) return

    transcriptStore.setLines(recData.transcripts || [])
    onSessionRestored?.(recData)

    // Đánh dấu hoàn tất recovery cho phiên cũ để banner không xuất hiện lại
    const recoverySessionId = unfinishedRecovery?.sessionId
    if (recoverySessionId) {
      void sessionsPort.recovery.complete(recoverySessionId, 'completed')
    }

    setUnfinishedRecovery(null)
    setIsRecoveryOpen(false)
  }, [unfinishedRecovery, extractRecoveredData, onSessionRestored])

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
