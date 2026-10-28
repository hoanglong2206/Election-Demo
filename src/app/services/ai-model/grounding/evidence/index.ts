import type { EvidenceIndex, GroundingEvidenceInput } from '../types'
import { extractFactSheet, computeContentHash } from '../factSheet'
import { buildEvidence } from './build'
import { normalize } from '../text/normalize'
import { tokens } from '../text/tokens'
import {
  expandTokensWithAliases,
  extractTechEntitiesFromText,
  normalizeTechEntity,
} from './aliases'

export const evidenceIndexCache = new Map<string, EvidenceIndex>()

export function clearEvidenceIndexCache(): void {
  evidenceIndexCache.clear()
}

export function computeEvidenceHash(input: GroundingEvidenceInput): string {
  const combined = [
    input.cv || '',
    input.profile || '',
    input.jobDescription || '',
    input.transcript || '',
    input.session || '',
  ].join('\n---\n')
  return computeContentHash(combined)
}

/**
 * Builds or retrieves cached EvidenceIndex.
 * Builds candidate token set with expanded aliases once, eliminating repeated tokenization & alias loops.
 */
export function getOrCreateEvidenceIndex(input: GroundingEvidenceInput): EvidenceIndex {
  const hash = computeEvidenceHash(input)
  const cached = evidenceIndexCache.get(hash)
  if (cached) return cached

  const evidenceList = buildEvidence(input)
  const factSheet = extractFactSheet(input.cv, input.profile)

  const personalEvidences = evidenceList.filter((e) => e.isCandidateSource)
  const candidateEvidenceText = personalEvidences.map((e) => e.excerpt).join('\n')
  const normalizedEvidenceText = normalize(candidateEvidenceText)

  const rawCandidateTokens = tokens(candidateEvidenceText)
  const candidateTokenSet = expandTokensWithAliases(rawCandidateTokens)

  // Candidate tech entities from CV and profile ONLY (JD is strictly excluded)
  const candidateTechEntities = extractTechEntitiesFromText(candidateEvidenceText)
  for (const tech of factSheet.techStack) {
    candidateTechEntities.add(tech.toLowerCase())
    candidateTechEntities.add(normalizeTechEntity(tech))
  }

  const candidateCompanies = new Set<string>(
    factSheet.companies.map((c) => c.toLowerCase())
  )

  const excerptTokenSets = new Map<string, Set<string>>()
  for (const e of personalEvidences) {
    if (personalEvidences.length === 1 && e.excerpt === candidateEvidenceText) {
      excerptTokenSets.set(e.id, candidateTokenSet)
    } else {
      const eTokens = tokens(e.excerpt)
      excerptTokenSets.set(e.id, expandTokensWithAliases(eTokens))
    }
  }

  const index: EvidenceIndex = {
    hash,
    factSheet,
    candidateEvidenceText,
    normalizedEvidenceText,
    candidateTokenSet,
    candidateTechEntities,
    candidateCompanies,
    evidenceList,
    excerptTokenSets,
  }

  if (evidenceIndexCache.size >= 100) {
    const firstKey = evidenceIndexCache.keys().next().value
    if (firstKey) evidenceIndexCache.delete(firstKey)
  }
  evidenceIndexCache.set(hash, index)

  return index
}
