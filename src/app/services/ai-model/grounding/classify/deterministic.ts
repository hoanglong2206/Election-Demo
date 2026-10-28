import type { GroundingClaim, GroundingEvidence, GroundingMode, EvidenceIndex } from '../types'
import { EXPLICIT_OVERLAP_THRESHOLD, INFERRED_OVERLAP_THRESHOLD } from '../types'
import type { CandidateFactSheet } from '../factSheet'
import { normalize } from '../text/normalize'
import {
  extractTechEntitiesFromText,
  normalizeTechEntity,
  overlapScoreWithTokenSet,
  overlapScore,
} from '../evidence/aliases'
import { getOrCreateEvidenceIndex } from '../evidence/index'
import { checkDirectedRelationContradiction } from '../checks/relations'
import { checkMetricContradiction } from '../checks/metrics'
import { checkNegationContradiction } from '../checks/negation'
import { classifyClaimType } from './claimType'

export interface ParsedClaimEntities {
  entities: string[]
  contrastAdopted: string[]
  contrastReplaced: string[]
}

/**
 * Parses tech entities and contrastive relationships from a claim.
 * Handles "used X instead of Y", "replaced Y with X", "chuyển từ Y sang X", etc.
 */
export function parseClaimTechEntities(claim: string): ParsedClaimEntities {
  const contrastAdopted: string[] = []
  const contrastReplaced: string[] = []

  const cleanEntity = (str: string) =>
    str.toLowerCase().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim()

  // 1. "used X instead of Y" / "dùng X thay vì Y"
  const insteadRegex = /(?:used?|use|chọn|dùng|sử dụng)\s+([\p{L}\p{N}.-]+)\s+(?:instead of|rather than|thay vì|thay cho)\s+([\p{L}\p{N}.-]+)/giu
  let m: RegExpExecArray | null
  while ((m = insteadRegex.exec(claim)) !== null) {
    const x = cleanEntity(m[1])
    const y = cleanEntity(m[2])
    if (x) contrastAdopted.push(x)
    if (y) contrastReplaced.push(y)
  }

  // 2. "replaced Y with X" / "thay thế Y bằng X"
  const replaceRegex = /(?:replaced?|replace|thay thế|thay)\s+([\p{L}\p{N}.-]+)\s+(?:with|by|bằng)\s+([\p{L}\p{N}.-]+)/giu
  while ((m = replaceRegex.exec(claim)) !== null) {
    const y = cleanEntity(m[1])
    const x = cleanEntity(m[2])
    if (x) contrastAdopted.push(x)
    if (y) contrastReplaced.push(y)
  }

  // 3. "chuyển từ Y sang X" / "migrated from Y to X"
  const migrateRegex = /(?:migrat(?:e|ed|ing)?|chuyển|chuyển đổi|move[d]?)\s+[\s\S]*?\b(?:from|từ)\s+([\p{L}\p{N}.-]+)\s+(?:to|into|sang|qua)\s+([\p{L}\p{N}.-]+)/giu
  while ((m = migrateRegex.exec(claim)) !== null) {
    const y = cleanEntity(m[1])
    const x = cleanEntity(m[2])
    if (x) contrastAdopted.push(x)
    if (y) contrastReplaced.push(y)
  }

  // Extract all entities in claim
  const allExtracted = Array.from(extractTechEntitiesFromText(claim))

  return {
    entities: allExtracted,
    contrastAdopted,
    contrastReplaced,
  }
}

/**
 * Deterministic classifier evaluating claims against FactSheet and EvidenceIndex (Tier 1).
 */
