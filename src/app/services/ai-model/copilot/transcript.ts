export interface PromptTranscriptLine {
  speaker: string
  original: string
  translated?: string
}

/**
 * Format transcript lines into a compact block for LLM prompts.
 *
 * Both the summary and the suggestion prompts need the *actual* conversation —
 * grounding suggestions on a single trailing fragment is what made them drift
 * off-topic before.
 */
export function formatTranscriptForPrompt(
  lines: PromptTranscriptLine[] | undefined,
  maxLines = 40
): string {
  if (!lines || lines.length === 0) return ''

  const recent = maxLines > 0 ? lines.slice(-maxLines) : lines
  const body = recent
    .map((l) => {
      const vi = l.translated && l.translated !== l.original ? ` | ${l.translated}` : ''
      return `${l.speaker}: ${l.original}${vi}`
    })
    .join('\n')

  const omitted = lines.length - recent.length
  return omitted > 0 ? `(... ${omitted} câu trước đó đã lược bớt)\n${body}` : body
}
