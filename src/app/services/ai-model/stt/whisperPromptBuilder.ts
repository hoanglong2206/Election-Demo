/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHISPER PROMPT BUILDER
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts extracted JD keywords and technical Vietglish lexicon into a concise,
 * natural initial_prompt for Whisper (Local Whisper C++ and Cloud Whisper API).
 *
 * Provides specialized vocabulary conditioning so Whisper spells
 * technical terms, frameworks, databases and proper nouns accurately
 * without auditory confusion during bilingual Vietnamese/English interviews.
 */

import {
  CORE_TECHNICAL_LEXICON,
  TECHNICAL_VIETGLISH_BASE_PROMPT,
} from './technicalLexicon'

export interface WhisperPromptOptions {
  maxChars?: number
  maxKeywords?: number
  contextType?: 'interview' | 'discussion'
  template?: string
  previousTranscript?: string
  debugMode?: boolean
  language?: string
  includeDefaultLexicon?: boolean
}

const DEFAULT_MAX_CHARS = 240
const DEFAULT_MAX_KEYWORDS = 20

export class WhisperPromptBuilder {
  /**
   * Builds an initial_prompt string from technical keywords and optional previous transcript sentence.
   *
   * Example output:
   * "Phỏng vấn kỹ thuật CNTT: React, TypeScript, Docker, Kubernetes, Redis, Kafka. Câu trước đó..."
   */
  public buildPrompt(
    keywords: string[] = [],
    options?: WhisperPromptOptions
  ): string {
    try {
      const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS
      const maxKeywords = options?.maxKeywords ?? DEFAULT_MAX_KEYWORDS
      const contextType = options?.contextType ?? 'interview'
      const language = options?.language ?? 'vi'
      const includeDefaultLexicon = options?.includeDefaultLexicon ?? true

      // Combine user/JD keywords with core technical lexicon (deduplicated)
      const combined = new Set<string>()

      // 1. User / JD keywords get top priority
      for (const k of keywords || []) {
        if (typeof k === 'string') {
          const trimmed = k.trim()
          if (trimmed.length > 0 && trimmed.length <= 40) {
            combined.add(trimmed)
          }
        }
      }

      // 2. Supplement with core technical lexicon for code-switching priming
      if (includeDefaultLexicon) {
        for (const term of CORE_TECHNICAL_LEXICON) {
          if (combined.size >= maxKeywords) break
          combined.add(term)
        }
      }

      const validKeywords = Array.from(combined).slice(0, maxKeywords)

      // Base prefix adapted for bilingual technical discussions
      let prefix = options?.template
      if (!prefix) {
        const isVietnamese = language === 'vi' || language === 'auto'
        if (isVietnamese) {
          prefix =
            contextType === 'discussion'
              ? 'Hội thảo kỹ thuật CNTT: '
              : 'Phỏng vấn kỹ thuật CNTT: '
        } else {
          prefix =
            contextType === 'discussion'
              ? 'Technical meeting discussing '
              : 'Technical interview about '
        }
      }

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

      // Fallback to base prompt if no keywords could be assembled
      if (!finalPrompt.trim()) {
        finalPrompt = TECHNICAL_VIETGLISH_BASE_PROMPT.slice(0, maxChars)
      }

      // Append ~1 previous transcript sentence if provided and space permits
      if (options?.previousTranscript && typeof options.previousTranscript === 'string') {
        const rawPrev = options.previousTranscript.trim()
        if (rawPrev) {
          const sentences = rawPrev.split(/[.?!;\n]+/).map((s) => s.trim()).filter(Boolean)
          const lastSentence = sentences[sentences.length - 1] || rawPrev
          const cleanPrev = lastSentence.replace(/\s+/g, ' ').slice(0, 70).trim()

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
      return TECHNICAL_VIETGLISH_BASE_PROMPT.slice(0, DEFAULT_MAX_CHARS)
    }
  }
}

export const whisperPromptBuilder = new WhisperPromptBuilder()
