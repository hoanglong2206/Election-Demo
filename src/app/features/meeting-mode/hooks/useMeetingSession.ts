import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { HistorySuggestion, MeetingSession } from '@/services/sessionHistory'
import { saveSessionToHistoryAsync } from '@/services/sessionHistory'
import { usageTrackerService } from '@/services/usage-tracker'
import { sessionsPort } from '@/infrastructure/ipc'
import { isQuestionUtterance } from '@/services/ai-model/copilotResponseService'
import type { ProfilePresetSnapshot } from '@/services/profile-preset'
import type { VisualQuestionItem } from '@/services/screen-capture'
import type { AISuggestion, TranscriptLine } from '../types'
import type { ContextUsageInfo } from '@/services/ai-model/copilot'

export interface UseMeetingSessionProps {
  mode: AppMode
  profileSnapshot: ProfilePresetSnapshot
  discussionTopic?: string
  currentModelName: string
  currentModelProvider: string
  currentDeviceLabel: string
  hasInterviewContext: boolean
  hasDiscussionContext: boolean
  hasActiveContext: boolean
  activeCV: string
}

export interface SaveSessionOptions {
  validLines: TranscriptLine[]
  aiSuggestionsHistory: HistorySuggestion[]
  currentSuggestions: AISuggestion[]
  visualQuestionsHistory: VisualQuestionItem[]
  contextUsage: ContextUsageInfo | null
}

export interface UseMeetingSessionReturn {
  sessionId: string
  meetingStartTime: number
  customSessionTitle: string
  currentSessionTitle: string
  isSavedToHistory: boolean
  setCustomSessionTitle: (title: string) => void
  setSessionId: (id: string) => void
  handleSaveToHistory: (options: SaveSessionOptions) => Promise<void>
  resetSession: () => void
}

