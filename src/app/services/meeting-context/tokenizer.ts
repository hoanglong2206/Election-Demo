/**
 * Estimates token count for English and mixed Vietnamese text.
 * Approximate: 1 token ~= 3.8 to 4 characters.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.trim().length / 3.8)
}
