import { useState, useRef, useCallback, useEffect } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine } from '../types'
import type { ResponseLanguage } from '@/services/ai-model/aiModels'
import { summarizeMeetingTranscripts } from '@/services/ai-model/summary'

export interface UseMeetingSummaryReturn {
  meetingSummary: string | null
  isSummarizing: boolean
  summaryError: string | null
  copiedSummary: boolean
  handleGenerateSummary: (
    linesToSummarize: TranscriptLine[],
    mode: AppMode,
    responseLang: ResponseLanguage
  ) => Promise<string | null>
  handleCopySummary: () => void
  resetSummary: () => void
}

export function useMeetingSummary(): UseMeetingSummaryReturn {
  const isMountedRef = useRef(true)
  const [meetingSummary, setMeetingSummary] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleGenerateSummary = useCallback(
    async (
      linesToSummarize: TranscriptLine[],
      mode: AppMode,
      responseLang: ResponseLanguage
    ): Promise<string | null> => {
      if (!linesToSummarize || linesToSummarize.length === 0) {
        setSummaryError('Chưa có transcript để tóm tắt.')
        return null
      }

      setIsSummarizing(true)
      setSummaryError(null)

      try {
        const summary = await summarizeMeetingTranscripts(linesToSummarize, mode, responseLang)
        if (!isMountedRef.current) return null

        if (!summary) {
          setMeetingSummary(null)
          setSummaryError(
            'Không nhận được tóm tắt từ LLM. Kiểm tra API Key trong tab Cài đặt rồi bấm "Tóm tắt lại".'
          )
          return null
        }

        setMeetingSummary(summary)
        return summary
      } catch (err) {
        console.warn('[useMeetingSummary] summarize error:', err)
        if (isMountedRef.current) {
          setMeetingSummary(null)
          setSummaryError((err as Error)?.message || 'Lỗi khi gọi LLM tóm tắt.')
        }
        return null
      } finally {
        if (isMountedRef.current) {
          setIsSummarizing(false)
        }
      }
    },
    []
  )

  const handleCopySummary = useCallback(() => {
    if (!meetingSummary) return
    navigator.clipboard.writeText(meetingSummary)
    setCopiedSummary(true)

    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setCopiedSummary(false)
    }, 2000)
  }, [meetingSummary])

  const resetSummary = useCallback(() => {
    setMeetingSummary(null)
    setSummaryError(null)
    setIsSummarizing(false)
  }, [])

  return {
    meetingSummary,
    isSummarizing,
    summaryError,
    copiedSummary,
    handleGenerateSummary,
    handleCopySummary,
    resetSummary,
  }
}
