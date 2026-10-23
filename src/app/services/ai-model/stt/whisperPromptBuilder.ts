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
  debugMode?: boolean
}

const DEFAULT_MAX_CHARS = 220
const DEFAULT_MAX_KEYWORDS = 20

export class WhisperPromptBuilder {
  /**
   * Builds an initial_prompt string from a list of technical keywords.
   *
   * Example output:
   * "Technical interview about React, TypeScript, Kubernetes, AWS, PostgreSQL, Docker."
   */
  public buildPrompt(
    keywords: string[],
    options?: WhisperPromptOptions
  ): string {
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return ''
    }

    try {
      const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS
      const maxKeywords = options?.maxKeywords ?? DEFAULT_MAX_KEYWORDS
      const contextType = options?.contextType ?? 'interview'

      // Filter and sanitize keywords (remove punctuation, trim, ensure valid length)
      const validKeywords = keywords
        .map((k) => (typeof k === 'string' ? k.trim() : ''))
        .filter((k) => k.length > 0 && k.length <= 40)
        .slice(0, maxKeywords)

      if (validKeywords.length === 0) {
        return ''
      }

      // Base prefix
      const prefix =
        options?.template ??
        (contextType === 'discussion'
          ? 'Technical meeting discussing '
          : 'Technical interview about ')

      let assembled = prefix
      const includedKeywords: string[] = []

      for (const kw of validKeywords) {
        const separator = includedKeywords.length === 0 ? '' : ', '
        const candidate = `${assembled}${separator}${kw}`

        // Ensure candidate + closing period does not exceed maxChars
        if (candidate.length + 1 <= maxChars) {
          assembled = candidate
          includedKeywords.push(kw)
        } else {
          break
        }
      }

      if (includedKeywords.length === 0) {
        return ''
      }

      const finalPrompt = `${assembled}.`

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
