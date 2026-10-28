import { tokens, STOP_WORDS } from '../text/tokens'
import { expandTokensWithAliases } from '../evidence/aliases'

export const NEGATION_PATTERN = /(?<!\p{L})(?:not|never|didn't|did not|was not|wasn't|cannot|can't|không|chưa|chưa từng|chưa bao giờ|không có|không phải)(?!\p{L})/iu

/**
 * Scans candidate evidence for negation of the claim's core predicates or keywords.
 */
export function checkNegationContradiction(
  claim: string,
  candidateEvidence: string
): { hasContradiction: boolean; reason?: string } {
  if (!NEGATION_PATTERN.test(candidateEvidence)) {
    return { hasContradiction: false }
  }

  const claimTokens = tokens(claim)
  if (claimTokens.length === 0) return { hasContradiction: false }

  const expandedClaimTokens = expandTokensWithAliases(claimTokens)
  const evidenceSentences = candidateEvidence.split(/(?<=[.!?。！？\n])\s+/u)

  for (const sentence of evidenceSentences) {
    if (!NEGATION_PATTERN.test(sentence)) continue

    const words = sentence.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const cleanWord = words[i].replace(/[^\p{L}\p{N}]+/gu, '')
      if (NEGATION_PATTERN.test(cleanWord)) {
        const windowWords = words.slice(i + 1, i + 6).map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ''))
        const windowTokens = windowWords.filter((w) => w && !STOP_WORDS.has(w))
        const expandedWindowTokens = expandTokensWithAliases(windowTokens)

        const negatedClaimTokens = Array.from(expandedClaimTokens).filter((ct) => expandedWindowTokens.has(ct))
        if (
          negatedClaimTokens.length >= 2 ||
          (negatedClaimTokens.length >= 1 &&
            ['lead', 'led', 'manage', 'managed', 'quản lý', 'team', 'đội', 'build', 'built'].some((k) =>
              negatedClaimTokens.includes(k)
            ))
        ) {
          return {
            hasContradiction: true,
            reason: `Phát hiện phủ định trực tiếp trong hồ sơ: "${sentence.trim()}" mâu thuẫn với nội dung câu trả lời.`,
          }
        }
      }
    }
  }

  return { hasContradiction: false }
}
