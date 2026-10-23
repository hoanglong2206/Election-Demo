import { useCallback, useRef, useState } from 'react'
import { translateToVietnamese } from '../services/ai-model/copilot/translate'

export interface TranslationEntry {
  text?: string
  showing: boolean
  busy: boolean
  error?: string
}

/**
 * Per-response Vietnamese translations for the bilingual response mode.
 *
 * Entries are keyed by a stable string ('interview', `opt-1`, 'summary'...).
 * The first click calls the LLM; later clicks just toggle between the original
 * and the translation, so re-reading a response costs nothing.
 */
export function useVietnameseTranslation() {
  const [entries, setEntries] = useState<Record<string, TranslationEntry>>({})
  const inFlight = useRef<Set<string>>(new Set())

  const reset = useCallback(() => {
    inFlight.current.clear()
    setEntries({})
  }, [])

  const toggle = useCallback(
    async (key: string, source: string) => {
      const existing = entries[key]

      // Already translated -> just toggle between VI and the original.
      if (existing?.text) {
        setEntries((prev) => ({
          ...prev,
          [key]: { ...prev[key], showing: !prev[key].showing },
        }))
        return
      }
      if (inFlight.current.has(key)) return

      inFlight.current.add(key)
      setEntries((prev) => ({
        ...prev,
        [key]: { text: undefined, showing: false, busy: true, error: undefined },
      }))

      try {
        const out = await translateToVietnamese(source)
        setEntries((prev) => ({
          ...prev,
          [key]: out
            ? { text: out, showing: true, busy: false, error: undefined }
            : {
                text: undefined,
                showing: false,
                busy: false,
                error: 'Không dịch được — kiểm tra API Key trong tab Cài đặt.',
              },
        }))
      } catch (err) {
        setEntries((prev) => ({
          ...prev,
          [key]: {
            text: undefined,
            showing: false,
            busy: false,
            error: (err as Error)?.message || 'Lỗi khi gọi LLM để dịch.',
          },
        }))
      } finally {
        inFlight.current.delete(key)
      }
    },
    [entries]
  )

  return { entries, toggle, reset }
}
