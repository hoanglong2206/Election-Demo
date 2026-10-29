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
  const summaryRequestIdRef = useRef(0)

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
      if (isSummarizing) {
        return null
      }

      const reqId = ++summaryRequestIdRef.current
      setIsSummarizing(true)
      setSummaryError(null)

      try {
        const summary = await summarizeMeetingTranscripts(linesToSummarize, mode, responseLang)
        if (!isMountedRef.current || reqId !== summaryRequestIdRef.current) return null

        if (!summary) {
          setSummaryError(
            'Không nhận được tóm tắt từ LLM. Kiểm tra API Key trong tab Cài đặt rồi bấm "Tóm tắt lại".'
          )
          return null
        }

        setMeetingSummary(summary)
        setSummaryError(null)
        return summary
      } catch (err) {
        console.warn('[useMeetingSummary] summarize error:', err)
        if (isMountedRef.current && reqId === summaryRequestIdRef.current) {
          // Do not wipe existing summary to avoid layout jumping
          setSummaryError((err as Error)?.message || 'Lỗi khi gọi LLM tóm tắt.')
        }
        return null
      } finally {
        if (isMountedRef.current && reqId === summaryRequestIdRef.current) {
          setIsSummarizing(false)
        }
      }
    },
    [isSummarizing]
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
    summaryRequestIdRef.current++
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
