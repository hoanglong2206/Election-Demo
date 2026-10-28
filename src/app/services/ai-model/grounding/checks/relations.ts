import type { CandidateFactSheet } from '../factSheet'

/**
 * Checks for directed relation contradiction (e.g., Kafka -> RabbitMQ vs RabbitMQ -> Kafka).
 */
export function checkDirectedRelationContradiction(
  claim: string,
  factSheet: CandidateFactSheet
): { hasContradiction: boolean; reason?: string } {
  const relationRegex = /(?:migrat(?:e|ed|ing|ion)?|chuyển|chuyển đổi|move[d]?|transition(?:ed)?)\s+[\s\S]*?\b(?:from|từ)\s+([\p{L}\p{N}.-]+)\s+(?:to|into|sang|qua)\s+(?:a\s+|an\s+)?([\p{L}\p{N}.-]+)/giu
  const arrowRegex = /([\p{L}\p{N}.-]+)\s*(?:->|→|==>|chuyển sang)\s*([\p{L}\p{N}.-]+)/giu

  const cleanEntity = (str: string) =>
    str
      .toLowerCase()
      .replace(/^[.,;:!?]+|[.,;:!?]+$/g, '')
      .trim()

  const checkPair = (from: string, to: string) => {
    const f = cleanEntity(from)
    const t = cleanEntity(to)
    for (const rel of factSheet.directedRelations) {
      const relFrom = cleanEntity(rel.from)
      const relTo = cleanEntity(rel.to)
      if (relFrom === t && relTo === f) {
        return {
          hasContradiction: true,
          reason: `Đảo ngược quan hệ: Claim ghi chuyển từ '${from}' sang '${to}', nhưng CV ghi '${rel.from}' sang '${rel.to}'.`,
        }
      }
    }
    return null
  }

  let m: RegExpExecArray | null
  while ((m = relationRegex.exec(claim)) !== null) {
    const res = checkPair(m[1], m[2])
    if (res) return res
  }

  while ((m = arrowRegex.exec(claim)) !== null) {
    const res = checkPair(m[1], m[2])
    if (res) return res
  }

  return { hasContradiction: false }
}
