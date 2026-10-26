/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHISPER PROMPT BUILDER
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts extracted JD keywords into a concise, natural initial_prompt
 * for Whisper (Local Whisper C++ and Cloud Whisper API).
 *
 * Provides specialized vocabulary conditioning so Whisper spells
 * technical terms, frameworks, databases and proper nouns accurately
 * without auditory confusion.
 */

export interface WhisperPromptOptions {
  maxChars?: number
  maxKeywords?: number
  contextType?: 'interview' | 'discussion'
  template?: string
  previousTranscript?: string
  debugMode?: boolean
}

const DEFAULT_MAX_CHARS = 240
const DEFAULT_MAX_KEYWORDS = 20

export class WhisperPromptBuilder {
  /**
   * Builds an initial_prompt string from technical keywords and optional previous transcript sentence.
   *
   * Example output:
   * "Technical interview about React, TypeScript, Kubernetes, AWS. Previous sentence transcript..."
   */
  public buildPrompt(
    keywords: string[],
    options?: WhisperPromptOptions
  ): string {
    try {
      const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS
      const maxKeywords = options?.maxKeywords ?? DEFAULT_MAX_KEYWORDS
      const contextType = options?.contextType ?? 'interview'

      // Filter and sanitize keywords (remove punctuation, trim, ensure valid length)
      const validKeywords = (keywords || [])
        .map((k) => (typeof k === 'string' ? k.trim() : ''))
        .filter((k) => k.length > 0 && k.length <= 40)
        .slice(0, maxKeywords)

      // Base prefix
      const prefix =
        options?.template ??
        (contextType === 'discussion'
          ? 'Technical meeting discussing '
          : 'Technical interview about ')

      let assembled = validKeywords.length > 0 ? prefix : ''
      const includedKeywords: string[] = []

      for (const kw of validKeywords) {
        const separator = includedKeywords.length === 0 ? '' : ', '
        const candidate = `${assembled}${separator}${kw}`

        // Leave buffer for possible previous transcript and closing punctuation
        if (candidate.length + 1 <= maxChars) {
          assembled = candidate
          includedKeywords.push(kw)
        } else {
          break
        }
      }

      let finalPrompt = assembled ? `${assembled}.` : ''

      // Append ~1 previous transcript sentence if provided and space permits
      if (options?.previousTranscript && typeof options.previousTranscript === 'string') {
        const rawPrev = options.previousTranscript.trim()
        if (rawPrev) {
          const sentences = rawPrev.split(/[.?!;\n]+/).map((s) => s.trim()).filter(Boolean)
          const lastSentence = sentences[sentences.length - 1] || rawPrev
          const cleanPrev = lastSentence.replace(/\s+/g, ' ').slice(0, 90).trim()

          if (cleanPrev) {
            const separator = finalPrompt.length > 0 ? ' ' : ''
            const candidateWithContext = `${finalPrompt}${separator}${cleanPrev}.`
            if (candidateWithContext.length <= maxChars) {
              finalPrompt = candidateWithContext
            }
          }
        }
      }

      if (options?.debugMode || process.env.NODE_ENV === 'development') {
        console.debug(
          `[WhisperPromptBuilder] Built initial_prompt (${finalPrompt.length} chars, ${includedKeywords.length} keywords): "${finalPrompt}"`
        )
      }

      return finalPrompt
    } catch (err) {
      console.warn('[WhisperPromptBuilder] Failed to build prompt, falling back to empty:', err)
      return ''
    }
  }
}

export const whisperPromptBuilder = new WhisperPromptBuilder()
