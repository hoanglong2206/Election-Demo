import type { CandidateFactSheet } from '../factSheet'
import { detectMetricContextCategory } from '../factSheet'

export function toNormalizedNumber(num: number, unit?: string): number {
  if (!unit) return num
  const u = unit.toLowerCase()
  if (u === 'million' || u === 'triệu' || u === 'm') return num * 1_000_000
  if (u === 'thousand' || u === 'k') return num * 1_000
  if (u === 'tỷ' || u === 'billion' || u === 'b') return num * 1_000_000_000
  return num
}

export function isSameUnitCategory(u1: string, u2: string): boolean {
  const norm1 = u1.toLowerCase()
  const norm2 = u2.toLowerCase()
  if (norm1 === norm2) return true

  const teamUnits = ['members', 'member', 'engineers', 'engineer', 'kỹ sư', 'người', 'thành viên', 'people']
  if (teamUnits.includes(norm1) && teamUnits.includes(norm2)) return true

  const yearUnits = ['years', 'year', 'năm']
  if (yearUnits.includes(norm1) && yearUnits.includes(norm2)) return true

  const pctUnits = ['%', 'percent']
  if (pctUnits.includes(norm1) && pctUnits.includes(norm2)) return true

  const scaleUnits = ['million', 'thousand', 'k', 'm', 'triệu', 'tỷ', 'users', 'người dùng']
  if (scaleUnits.includes(norm1) && scaleUnits.includes(norm2)) return true

  return false
}

/**
 * Checks for metric contradiction using context (unit + noun/subject).
 * Only CONTRADICTED if there is a fact with the SAME context but different value and NO fact matches.
 * If metric has no fact in that context, returns isUngrounded: true (UNSUPPORTED, not CONTRADICTED).
 */
export function checkMetricContradiction(
  claim: string,
  factSheet: CandidateFactSheet
): { hasContradiction: boolean; isUngrounded?: boolean; reason?: string } {
  const claimMetrics: Array<{ number: number; unit?: string; raw: string; contextCategory: string }> = []
  const metricRegex = /(?<!\p{L})(\d+(?:\.\d+)?)\s*(%|percent|năm|years?|months?|tháng|members?|thành viên|engineers?|kỹ sư|people|người|triệu|million|thousand|k|m|users?|người dùng)?(?!\p{L})/giu

  let match: RegExpExecArray | null
  while ((match = metricRegex.exec(claim)) !== null) {
    const num = parseFloat(match[1])
    const unit = (match[2] || '').toLowerCase()
    if (!isNaN(num)) {
      claimMetrics.push({
        number: num,
        unit: unit || undefined,
        raw: match[0],
        contextCategory: detectMetricContextCategory(claim, unit),
      })
    }
  }

  if (claimMetrics.length === 0 || factSheet.metrics.length === 0) {
    return { hasContradiction: false, isUngrounded: claimMetrics.length > 0 }
  }

  let hasAnyMatchingContextFact = false

  for (const cm of claimMetrics) {
    if (!cm.unit) continue

    const matchingContextFacts = factSheet.metrics.filter(
      (fm) =>
        fm.unit &&
        isSameUnitCategory(cm.unit!, fm.unit) &&
        (fm.contextCategory === cm.contextCategory ||
          fm.contextCategory === 'general' ||
          cm.contextCategory === 'general')
    )

    if (matchingContextFacts.length > 0) {
      hasAnyMatchingContextFact = true
      const valClaim = toNormalizedNumber(cm.number, cm.unit)

      const hasValueMatch = matchingContextFacts.some((fm) => {
        const valFact = toNormalizedNumber(fm.number, fm.unit)
        return valClaim === valFact
      })

      if (!hasValueMatch) {
        return {
          hasContradiction: true,
          reason: `Sai lệch số liệu: Câu trả lời đề cập ${cm.raw} (${cm.contextCategory}), trong khi hồ sơ ghi nhận ${matchingContextFacts.map((f) => f.rawValue).join(', ')}.`,
        }
      }
    }
  }

  return {
    hasContradiction: false,
    isUngrounded: !hasAnyMatchingContextFact,
  }
}
