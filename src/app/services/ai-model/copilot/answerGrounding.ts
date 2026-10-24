export type GroundingMode = 'strict' | 'balanced'
export type ClaimClassification = 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED'
export type GroundingRisk = 'low' | 'medium' | 'high'

export interface GroundingEvidence {
  id: string
  source: 'cv' | 'profile' | 'jd' | 'transcript' | 'session'
  excerpt: string
}

export interface GroundingClaim {
  id: string
  text: string
  classification: ClaimClassification
  confidence: number
  evidenceRefs: string[]
  priority: 'high' | 'normal'
}

export interface GroundingResult {
  claims: GroundingClaim[]
  evidence: GroundingEvidence[]
  confidence: number
  overallRisk: GroundingRisk
  correctedAnswer: string
  warning?: string
}

export interface GroundingInput {
  answer: string
  cv?: string
  profile?: string
  jobDescription?: string
  transcript?: string
  session?: string
  mode?: GroundingMode
}

const PERSONAL_PATTERN = /\b(?:i|i've|i have|i led|i built|i worked|i managed|my|we|tôi|tôi đã|mình|chúng tôi|em đã|anh đã|chị đã)\b/i
const HIGH_PRIORITY_PATTERN = /\b(?:\d+(?:\.\d+)?%?|\d+\+?|years?|năm|people|members?|engineers?|thành viên|team|đội|company|công ty|production|prod|scale|million|million|triệu|lead|led|senior|junior|manager|developer|engineer)\b/i
const STOP_WORDS = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'have', 'đã', 'và', 'có', 'là', 'cho', 'trong', 'một'])

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}%+#]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function splitSentences(answer: string): string[] {
  return answer.split(/(?<=[.!?。！？])\s+|\n+/).map((part) => part.trim()).filter(Boolean)
}

function buildEvidence(input: GroundingInput): GroundingEvidence[] {
  const sources: Array<[GroundingEvidence['source'], string | undefined]> = [
    ['cv', input.cv],
    ['profile', input.profile],
    ['jd', input.jobDescription],
    ['transcript', input.transcript],
    ['session', input.session],
  ]
  return sources.flatMap(([source, text]) => text?.trim() ? [{
    id: `evidence_${source}`,
    source,
    excerpt: text.trim().slice(0, 4000),
  }] : [])
}

function overlapScore(claim: string, evidence: string): number {
  const claimTokens = new Set(tokens(claim))
  if (claimTokens.size === 0) return 0
  const matched = tokens(evidence).filter((token) => claimTokens.has(token))
  return new Set(matched).size / claimTokens.size
}

function hasExplicitMatch(claim: string, evidence: string): boolean {
  const claimNormalized = normalize(claim)
  const evidenceNormalized = normalize(evidence)
  if (claimNormalized.length >= 12 && evidenceNormalized.includes(claimNormalized)) return true
  return overlapScore(claim, evidence) >= (HIGH_PRIORITY_PATTERN.test(claim) ? 0.6 : 0.75)
}

function hasContradiction(claim: string, evidence: string): boolean {
  const claimTokens = tokens(claim)
  const evidenceNormalized = normalize(evidence)
  if (!/(?:not|never|didn't|did not|không|chưa|chưa từng)/i.test(evidence)) return false
  return claimTokens.some((token) => evidenceNormalized.includes(`not ${token}`) || evidenceNormalized.includes(`không ${token}`)) ||
    overlapScore(claim, evidence) >= 0.25
}

function classifyClaim(
  claim: string,
  evidence: GroundingEvidence[],
  mode: GroundingMode,
): { classification: ClaimClassification; confidence: number; evidenceRefs: string[] } {
  const relevant = evidence.filter((item) => overlapScore(claim, item.excerpt) >= 0.25)
  const explicit = evidence.filter((item) => hasExplicitMatch(claim, item.excerpt))
  const contradicted = evidence.filter((item) => hasContradiction(claim, item.excerpt))
  if (contradicted.length > 0) {
    return { classification: 'CONTRADICTED', confidence: 0.92, evidenceRefs: contradicted.map((item) => item.id) }
  }
  if (explicit.length > 0) {
    return { classification: 'SUPPORTED', confidence: 0.9, evidenceRefs: explicit.map((item) => item.id) }
  }
  if (relevant.length > 0 && (!PERSONAL_PATTERN.test(claim) || mode === 'balanced')) {
    return { classification: 'INFERRED', confidence: 0.62, evidenceRefs: relevant.map((item) => item.id) }
  }
  return { classification: 'UNSUPPORTED', confidence: 0.88, evidenceRefs: [] }
}

function rewriteAnswer(sentences: string[], claims: GroundingClaim[], mode: GroundingMode): string {
  const kept = sentences.filter((sentence, index) => {
    const claim = claims[index]
    if (!claim) return true
    if (claim.classification === 'CONTRADICTED') return false
    if (claim.classification === 'UNSUPPORTED' && (mode === 'strict' || PERSONAL_PATTERN.test(sentence))) return false
    return true
  })
  if (kept.length > 0) return kept.join(' ')
  return 'I can explain the approach, but I would confirm the specific personal experience and metrics before stating them.'
}

export function validateAnswerGrounding(input: GroundingInput): GroundingResult {
  const mode = input.mode || 'balanced'
  const evidence = buildEvidence(input)
  const sentences = splitSentences(input.answer)
  const claims: GroundingClaim[] = sentences.map((text, index) => {
    const result = classifyClaim(text, evidence, mode)
    return {
      id: `claim_${index + 1}`,
      text,
      ...result,
      priority: HIGH_PRIORITY_PATTERN.test(text) || PERSONAL_PATTERN.test(text) ? 'high' : 'normal',
    }
  })
  const risky = claims.filter((claim) => claim.classification === 'UNSUPPORTED' || claim.classification === 'CONTRADICTED')
  const overallRisk: GroundingRisk = risky.length === 0 ? 'low' : risky.some((claim) => claim.priority === 'high') ? 'high' : 'medium'
  const correctedAnswer = rewriteAnswer(sentences, claims, mode)
  return {
    claims,
    evidence,
    confidence: claims.length === 0 ? 1 : claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length,
    overallRisk,
    correctedAnswer,
    warning: risky.length > 0 ? `${risky.length} claim(s) need verification before presenting as personal experience.` : undefined,
  }
}
