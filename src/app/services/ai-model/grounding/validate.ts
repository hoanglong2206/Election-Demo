import type { GroundingInput, GroundingResult, GroundingClaim, GroundingRisk } from './types'
import { getOrCreateEvidenceIndex } from './evidence/index'
import { splitSentences } from './text/sentences'
import { classifyClaimDeterministic } from './classify/deterministic'
import { rewriteAnswer } from './rewrite'

/**
 * Validates answer grounding synchronously using Layer 0 FactSheet and Layer 1 Deterministic Engine.
 * Reuses precomputed EvidenceIndex to achieve < 20ms response time on 15k char CV.
 */
export function validateAnswerGrounding(input: GroundingInput): GroundingResult {
  const mode = input.mode || 'balanced'
  const evidenceIndex = input.evidenceIndex || getOrCreateEvidenceIndex(input)
  const evidence = evidenceIndex.evidenceList
  const factSheet = evidenceIndex.factSheet
  const sentences = splitSentences(input.answer)

  const claims: GroundingClaim[] = sentences.map((text, index) => {
    const classified = classifyClaimDeterministic(text, evidence, factSheet, mode, evidenceIndex)
    return {
      ...classified,
      id: `claim_${index + 1}`,
    }
  })

  const risky = claims.filter(
    (c) =>
      (c.classification === 'UNSUPPORTED' && (c.claimType === 'personal_experience' || c.claimType === 'metric')) ||
      c.classification === 'CONTRADICTED'
  )

  const overallRisk: GroundingRisk =
    risky.length === 0 ? 'low' : risky.some((c) => c.priority === 'high' || c.classification === 'CONTRADICTED') ? 'high' : 'medium'

  const correctedAnswer = rewriteAnswer(sentences, claims, mode)
  const hasDiscrepancies = overallRisk !== 'low' || risky.length > 0

  return {
    claims,
    evidence,
    confidence:
      claims.length === 0 ? 1 : claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length,
    overallRisk,
    correctedAnswer,
    originalAnswer: input.answer,
    hasDiscrepancies,
    warning:
      risky.length > 0
        ? `${risky.length} claim cá nhân / số liệu cần được kiểm chứng lại với CV.`
        : undefined,
  }
}
