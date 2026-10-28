import type {
  GroundingEvidenceInput,
  GroundingClaim,
  GroundingResult,
  GroundingRisk,
  EvidenceIndex,
  StreamingGrounder,
} from './types'
import { getOrCreateEvidenceIndex } from './evidence/index'
import { splitSentences } from './text/sentences'
import { classifyClaimDeterministic } from './classify/deterministic'
import { rewriteAnswer } from './rewrite'

/**
 * Creates an incremental streaming grounder that evaluates complete sentences as tokens arrive.
 * Reuses cached EvidenceIndex to ensure low latency during token streaming.
 */
export function createStreamingGrounder(
  input: GroundingEvidenceInput & {
    signal?: AbortSignal
    onSentenceGround?: (claim: GroundingClaim) => void
    evidenceIndex?: EvidenceIndex
  }
): StreamingGrounder {
  const mode = input.mode || 'balanced'
  const evidenceIndex = input.evidenceIndex || getOrCreateEvidenceIndex(input)
  const evidence = evidenceIndex.evidenceList
  const factSheet = evidenceIndex.factSheet

  let accumulated = ''
  let groundedSentencesCount = 0
  const allClaims: GroundingClaim[] = []
  const allSentences: string[] = []

  return {
    pushDelta: (delta: string): GroundingClaim[] => {
      accumulated += delta
      const sentences = splitSentences(accumulated)
      const newlyGrounded: GroundingClaim[] = []

      while (groundedSentencesCount < sentences.length - 1) {
        const sentenceText = sentences[groundedSentencesCount]
        allSentences.push(sentenceText)
        const classified = classifyClaimDeterministic(sentenceText, evidence, factSheet, mode, evidenceIndex)
        const claim: GroundingClaim = {
          ...classified,
          id: `claim_${allClaims.length + 1}`,
        }
        allClaims.push(claim)
        newlyGrounded.push(claim)
        input.onSentenceGround?.(claim)
        groundedSentencesCount++
      }

      return newlyGrounded
    },

    finalize: (): GroundingResult => {
      const sentences = splitSentences(accumulated)
      while (groundedSentencesCount < sentences.length) {
        const sentenceText = sentences[groundedSentencesCount]
        allSentences.push(sentenceText)
        const classified = classifyClaimDeterministic(sentenceText, evidence, factSheet, mode, evidenceIndex)
        const claim: GroundingClaim = {
          ...classified,
          id: `claim_${allClaims.length + 1}`,
        }
        allClaims.push(claim)
        input.onSentenceGround?.(claim)
        groundedSentencesCount++
      }

      const risky = allClaims.filter(
        (c) =>
          (c.classification === 'UNSUPPORTED' &&
            (c.claimType === 'personal_experience' || c.claimType === 'metric')) ||
          c.classification === 'CONTRADICTED'
      )

      const overallRisk: GroundingRisk =
        risky.length === 0
          ? 'low'
          : risky.some((c) => c.priority === 'high' || c.classification === 'CONTRADICTED')
          ? 'high'
          : 'medium'

      const correctedAnswer = rewriteAnswer(allSentences, allClaims, mode)
      const hasDiscrepancies = overallRisk !== 'low' || risky.length > 0

      return {
        claims: allClaims,
        evidence,
        confidence:
          allClaims.length === 0
            ? 1
            : allClaims.reduce((sum, c) => sum + c.confidence, 0) / allClaims.length,
        overallRisk,
        correctedAnswer,
        originalAnswer: accumulated,
        hasDiscrepancies,
        warning:
          risky.length > 0
            ? `${risky.length} claim cá nhân / số liệu cần được kiểm chứng lại với CV.`
            : undefined,
      }
    },
  }
}
