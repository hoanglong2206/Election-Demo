export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%+#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Basic English suffix stemmer for token matching.
 */
export function stem(word: string): string {
  return word.replace(/(?:ing|edly|ed|es|s|ment|tion|tions)$/g, '')
}