export function classifyClaimDeterministic(
  claimText: string,
  evidence: GroundingEvidence[],
  factSheet: CandidateFactSheet,
  mode: GroundingMode,
  evidenceIndex?: EvidenceIndex
): GroundingClaim {
  const index =
    evidenceIndex ||
    getOrCreateEvidenceIndex({
      cv: evidence.find((e) => e.source === 'cv')?.excerpt,
      profile: evidence.find((e) => e.source === 'profile')?.excerpt,
      jobDescription: evidence.find((e) => e.source === 'jd')?.excerpt,
      transcript: evidence.find((e) => e.source === 'transcript')?.excerpt,
      session: evidence.find((e) => e.source === 'session')?.excerpt,
    })

  const claimType = classifyClaimType(claimText, index)

  // 1. General technical knowledge does not need candidate CV proof
  if (claimType === 'general_technical' || claimType === 'opinion_approach') {
    return {
      id: '',
      text: claimText,
      classification: 'GENERAL_KNOWLEDGE',
      confidence: 0.95,
      evidenceRefs: [],
      priority: 'normal',
      claimType,
      reason: 'Kiến thức kỹ thuật chung hoặc quan điểm tiếp cận; không bắt buộc phải có trong CV cá nhân.',
    }
  }

  // 2. Personal and metric claims MUST be grounded by candidate-owned evidence
  const personalEvidences = evidence.filter((e) => e.isCandidateSource)
  const combinedPersonalText = index.candidateEvidenceText || personalEvidences.map((e) => e.excerpt).join('\n')

  // Check explicit exact match first
  const normClaim = normalize(claimText)
  const normEvidence = index.normalizedEvidenceText || normalize(combinedPersonalText)
  if (normClaim.length >= 10 && normEvidence.includes(normClaim)) {
    return {
      id: '',
      text: claimText,
      classification: 'SUPPORTED',
      confidence: 0.95,
      evidenceRefs: personalEvidences.map((e) => e.id),
      priority: claimType === 'metric' ? 'high' : 'normal',
      claimType,
      reason: 'Khớp tường minh với văn bản trong hồ sơ CV.',
    }
  }

  // 3. Contradiction Checks (Directed relation, Metric contradiction, Negation)
  // Contradictions are severe discrepancies that must take precedence over ungrounded/overlap checks.
  const relationCheck = checkDirectedRelationContradiction(claimText, factSheet)
  if (relationCheck.hasContradiction) {
    return {
      id: '',
      text: claimText,
      classification: 'CONTRADICTED',
      confidence: 0.95,
      evidenceRefs: personalEvidences.map((e) => e.id),
      priority: 'high',
      claimType,
      reason: relationCheck.reason,
    }
  }

  const metricCheck = checkMetricContradiction(claimText, factSheet)
  if (metricCheck.hasContradiction) {
    return {
      id: '',
      text: claimText,
      classification: 'CONTRADICTED',
      confidence: 0.94,
      evidenceRefs: personalEvidences.map((e) => e.id),
      priority: 'high',
      claimType,
      reason: metricCheck.reason,
    }
  }

  const negationCheck = checkNegationContradiction(claimText, combinedPersonalText)
  if (negationCheck.hasContradiction) {
    return {
      id: '',
      text: claimText,
      classification: 'CONTRADICTED',
      confidence: 0.92,
      evidenceRefs: personalEvidences.map((e) => e.id),
      priority: 'high',
      claimType,
      reason: negationCheck.reason,
    }
  }

  // 4. Tech Entity Verification (Requirement 2)
  // For personal experience or metric claims: every technology entity must exist in candidate's techStack/projects.
  // Missing any entity -> UNSUPPORTED regardless of word overlap score.
  const { entities, contrastAdopted, contrastReplaced } = parseClaimTechEntities(claimText)

  for (const tech of contrastAdopted) {
    const normTech = normalizeTechEntity(tech)
    if (!index.candidateTechEntities.has(tech) && !index.candidateTechEntities.has(normTech)) {
      return {
        id: '',
        text: claimText,
        classification: 'UNSUPPORTED',
        confidence: 0.95,
        evidenceRefs: [],
        priority: 'high',
        claimType,
        reason: `Công nghệ '${tech}' (được khẳng định sử dụng) không có trong hồ sơ kinh nghiệm của ứng viên.`,
      }
    }
  }

  if (entities.length > 0) {
    for (const tech of entities) {
      if (contrastReplaced.includes(tech)) {
        continue
      }
      const normTech = normalizeTechEntity(tech)
      if (!index.candidateTechEntities.has(tech) && !index.candidateTechEntities.has(normTech)) {
        return {
          id: '',
          text: claimText,
          classification: 'UNSUPPORTED',
          confidence: 0.93,
          evidenceRefs: [],
          priority: 'high',
          claimType,
          reason: `Công nghệ '${tech}' không có trong danh mục kỹ năng hoặc dự án hồ sơ của ứng viên.`,
        }
      }
    }
  }

  // 5. Metric Ungrounded Check
  if (claimType === 'metric' && metricCheck.isUngrounded) {
    return {
      id: '',
      text: claimText,
      classification: 'UNSUPPORTED',
      confidence: 0.90,
      evidenceRefs: [],
      priority: 'high',
      claimType,
      reason: 'Số liệu không tìm thấy bằng chứng đối chiếu trong hồ sơ ứng viên.',
    }
  }

  // 6. Fast Overlap Score with precomputed token set
  const score = overlapScoreWithTokenSet(claimText, index.candidateTokenSet)

  const matchingRefs: string[] = []
  for (const e of personalEvidences) {
    const excerptSet = index.excerptTokenSets.get(e.id)
    const eScore = excerptSet
      ? overlapScoreWithTokenSet(claimText, excerptSet)
      : overlapScore(claimText, e.excerpt)
    if (eScore >= INFERRED_OVERLAP_THRESHOLD) {
      matchingRefs.push(e.id)
    }
  }

  if (score >= EXPLICIT_OVERLAP_THRESHOLD) {
    return {
      id: '',
      text: claimText,
      classification: 'SUPPORTED',
      confidence: 0.9,
      evidenceRefs: matchingRefs.length > 0 ? matchingRefs : personalEvidences.map((e) => e.id),
      priority: claimType === 'metric' ? 'high' : 'normal',
      claimType,
      reason: 'Nội dung và từ khóa kỹ thuật khớp với thông tin trong hồ sơ.',
    }
  }

  if (score >= INFERRED_OVERLAP_THRESHOLD && mode === 'balanced') {
    return {
      id: '',
      text: claimText,
      classification: 'INFERRED',
      confidence: 0.65,
      evidenceRefs: matchingRefs,
      priority: 'normal',
      claimType,
      reason: 'Có cơ sở liên quan nhưng cần mở rộng chi tiết.',
    }
  }

  return {
    id: '',
    text: claimText,
    classification: 'UNSUPPORTED',
    confidence: 0.88,
    evidenceRefs: [],
    priority: claimType === 'metric' ? 'high' : 'normal',
    claimType,
    reason: 'Không tìm thấy bằng chứng xác thực trong hồ sơ CV ứng viên.',
  }
}
