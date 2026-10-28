import { useState, useRef, useCallback, useEffect } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { AISuggestion } from '../types'

export interface UseCopilotCopyProps {
  mode: AppMode
  activeAnswerContent: string
  suggestions: AISuggestion[]
  isMounted: () => boolean
}

export function useCopilotCopy({
  mode,
  activeAnswerContent,
  suggestions,
  isMounted,
}: UseCopilotCopyProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [copiedOptionId, setCopiedOptionId] = useState<number | null>(null)
  const copyAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyOptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopyAnswer = useCallback(() => {
    if (mode === 'interview') {
      if (!activeAnswerContent) return
      navigator.clipboard.writeText(activeAnswerContent)
    } else {
      if (suggestions.length === 0) return
      const text = suggestions
        .map((s, i) => `${i + 1}. [${s.label || 'Phương án'}]\n${s.content}`)
        .join('\n\n')
      navigator.clipboard.writeText(text)
    }
    setCopiedAnswer(true)
    if (copyAnswerTimerRef.current) clearTimeout(copyAnswerTimerRef.current)
    copyAnswerTimerRef.current = setTimeout(() => {
      if (isMounted()) setCopiedAnswer(false)
    }, 2000)
  }, [mode, activeAnswerContent, suggestions, isMounted])

  const handleCopyOption = useCallback(
    (text: string, id: number, e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(text)
      setCopiedOptionId(id)
      if (copyOptionTimerRef.current) clearTimeout(copyOptionTimerRef.current)
      copyOptionTimerRef.current = setTimeout(() => {
        if (isMounted()) setCopiedOptionId(null)
      }, 2000)
    },
    [isMounted]
  )

  useEffect(() => {
    return () => {
      if (copyAnswerTimerRef.current) clearTimeout(copyAnswerTimerRef.current)
      if (copyOptionTimerRef.current) clearTimeout(copyOptionTimerRef.current)
    }
  }, [])

  return {
    copiedAnswer,
    copiedOptionId,
    handleCopyAnswer,
    handleCopyOption,
  }
}
