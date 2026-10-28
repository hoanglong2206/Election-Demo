/**
 * Heuristic BPE token estimator tailored for English, Code, and Vietnamese Unicode.
 * - ASCII chars: ~3.8-4 chars per token.
 * - Non-ASCII (Vietnamese diacritics/CJK): ~1.8-2 chars per token.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  let asciiCount = 0
  let nonAsciiCount = 0

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 128) {
      asciiCount++
    } else {
      nonAsciiCount++
    }
  }

  const tokens = Math.ceil(asciiCount / 4) + Math.ceil(nonAsciiCount / 2)
  return Math.max(1, tokens)
}

/**
 * Truncates text cleanly at word boundaries to fit within a target token count.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false }
  const currentTokens = estimateTokenCount(text)
  if (currentTokens <= maxTokens) return { text, truncated: false }

  // Suffix overhead reserved (~5 tokens)
  const safeTargetTokens = Math.max(5, maxTokens - 5)
  const ratio = safeTargetTokens / currentTokens
  const targetChars = Math.floor(text.length * ratio)
  let sliced = text.slice(0, targetChars)

  // Align to last word boundary
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace > targetChars * 0.7) {
    sliced = sliced.slice(0, lastSpace)
  }

  return { text: sliced.trim() + ' ... (đã lược bớt)', truncated: true }
}

/** Remove ```json ... ``` style code fences that models like to add. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim()
}