export function useMeetingSession({
  mode,
  profileSnapshot,
  discussionTopic,
  currentModelName,
  currentModelProvider,
  currentDeviceLabel,
  hasInterviewContext,
  hasDiscussionContext,
  hasActiveContext,
  activeCV,
}: UseMeetingSessionProps): UseMeetingSessionReturn {
  const isMountedRef = useRef(true)
  const [initialSessionId] = useState(() => `session_${Date.now()}`)
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [initialStartTime] = useState(() => Date.now())
  const [meetingStartTime, setMeetingStartTime] = useState(initialStartTime)

  const [customSessionTitle, setCustomSessionTitle] = useState<string>('')
  const [isSavedToHistory, setIsSavedToHistory] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const defaultSessionTitle = useMemo(() => {
    return mode === 'interview'
      ? hasInterviewContext
        ? `Phỏng vấn Kỹ thuật (${profileSnapshot.name || 'CV'})`
        : 'Cuộc họp Live Copilot'
      : hasDiscussionContext && discussionTopic
      ? `Thảo luận: ${discussionTopic.slice(0, 40)}`
      : 'Cuộc họp Thảo luận Live'
  }, [mode, hasInterviewContext, hasDiscussionContext, profileSnapshot.name, discussionTopic])

  const currentSessionTitle = customSessionTitle || defaultSessionTitle

  const resetSession = useCallback(() => {
    const newId = `session_${Date.now()}`
    setSessionId(newId)
    setMeetingStartTime(Date.now())
    setCustomSessionTitle('')
    setIsSavedToHistory(false)
  }, [])

  const handleSaveToHistory = useCallback(
    async (options: SaveSessionOptions) => {
      const { validLines, aiSuggestionsHistory, currentSuggestions, visualQuestionsHistory, contextUsage } = options
      const endedAt = Date.now()
      const startedAt = meetingStartTime
      const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000))
      const durationMinutes = Math.max(1, Math.round(durationSeconds / 60))

      const sessionTranscripts = validLines.map((l) => ({
        id: l.id,
        speaker: l.speaker,
        timestamp: l.timestamp,
        original: l.original,
        translated: l.translated,
        isQuestion: isQuestionUtterance(l.original),
      }))

      // Ensure chronological sorting
      sessionTranscripts.sort((a, b) => {
        const parseSec = (ts: string) => {
          if (!ts) return 0
          const parts = ts.split(':').map((p) => parseFloat(p) || 0)
          return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0
        }
        return parseSec(a.timestamp) - parseSec(b.timestamp)
      })

      const sessionSuggestions: HistorySuggestion[] =
        aiSuggestionsHistory.length > 0
          ? [...aiSuggestionsHistory]
          : currentSuggestions.map((s) => {
              const usage = s.contextUsage || contextUsage
              return {
                id: s.id,
                type: s.type,
                label: s.label,
                content: s.content,
                confidence: s.confidence,
                timestamp: validLines[validLines.length - 1]?.timestamp || '00:00',
                tokenUsage: usage
                  ? {
                      promptTokens: usage.totalTokens,
                      totalTokens: usage.totalTokens,
                      costStatus: 'unknown',
                    }
                  : undefined,
              }
            })

      const sessionScreenshots = visualQuestionsHistory.map((vq) => ({
        id: vq.id,
        timestamp: vq.timestamp,
        imageMetadata: {
          fileName: 'screenshot.png',
          dataUrl: vq.thumbnailUrl,
        },
        thumbnailUrl: vq.thumbnailUrl,
        dataUrl: vq.thumbnailUrl,
        ocrText: vq.ocrText,
        contentType: vq.contentType,
        analysisResult: {
          questionSummary: vq.problemSummary,
          questionType: vq.contentType,
          suggestedAnswer: vq.recommendedAnswer,
          keyPoints: vq.keyInsights,
          codeSnippet: vq.extractedCode,
        },
      }))

      const questionCount =
        sessionTranscripts.filter((t) => t.isQuestion).length + sessionScreenshots.length

      const sessionUsage = usageTrackerService.getSessionUsageSummary(sessionId)
      const trackedTokens = sessionUsage.totalInputTokens + sessionUsage.totalOutputTokens

      const session: MeetingSession = {
        id: sessionId || `session-live-${Date.now()}`,
        title: currentSessionTitle,
        profileId: mode === 'interview' ? profileSnapshot.presetId : undefined,
        profileSnapshot: mode === 'interview' ? profileSnapshot : undefined,
        companyName: mode === 'interview' ? profileSnapshot.companyName : undefined,
        targetRole:
          mode === 'interview'
            ? profileSnapshot.role
            : discussionTopic || 'Thảo luận nhóm',
        startedAt,
        endedAt,
        durationMinutes,
        durationSeconds,
        date: new Date().toLocaleString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        mode,
        aiModel: `${currentModelName} (${currentModelProvider})`,
        audioSource: currentDeviceLabel,
        contextApplied: hasActiveContext,
        candidateName: activeCV
          ? profileSnapshot.name
            ? `${profileSnapshot.role} (${profileSnapshot.name})`
            : 'Ứng viên (Theo hồ sơ CV đã nạp)'
          : undefined,
        transcripts: sessionTranscripts,
        suggestions: sessionSuggestions,
        screenshotQuestions: sessionScreenshots,
        metrics: {
          totalInteractions:
            sessionTranscripts.length + sessionSuggestions.length + sessionScreenshots.length,
          questionCount,
          aiResponseCount: sessionSuggestions.length,
          screenshotCount: sessionScreenshots.length,
          totalTokens: trackedTokens > 0 ? trackedTokens : contextUsage?.totalTokens || 0,
          inputTokens: sessionUsage.totalInputTokens,
          outputTokens: sessionUsage.totalOutputTokens,
          cachedTokens: sessionUsage.totalCachedTokens,
          audioDurationSeconds: sessionUsage.totalAudioDurationSeconds,
          estimatedCostUsd: sessionUsage.totalEstimatedCostUsd,
          costStatus: sessionUsage.costStatus,
        },
        exportSchemaVersion: '2.0',
      }

      try {
        const saveAck = await saveSessionToHistoryAsync(session)
        if (saveAck && saveAck.success) {
          // Safe Sequencing: Complete recovery ONLY AFTER confirmed storage save
          await sessionsPort.recovery.complete(session.id, 'completed')
          void usageTrackerService.flushBatch()
          setIsSavedToHistory(true)

          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setIsSavedToHistory(false)
          }, 2500)
        } else {
          console.error('[useMeetingSession] Save to history failed:', saveAck?.error)
          alert('Không thể lưu cuộc họp vào bộ nhớ bền vững. Dữ liệu phục hồi sự cố được giữ nguyên an toàn!')
        }
      } catch (saveErr) {
        console.error('[useMeetingSession] Unexpected exception saving session:', saveErr)
        alert('Đã xảy ra lỗi khi lưu cuộc họp. Dữ liệu phục hồi sự cố được giữ nguyên!')
      }
    },
    [
      meetingStartTime,
      sessionId,
      currentSessionTitle,
      mode,
      profileSnapshot,
      discussionTopic,
      currentModelName,
      currentModelProvider,
      currentDeviceLabel,
      hasActiveContext,
      activeCV,
    ]
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return {
    sessionId,
    meetingStartTime,
    customSessionTitle,
    currentSessionTitle,
    isSavedToHistory,
    setCustomSessionTitle,
    setSessionId,
    handleSaveToHistory,
    resetSession,
  }
}
