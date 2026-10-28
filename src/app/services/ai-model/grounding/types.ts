import type { CandidateFactSheet } from './factSheet'

export type GroundingMode = 'strict' | 'balanced'

export type ClaimClassification = 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'GENERAL_KNOWLEDGE'
export type ClaimType = 'personal_experience' | 'metric' | 'general_technical' | 'opinion_approach'
export type GroundingRisk = 'low' | 'medium' | 'high'

export interface GroundingEvidence {
  id: string
  source: 'cv' | 'profile' | 'jd' | 'transcript' | 'session'
  excerpt: string
  isCandidateSource: boolean
}

export interface GroundingClaim {
  id: string
  text: string
  classification: ClaimClassification
  confidence: number
  evidenceRefs: string[]
  priority: 'high' | 'normal'
  claimType?: ClaimType
  reason?: string
}

export interface GroundingResult {
  claims: GroundingClaim[]
  evidence: GroundingEvidence[]
  confidence: number
  overallRisk: GroundingRisk
  correctedAnswer: string
  originalAnswer?: string
  hasDiscrepancies?: boolean
  warning?: string
  degraded?: boolean
}

export interface EvidenceIndex {
  hash: string
  factSheet: CandidateFactSheet
  candidateEvidenceText: string
  normalizedEvidenceText: string
  candidateTokenSet: Set<string>
  candidateTechEntities: Set<string>
  candidateCompanies: Set<string>
  evidenceList: GroundingEvidence[]
  excerptTokenSets: Map<string, Set<string>>
}

export interface GroundingEvidenceInput {
  cv?: string
  profile?: string
  jobDescription?: string
  transcript?: string
  session?: string
  mode?: GroundingMode
  answer?: string
}

export interface GroundingInput extends GroundingEvidenceInput {
  answer: string
  signal?: AbortSignal
  evidenceIndex?: EvidenceIndex
}

export interface StreamingGrounder {
  pushDelta: (delta: string) => GroundingClaim[]
  finalize: () => GroundingResult
}

export const LLM_JUDGE_TIMEOUT_MS = 2500
export const EXPLICIT_OVERLAP_THRESHOLD = 0.80
export const INFERRED_OVERLAP_THRESHOLD = 0.25
