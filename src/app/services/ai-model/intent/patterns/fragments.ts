/**
 * Checks if a string looks like an incomplete chunk that needs stitching with the next one.
 */
export function isIncompleteSpeechFragment(text: string): boolean {
  if (!text) return false
  const t = text.trim()
  if (!t) return false

  // Trailing ellipsis or dashes or commas
  if (/(?:\.\.\.|…|--|-|,)$/.test(t)) return true

  // Does NOT end with sentence-terminating punctuation (. ! ?)
  if (!/[.!?\u3002\uff01\uff1f]$/.test(t)) {
    // Check if ends with dangling connector or preposition
    const words = t.split(/\s+/)
    const lastWord = (words[words.length - 1] || '').toLowerCase()
    const dangling = [
      'that',
      'how',
      'why',
      'what',
      'if',
      'when',
      'where',
      'about',
      'with',
      'for',
      'and',
      'or',
      'to',
      'is',
      'are',
      'can',
      'could',
      'tell',
      'explain',
      'là',
      'về',
      'với',
      'cho',
      'và',
      'hoặc',
      'thì',
      'nếu',
      'khi',
      'ở',
      'tại',
      'như',
      'giải thích',
      'hỏi',
    ]
    if (dangling.includes(lastWord)) return true
    // Sentences shorter than 4 words without period are likely incomplete
    if (words.length <= 4) return true
  }

  return false
}

export function getAdaptiveDebounceMs(
  text: string,
  configuredMs = 500,
  closeReason?: 'silence' | 'max-length' | 'flush'
): number {
  // When segment closed by natural silence (sentence boundary),
  // speech has completed and waited for SILENCE_END_MS, so debounce can be reduced safely.
  if (closeReason === 'silence') {
    if (isIncompleteSpeechFragment(text)) {
      return Math.max(300, Math.min(configuredMs, 450))
    }
    return Math.max(150, Math.min(configuredMs, 250))
  }

  if (isIncompleteSpeechFragment(text)) return Math.max(700, configuredMs + 200)
  if (text.trim().split(/\s+/).length <= 4) return Math.min(700, configuredMs + 100)
  return Math.max(300, Math.min(700, configuredMs))
}
