/**
 * Robust sentence splitter that preserves abbreviations and markdown bullets.
 */
export function splitSentences(answer: string): string[] {
  if (!answer || !answer.trim()) return []

  const lines = answer.split('\n')
  const results: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^[-*•]\s+|^\d+\.\s+/.test(line)) {
      const cleanLine = line.replace(/^[-*•]\s+|^\d+\.\s+/, '').trim()
      if (cleanLine) results.push(cleanLine)
      continue
    }

    const sentenceRegex = /(?<!\b(?:e\.g|i\.e|etc|vs|v|mr|ms|dr|node|vue|next|nuxt|nest))\s*(?<=[.!?。！？])\s+(?=[A-Z\p{Lu}\d"'-])/gu
    const parts = line.split(sentenceRegex).map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) {
      results.push(...parts)
    } else {
      results.push(line)
    }
  }

  return results
}
