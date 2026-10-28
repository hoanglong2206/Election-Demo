import { useState, useCallback, useRef, useEffect } from 'react'

export function useCopyFeedback(resetDurationMs = 2000): {
  copied: boolean
  copy: (text: string) => Promise<boolean>
} {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), resetDurationMs)
        return true
      } catch (err) {
        console.warn('[useCopyFeedback] Clipboard write failed:', err)
        return false
      }
    },
    [resetDurationMs]
  )

  return { copied, copy }
}

