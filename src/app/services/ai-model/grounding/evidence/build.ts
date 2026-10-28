import type { GroundingEvidence, GroundingEvidenceInput } from '../types'

/**
 * Builds evidence list, explicitly tagging candidate-owned sources vs external context.
 */
export function buildEvidence(input: GroundingEvidenceInput): GroundingEvidence[] {
  const list: GroundingEvidence[] = []

  if (input.cv?.trim()) {
    list.push({
      id: 'evidence_cv',
      source: 'cv',
      excerpt: input.cv.trim(),
      isCandidateSource: true,
    })
  }

  if (input.profile?.trim()) {
    list.push({
      id: 'evidence_profile',
      source: 'profile',
      excerpt: input.profile.trim(),
      isCandidateSource: true,
    })
  }

  if (input.transcript?.trim()) {
    const candidateLines = input.transcript
      .split('\n')
      .filter((line) => /^(?:candidate|you|me|ứng viên|tôi):/i.test(line))
      .join('\n')

    if (candidateLines.trim()) {
      list.push({
        id: 'evidence_candidate_transcript',
        source: 'transcript',
        excerpt: candidateLines.trim(),
        isCandidateSource: true,
      })
    }

    list.push({
      id: 'evidence_full_transcript',
      source: 'transcript',
      excerpt: input.transcript.trim(),
      isCandidateSource: false,
    })
  }

  if (input.jobDescription?.trim()) {
    list.push({
      id: 'evidence_jd',
      source: 'jd',
      excerpt: input.jobDescription.trim(),
      isCandidateSource: false,
    })
  }

  if (input.session?.trim()) {
    list.push({
      id: 'evidence_session',
      source: 'session',
      excerpt: input.session.trim(),
      isCandidateSource: false,
    })
  }

  return list
}
