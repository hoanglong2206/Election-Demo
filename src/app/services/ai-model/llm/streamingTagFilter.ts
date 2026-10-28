/**
 * Stateful streaming tag filter to remove thinking/reasoning tags from LLM responses in real-time.
 * Handles tags that are split across multiple streaming chunks (e.g., "<th" + "ink>...").
 * Preserves normal characters like '<' or '>' when they are not part of reasoning tags.
 * Safe for UTF-8 and Vietnamese characters.
 */

const TARGET_TAG_NAMES = ['think', 'thought', 'reasoning']

export interface StreamingTagFilter {
  /**
   * Process an incoming stream chunk and return only the user-visible text.
   */
  process(chunk: string): string

  /**
   * Flush any remaining buffered characters at the end of the stream.
   */
  flush(): string

  /**
   * Reset filter state for a new stream.
   */
  reset(): void
}

export function createStreamingTagFilter(): StreamingTagFilter {
  let insideTag: string | null = null
  let pendingBuffer = ''

  // All possible opening and closing tag names
  const openingTags = TARGET_TAG_NAMES.map((t) => `<${t}>`)
  const closingTags = TARGET_TAG_NAMES.map((t) => `</${t}>`)

  // Max length of any potential tag prefix we might need to hold in pendingBuffer
  const MAX_TAG_LEN = Math.max(...closingTags.map((t) => t.length)) // e.g. "</reasoning>" = 12

  const isPrefixOfAny = (str: string, tags: string[]): boolean => {
    const lower = str.toLowerCase()
    return tags.some((t) => t.startsWith(lower))
  }

  const reset = () => {
    insideTag = null
    pendingBuffer = ''
  }

  const process = (chunk: string): string => {
    if (!chunk) return ''
    let text = pendingBuffer + chunk
    pendingBuffer = ''
    let output = ''

    let i = 0
    while (i < text.length) {
      if (insideTag) {
        // We are currently suppressing tokens until we see the matching closing tag
        const closingTag = `</${insideTag}>`
        const closeIdx = text.toLowerCase().indexOf(closingTag, i)

        if (closeIdx !== -1) {
          // Found closing tag
          i = closeIdx + closingTag.length
          insideTag = null
        } else {
          // Closing tag not found in this chunk.
          // Check if the tail of `text` could be a partial prefix of `closingTag`
          const remaining = text.slice(i)
          let matchedPrefixLen = 0
          for (let len = Math.min(remaining.length, closingTag.length - 1); len >= 1; len--) {
            const tail = remaining.slice(-len).toLowerCase()
            if (closingTag.startsWith(tail)) {
              matchedPrefixLen = len
              break
            }
          }

          if (matchedPrefixLen > 0) {
            // Keep the partial prefix in pendingBuffer in case it completes in the next chunk
            pendingBuffer = remaining.slice(-matchedPrefixLen)
          }
          // The rest of this chunk is consumed (ignored)
          break
        }
      } else {
        // Normal mode: looking for opening tags
        const nextLtIdx = text.indexOf('<', i)
        if (nextLtIdx === -1) {
          // No '<' in the rest of the text, safe to output everything
          output += text.slice(i)
          break
        }

        // Output everything before '<'
        output += text.slice(i, nextLtIdx)
        i = nextLtIdx

        const remaining = text.slice(i)
        let matchedTag: string | null = null

        // Check if remaining starts with any full opening tag
        for (const tag of TARGET_TAG_NAMES) {
          const openTag = `<${tag}>`
          if (remaining.toLowerCase().startsWith(openTag)) {
            matchedTag = tag
            i += openTag.length
            insideTag = tag
            break
          }
        }

        if (matchedTag) {
          // Matched an opening tag, will continue loop in insideTag mode
          continue
        }

        // Not a full opening tag. Could it be a partial prefix of any opening tag?
        if (remaining.length < MAX_TAG_LEN && isPrefixOfAny(remaining, openingTags)) {
          // Hold this partial candidate in buffer and wait for next chunk
          pendingBuffer = remaining
          break
        }

        // It is not a reasoning tag (e.g. "<div", "< 5", "<-").
        // Output '<' and proceed to next char
        output += text[i]
        i += 1
      }
    }

    return output
  }

  const flush = (): string => {
    let result = ''
    if (!insideTag && pendingBuffer) {
      result = pendingBuffer
    }
    reset()
    return result
  }

  return {
    process,
    flush,
    reset,
  }
}
