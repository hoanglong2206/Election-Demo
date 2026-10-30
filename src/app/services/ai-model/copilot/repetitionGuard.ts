/**
 * Repetition Guard & Content Shortener
 *
 * 1. Detects LLM degenerate repetition loops (n-gram repeats, substring repeats,
 *    and prompt instruction echoing).
 * 2. Prunes repetitive tails from degenerate outputs to preserve the valid first portion.
 * 3. Smart content shortener for bilingual suggestions (English & Vietnamese),
 *    handling bullet points, multi-sentence structures, and clause-level boundaries.
 */

const PROMPT_ECHO_PATTERNS = [
  /mỗi\s+CONTENT\s+là\s+một\s+câu\s+trả\s+lời/i,
  /định\s+dạng\s+ở\s+trên/i,
  /nhãn\s+ngắn\s+gọn\s+4-8\s+từ/i,
  /nội\s+dung\s+đầy\s+đủ\s+viết\s+liền\s+trên\s+một\s+dòng/i,
  /LABEL:\s*nhãn\s+ngắn\s+gọn/i,
]

/**
 * Checks whether the text has fallen into an autoregressive degeneration loop
 * or echoed instructions from the system prompt.
 */
export function hasRepetitiveDegeneration(text: string): boolean {
  if (!text || text.length < 25) return false

  // 1. Direct prompt instruction echoing
  for (const pattern of PROMPT_ECHO_PATTERNS) {
    if (pattern.test(text)) return true
  }

  // 2. Tokenize words (unicode letters and numbers)
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length < 6) return false

  // 3. Consecutive n-gram loops (phrases of 2-15 words repeating >= 3 times)
  const maxN = Math.min(15, Math.floor(words.length / 3))
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n * 3; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      const second = words.slice(i + n, i + 2 * n).join(' ')
      const third = words.slice(i + 2 * n, i + 3 * n).join(' ')
      if (phrase === second && phrase === third) {
        return true
      }
    }
  }

  // 4. Repeated long substring search (>= 22 chars appearing >= 3 times)
  const lower = text.toLowerCase()
  for (let len = 25; len <= 80; len += 10) {
    if (lower.length < len * 3) break
    for (let i = 0; i <= lower.length - len * 3; i += 15) {
      const sub = lower.slice(i, i + len).trim()
      if (sub.length < 20) continue
      let count = 0
      let pos = 0
      while ((pos = lower.indexOf(sub, pos)) !== -1) {
        count++
        pos += sub.length
        if (count >= 3) return true
      }
    }
  }

  return false
}

/**
 * Finds the character offset in original text for the N-th word.
 */
function findWordCharIndex(text: string, wordIdx: number): number {
  const re = /[\p{L}\p{N}]+/gu
  let m: RegExpExecArray | null
  let count = 0
  while ((m = re.exec(text)) !== null) {
    if (count === wordIdx) {
      return m.index
    }
    count++
  }
  return -1
}

/**
 * Prunes the repetitive tail from a string if degeneration occurred.
 * Returns the valid initial portion, or the original text if no loop is detected.
 */
export function pruneRepetitiveTail(text: string): string {
  if (!hasRepetitiveDegeneration(text)) return text

  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  // 2. If consecutive n-gram loop detected, cut at the second repeat onset
  const maxN = Math.min(15, Math.floor(words.length / 3))
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n * 3; i++) {
      const phrase = words.slice(i, i + n).join(' ')
      const second = words.slice(i + n, i + 2 * n).join(' ')
      const third = words.slice(i + 2 * n, i + 3 * n).join(' ')
      if (phrase === second && phrase === third) {
        const cutCharIdx = findWordCharIndex(text, i + n)
        if (cutCharIdx > 15) {
          const preserved = text.slice(0, cutCharIdx).trim().replace(/[,;:\-\s]+$/, '')
          return preserved.endsWith('.') ? preserved : `${preserved}.`
        }
      }
    }
  }

  // 3. Repeated long substring search (>= 25 chars appearing >= 3 times)
  const lower = text.toLowerCase()
  for (let len = 40; len >= 25; len -= 5) {
    if (lower.length < len * 3) continue
    for (let i = 0; i <= lower.length - len * 2; i += 10) {
      const sub = lower.slice(i, i + len).trim()
      if (sub.length < 20) continue
      const firstPos = lower.indexOf(sub)
      if (firstPos === -1) continue
      const secondPos = lower.indexOf(sub, firstPos + sub.length)
      if (secondPos !== -1) {
        const thirdPos = lower.indexOf(sub, secondPos + sub.length)
        if (thirdPos !== -1) {
          // Cut at secondPos or before sentence delimiter near secondPos
          const cutIdx = secondPos
          if (cutIdx > 20) {
            const preserved = text.slice(0, cutIdx).trim().replace(/[,;:\-\s]+$/, '')
            return preserved.endsWith('.') ? preserved : `${preserved}.`
          }
        }
      }
    }
  }

  // If prompt echo was detected, truncate before the echo pattern if possible
  for (const pattern of PROMPT_ECHO_PATTERNS) {
    const match = text.match(pattern)
    if (match && match.index !== undefined && match.index > 15) {
      const preserved = text.slice(0, match.index).trim().replace(/[,;:\-\s]+$/, '')
      return preserved.endsWith('.') ? preserved : `${preserved}.`
    }
  }

  return text
}

/**
 * Smart content shortener for Copilot suggestions in both Interview and Discussion modes.
 *
 * Supports English and Vietnamese:
 * - Bullets: returns top 1-2 items.
 * - Multi-sentence: returns top 1-2 core sentences.
 * - Single long sentence: splits cleanly at primary clause marker
 *   (e.g., ", cho thấy ", ", bởi vì ", ", indicating ", ", as it ")
 *   to present a punchy key takeaway.
 */
export function shortenContent(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= 80) return trimmed

  // 1. Multi-line (bullets or numbered items)
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length > 1) {
    const topLines = lines.slice(0, 2).join('\n')
    if (topLines.length < trimmed.length) return topLines
  }

  // 2. Multi-sentence: split on sentence boundaries (. ! ?) without breaking on decimals/versions
  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z\p{Lu}\d])/u)
    .map((s) => s.trim())
    .filter(Boolean)

  if (sentences.length > 1) {
    const firstSentence = sentences[0]
    if (firstSentence.length >= 40) {
      return firstSentence
    }
    return `${sentences[0]} ${sentences[1]}`
  }

  // 3. Single long sentence (> 80 chars): split at major clause boundary
  const clauseRegex =
    /,\s*(?:cho thấy|bởi vì|do đó|nhằm|dẫn đến|khiến|giúp|với mục đích|từ đó|qua đó|indicating|which|as it|because|so that|in order to|meaning|highlighting)\b|;\s*/i
  const match = trimmed.match(clauseRegex)
  if (match && match.index !== undefined && match.index >= 35) {
    const clause = trimmed.slice(0, match.index).trim()
    return clause.endsWith('.') ? clause : `${clause}.`
  }

  // 4. Fallback: clean cut at word boundary near 100 chars
  if (trimmed.length > 110) {
    const cut = trimmed.slice(0, 100)
    const lastSpace = cut.lastIndexOf(' ')
    if (lastSpace > 50) {
      return cut.slice(0, lastSpace).trim() + '...'
    }
  }

  return trimmed
}
