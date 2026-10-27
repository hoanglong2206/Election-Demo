/**
 * Answer Grounding & Anti-Hallucination Pipeline (3-Tier Hybrid Engine)
 * Layer 0: Structured FactSheet extraction & caching.
 * Layer 1: Fast, deterministic verification (0 token, regex lookarounds, multilingual aliases, exact metrics & relations).
 * Layer 2: LLM Entailment Judge (1 batched request, feature 'grounding', temperature 0, timeout guarded).
 */

import { extractFactSheet, type CandidateFactSheet } from './factSheet'
import { callUniversalLLM } from './universalLlm'

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

export interface GroundingInput {
  answer: string
  cv?: string
  profile?: string
  jobDescription?: string
  transcript?: string
  session?: string
  mode?: GroundingMode
  signal?: AbortSignal
}

// ─── CONSTANTS & VOCABULARIES ────────────────────────────────────────────────

export const LLM_JUDGE_TIMEOUT_MS = 2500
export const EXPLICIT_OVERLAP_THRESHOLD = 0.80
export const INFERRED_OVERLAP_THRESHOLD = 0.25

// Lookaround-based patterns with Unicode flag 'u' to safely handle Vietnamese diacritics
export const PERSONAL_PATTERN = /(?<!\p{L})(?:i|i've|i have|i led|i built|i worked|i managed|my|we|tôi|tôi đã|mình|chúng tôi|em đã|anh đã|chị đã|kinh nghiệm của tôi|dự án của tôi|bản thân tôi|team của tôi|chúng em)(?!\p{L})/iu

export const METRIC_PATTERN = /(?<!\p{L})(?:\d+(?:\.\d+)?%?|\d+\+?\s*(?:years?|năm|tháng|months?|members?|thành viên|engineers?|kỹ sư|người|people|triệu|million|scale|tỷ|billion|k|m|ms|rps|qps))(?!\p{L})/iu

export const GENERAL_TECHNICAL_MARKERS = /(?<!\p{L})(?:theorem|algorithm|architecture|pattern|protocol|concept|definition|định lý|nguyên lý|mô hình|kiến trúc|khái niệm|bản chất|thông thường|theo lý thuyết|trong thực tế|microservices|monolith|acid|cap|cache|database|sql|nosql|rest|grpc|kafka|docker|k8s)(?!\p{L})/iu

export const OPINION_APPROACH_MARKERS = /(?<!\p{L})(?:i would|i typically|i prefer|in my opinion|approach|strategy|theo tôi|quan điểm của tôi|thông thường tôi|tôi thường ưu tiên|phương pháp tiếp cận|giải pháp đề xuất)(?!\p{L})/iu

export const NEGATION_PATTERN = /(?<!\p{L})(?:not|never|didn't|did not|was not|wasn't|cannot|can't|không|chưa|chưa từng|chưa bao giờ|không có|không phải)(?!\p{L})/iu

export const SHORT_TECH_TERMS = new Set([
  'go', 'c#', 'ai', 'ml', 'js', 'ts', 'ci', 'cd', 'qa', 'qc', 'ui', 'ux', 'db', 'os', 'k8s', 'ar', 'vr'
])

export const STOP_WORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'have', 'been', 'were', 'for', 'about',
  'our', 'my', 'their', 'its', 'next', 'then', 'also', 'currently', 'previously', 'first', 'second', 'finally',
  'đã', 'và', 'có', 'là', 'cho', 'trong', 'một', 'những', 'các', 'với', 'khi', 'được', 'để',
  'em', 'anh', 'chị', 'bằng', 'như', 'vào', 'tại', 'về', 'tới', 'sang', 'qua', 'ra',
  'tiếp theo', 'sau đó', 'đồng thời', 'ngoài ra',
])

export const VI_EN_TECH_ALIASES: Record<string, string[]> = {
  'kỹ sư': ['engineer', 'engineers', 'developer', 'developers'],
  'lập trình viên': ['developer', 'developers', 'engineer', 'engineers'],
  'quản lý': ['lead', 'leader', 'manage', 'manager', 'managed'],
  'trưởng nhóm': ['lead', 'leader', 'team lead', 'tech lead'],
  'dẫn dắt': ['lead', 'led', 'manage', 'managed', 'leader'],
  'thành viên': ['member', 'members', 'people', 'engineers'],
  'người': ['people', 'engineers', 'members'],
  'đội ngũ': ['team', 'squad', 'engineers', 'members'],
  'cơ sở dữ liệu': ['database', 'db', 'sql', 'nosql', 'postgres', 'postgresql', 'mysql'],
  'tối ưu': ['optimize', 'optimized', 'optimization', 'performance'],
  'tối ưu hóa': ['optimize', 'optimized', 'optimization', 'performance'],
  'hiệu năng': ['performance', 'latency', 'throughput', 'speed'],
  'triển khai': ['deploy', 'deployed', 'deployment', 'release'],
  'xây dựng': ['build', 'built', 'develop', 'developed', 'architect'],
  'phát triển': ['develop', 'developed', 'development', 'build', 'built'],
  'hệ thống': ['system', 'systems', 'platform', 'infrastructure'],
  'hạ tầng': ['infrastructure', 'platform'],
  'dịch vụ': ['service', 'services', 'microservices'],
  'vi dịch vụ': ['microservices', 'microservice'],
  'phân tán': ['distributed', 'distributed systems'],
  'bộ nhớ đệm': ['cache', 'caching', 'redis', 'memcached'],
  'hàng đợi': ['queue', 'message queue', 'kafka', 'rabbitmq', 'messaging'],
  'tin nhắn': ['message', 'messaging', 'queue'],
  'giảm': ['reduce', 'reduced', 'reduction', 'decrease', 'decreased'],
  'tăng': ['increase', 'increased', 'boost', 'boosted', 'improve', 'improved'],
  'độ trễ': ['latency', 'delay', 'response time'],
  'thời gian thực': ['real-time', 'realtime', 'websocket'],
  'tài liệu': ['documentation', 'document', 'swagger', 'openapi', 'docs'],
  'cảnh báo': ['alert', 'alerting', 'alerts', 'alarm'],
  'theo dõi': ['monitor', 'monitoring', 'observe', 'observability'],
  'giám sát': ['monitor', 'monitoring', 'observe', 'observability'],
  'giao diện': ['ui', 'frontend', 'interface'],
  'thiết kế': ['design', 'designed', 'architect', 'architecture'],
  'viết': ['write', 'wrote', 'author', 'authored', 'build', 'built'],
  'năm': ['years', 'year'],
  'tháng': ['months', 'month'],
  'triệu': ['million', 'm'],
  'tỷ': ['billion', 'b'],
  'công ty': ['company', 'corp', 'corporation', 'firm'],
  'lead': ['led', 'leading', 'leader'],
  'led': ['lead', 'leading', 'leader'],
  'manage': ['managed', 'managing', 'manager'],
  'managed': ['manage', 'managing', 'manager'],
  'build': ['built', 'building'],
  'built': ['build', 'building'],
}

// ─── TEXT PROCESSING UTILITIES ──────────────────────────────────────────────

export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%+#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Basic English suffix stemmer for token matching.
 */
export function stem(word: string): string {
  return word.replace(/(?:ing|edly|ed|es|s|ment|tion|tions)$/g, '')
}

/**
 * Extracts meaningful tokens, preserving short numbers (e.g. 5, 12),
 * 2-char tech terms (go, c#, ai, ml, js), and 2-char Vietnamese morphemes.
 */
export function tokens(text: string): string[] {
  const norm = normalize(text)
  if (!norm) return []
  return norm
    .split(' ')
    .map((token) => token.replace(/^[.,;:!?]+|[.,;:!?]+$/g, ''))
    .filter((token) => {
      if (!token) return false
      if (STOP_WORDS.has(token)) return false
      if (/^\d+(?:\.\d+)?%?$/.test(token)) return true // Keep metrics & numbers!
      if (token.length > 2) return true
      if (SHORT_TECH_TERMS.has(token)) return true // Keep short tech terms!
      if (token.length === 2 && /[\p{L}]/u.test(token)) return true // 2-char morphemes
      return false
    })
}

/**
 * Robust sentence splitter that preserves abbreviations (e.g., Node.js, v1.2, etc.) and bullet lines.
 */
export function splitSentences(answer: string): string[] {
  if (!answer || !answer.trim()) return []

  const lines = answer.split('\n')
  const results: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // If it's a markdown bullet point or numbered item, treat each bullet as a distinct claim unit
    if (/^[-*•]\s+|^\d+\.\s+/.test(line)) {
      const cleanLine = line.replace(/^[-*•]\s+|^\d+\.\s+/, '').trim()
      if (cleanLine) results.push(cleanLine)
      continue
    }

    // Split paragraphs on sentence boundaries, guarding abbreviations and tech terms
    const sentenceRegex = /(?<!\b(?:e\.g|i\.e|etc|vs|v|mr|ms|dr|node|vue|next|nuxt|nest))\s*(?<=[.!?。！？])\s+(?=[A-Z\p{Lu}\d"'-])/gu
    const parts = line.split(sentenceRegex).map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) {
      results.push(...parts)
    } else {
      results.push(line)
    }
  }

  return results
}

/**
 * Categorizes a claim to decide proper verification policy.
 * Evaluates OPINION_APPROACH before isPersonal because opinions frequently use personal pronouns ("I prefer").
 */
export function classifyClaimType(sentence: string): ClaimType {
  if (OPINION_APPROACH_MARKERS.test(sentence)) {
    return 'opinion_approach'
  }

  const isPersonal = PERSONAL_PATTERN.test(sentence)
  const hasMetric = METRIC_PATTERN.test(sentence)

  if (hasMetric && (isPersonal || /(?:reduced|increased|scaled|achieved|tăng|giảm|đạt)/i.test(sentence))) {
    return 'metric'
  }
  if (isPersonal) {
    return 'personal_experience'
  }
  if (GENERAL_TECHNICAL_MARKERS.test(sentence) || !isPersonal) {
    return 'general_technical'
  }
  return 'general_technical'
}

/**
 * Builds evidence list, explicitly tagging candidate-owned sources vs external context.
 * Does NOT truncate CV context to 4000 chars.
 */
export function buildEvidence(input: GroundingInput): GroundingEvidence[] {
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
    // Only lines spoken by candidate prove personal experience
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

/**
 * Expand tokens with bilingual Vietnamese <-> English aliases and stems for cross-lingual matching.
 */
export function expandTokensWithAliases(tokenList: string[]): Set<string> {
  const set = new Set<string>()
  for (const token of tokenList) {
    set.add(token)
    const st = stem(token)
    if (st && st.length >= 2) set.add(st)

    for (const [vi, enList] of Object.entries(VI_EN_TECH_ALIASES)) {
      const viParts = vi.split(' ')
      if (token === vi || viParts.includes(token)) {
        for (const en of enList) {
          set.add(en)
          const enSt = stem(en)
          if (enSt && enSt.length >= 2) set.add(enSt)
        }
      }
      if (enList.includes(token) || enList.some((en) => stem(en) === token || stem(en) === st)) {
        set.add(vi)
        for (const p of viParts) {
          if (p) set.add(p)
        }
      }
    }
  }
  return set
}

export function overlapScore(claim: string, evidenceText: string): number {
  const claimTokens = tokens(claim)
  if (claimTokens.length === 0) return 0

  const evidenceTokens = tokens(evidenceText)
  const evidenceTokenSet = expandTokensWithAliases(evidenceTokens)

  let matched = 0
  for (const t of claimTokens) {
    const tStem = stem(t)
    if (evidenceTokenSet.has(t) || (tStem && evidenceTokenSet.has(tStem))) {
      matched++
      continue
    }

    const tAliases = expandTokensWithAliases([t])
    let hasAliasMatch = false
    for (const alias of tAliases) {
      if (evidenceTokenSet.has(alias)) {
        hasAliasMatch = true
        break
      }
    }
    if (hasAliasMatch) {
      matched++
    }
  }

  return matched / claimTokens.length
}

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

function toNormalizedNumber(num: number, unit?: string): number {
  if (!unit) return num
  const u = unit.toLowerCase()
  if (u === 'million' || u === 'triệu' || u === 'm') return num * 1_000_000
  if (u === 'thousand' || u === 'k') return num * 1_000
  if (u === 'tỷ' || u === 'billion' || u === 'b') return num * 1_000_000_000
  return num
}

function isSameUnitCategory(u1: string, u2: string): boolean {
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
 * Checks for metric mismatch (e.g. claim "12 engineers" vs CV "5 engineers").
 */
export function checkMetricContradiction(
  claim: string,
  factSheet: CandidateFactSheet
): { hasContradiction: boolean; reason?: string } {
  const claimMetrics: Array<{ number: number; unit?: string; raw: string }> = []
  const metricRegex = /(?<!\p{L})(\d+(?:\.\d+)?)\s*(%|percent|năm|years?|months?|tháng|members?|thành viên|engineers?|kỹ sư|people|người|triệu|million|thousand|k|m|users?|người dùng)?(?!\p{L})/giu

  let match: RegExpExecArray | null
  while ((match = metricRegex.exec(claim)) !== null) {
    const num = parseFloat(match[1])
    const unit = (match[2] || '').toLowerCase()
    if (!isNaN(num)) {
      claimMetrics.push({ number: num, unit: unit || undefined, raw: match[0] })
    }
  }

  if (claimMetrics.length === 0 || factSheet.metrics.length === 0) {
    return { hasContradiction: false }
  }

  for (const cm of claimMetrics) {
    if (!cm.unit) continue
    // Check if CV has any fact with the exact same unit context but different number
    for (const fm of factSheet.metrics) {
      if (fm.unit && isSameUnitCategory(cm.unit, fm.unit)) {
        const val1 = toNormalizedNumber(cm.number, cm.unit)
        const val2 = toNormalizedNumber(fm.number, fm.unit)
        if (val1 !== val2) {
          return {
            hasContradiction: true,
            reason: `Sai lệch số liệu: Câu trả lời đề cập ${cm.raw}, trong khi hồ sơ ghi nhận ${fm.rawValue}.`,
          }
        }
      }
    }
  }

  return { hasContradiction: false }
}

/**
 * Scans candidate evidence for negation of the claim's core predicates or keywords.
 * Guards against substrings like 'notification' by using Unicode lookarounds.
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

  // Split evidence into sentences
  const evidenceSentences = candidateEvidence.split(/(?<=[.!?。！？\n])\s+/u)

  for (const sentence of evidenceSentences) {
    if (!NEGATION_PATTERN.test(sentence)) continue

    const words = sentence.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const cleanWord = words[i].replace(/[^\p{L}\p{N}]+/gu, '')
      if (NEGATION_PATTERN.test(cleanWord)) {
        // Look ahead 1-5 words after negation
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

// ─── TIER 1: DETERMINISTIC CLASSIFIER ────────────────────────────────────────

export function classifyClaimDeterministic(
  claimText: string,
  evidence: GroundingEvidence[],
  factSheet: CandidateFactSheet,
  mode: GroundingMode
): GroundingClaim {
  const claimType = classifyClaimType(claimText)

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
  const combinedPersonalText = personalEvidences.map((e) => e.excerpt).join('\n')

  // Check explicit exact match first (prior to contradiction check to prevent false positives)
  const normClaim = normalize(claimText)
  const normEvidence = normalize(combinedPersonalText)
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

  // Check directed relation contradiction
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

  // Check metric contradiction
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

  // Check negation contradiction
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

  const score = overlapScore(claimText, combinedPersonalText)
  const matchingRefs = personalEvidences
    .filter((e) => overlapScore(claimText, e.excerpt) >= INFERRED_OVERLAP_THRESHOLD)
    .map((e) => e.id)

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

/**
 * Generates minimally corrected answer in the same language as input answer.
 * Does NOT drop general technical knowledge.
 */
export function rewriteAnswer(
  sentences: string[],
  claims: GroundingClaim[],
  mode: GroundingMode
): string {
  const isVietnamese = sentences.some((s) => /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(s))

  const kept: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const c = claims[i]
    if (!c) {
      kept.push(s)
      continue
    }

    // Contradicted claims are always completely excluded from correctedAnswer
    if (c.classification === 'CONTRADICTED') {
      continue
    }

    // Unsupported personal or metric claims
    if (
      c.classification === 'UNSUPPORTED' &&
      (c.claimType === 'personal_experience' || c.claimType === 'metric' || PERSONAL_PATTERN.test(s))
    ) {
      if (mode === 'strict') {
        continue
      }
      // In balanced mode, keep with caveat
      const caution = isVietnamese ? `${s} (cần xác nhận kinh nghiệm)` : `${s} (confirm experience)`
      kept.push(caution)
      continue
    }

    kept.push(s)
  }

  if (kept.length > 0) return kept.join(' ')

  return isVietnamese
    ? 'Tôi có thể giải thích phương pháp tiếp cận chung, nhưng cần xác nhận lại kinh nghiệm cá nhân và số liệu cụ thể trước khi trình bày.'
    : 'I can explain the approach, but I would confirm the specific personal experience and metrics before stating them.'
}

// ─── PUBLIC SYNCHRONOUS API (TIER 1 FAST ENGINE) ────────────────────────────

/**
 * Validates answer grounding synchronously using Layer 0 FactSheet and Layer 1 Deterministic Engine.
 * 0 tokens consumed. Safe and backward-compatible.
 */
export function validateAnswerGrounding(input: GroundingInput): GroundingResult {
  const mode = input.mode || 'balanced'
  const evidence = buildEvidence(input)
  const factSheet = extractFactSheet(input.cv, input.profile)
  const sentences = splitSentences(input.answer)

  const claims: GroundingClaim[] = sentences.map((text, index) => {
    const classified = classifyClaimDeterministic(text, evidence, factSheet, mode)
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

// ─── TIER 2: LLM ENTAILMENT JUDGE (ASYNC PIPELINE) ──────────────────────────

interface LLMJudgeItem {
  claimId: string
  verdict: 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'GENERAL_KNOWLEDGE'
  reason: string
  confidence?: number
}

/**
 * Asynchronously evaluates candidate claims with LLM Judge (Layer 2).
 * Batches ambiguous/risky personal claims into 1 prompt with feature: 'grounding'.
 * Falls back safely to Layer 1 deterministic result on timeout or error.
 */
export async function validateAnswerGroundingAsync(
  input: GroundingInput
): Promise<GroundingResult> {
  const syncResult = validateAnswerGrounding(input)

  // Identify claims that need LLM Judge (personal/metric claims that are not already 100% explicitly supported)
  const claimsForJudge = syncResult.claims.filter(
    (c) =>
      c.claimType === 'personal_experience' ||
      c.claimType === 'metric' ||
      (c.classification !== 'SUPPORTED' && c.classification !== 'GENERAL_KNOWLEDGE')
  )

  if (claimsForJudge.length === 0) {
    return syncResult
  }

  const cvEvidence = input.cv?.trim() || input.profile?.trim() || ''
  if (!cvEvidence) {
    return syncResult
  }

  const prompt = `Bạn là chuyên gia thẩm định tính xác thực thông tin phỏng vấn (Fact-Checking & Entailment Judge).
Nhiệm vụ: Đối chiếu các phát biểu (claims) của ứng viên với HỒ SƠ ỨNG VIÊN (CV) để phát hiện chém gió, bịa đặt số liệu hoặc đảo ngược quan hệ/vai trò.

HỒ SƠ ỨNG VIÊN (GROUND TRUTH):
"""
${cvEvidence.slice(0, 10000)}
"""

DANH SÁCH CLAIMS CẦN THẨM ĐỊNH:
${JSON.stringify(
  claimsForJudge.map((c) => ({
    id: c.id,
    text: c.text,
    claimType: c.claimType,
  })),
  null,
  2
)}

QUY TẮC PHÁN QUYẾT:
1. SUPPORTED: CV chứng minh rõ ràng điều này.
2. CONTRADICTED: Mâu thuẫn trực tiếp với CV (sai số lượng, sai năm kinh nghiệm, đảo ngược chiều chuyển đổi kiến trúc/công nghệ, hoặc làm việc khác với CV ghi).
3. UNSUPPORTED: Khẳng định kinh nghiệm/dự án/công nghệ của bản thân nhưng CV hoàn toàn không có thông tin này.
4. GENERAL_KNOWLEDGE: Kiến thức lý thuyết, nguyên lý kỹ thuật hoặc quan điểm chung — không phải là tuyên bố kinh nghiệm bản thân bịa đặt.
5. INFERRED: Suy luận logic hợp lý từ các thông tin có trong CV.

TRẢ VỀ CHÍNH XÁC MẢNG JSON (KHÔNG MARKDOWN FENCE, KHÔNG BÌNH LUẬN):
[
  {
    "claimId": "claim_1",
    "verdict": "SUPPORTED" | "INFERRED" | "UNSUPPORTED" | "CONTRADICTED" | "GENERAL_KNOWLEDGE",
    "reason": "Giải thích ngắn gọn bằng tiếng Việt",
    "confidence": 0.95
  }
]`

  try {
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined

    const judgePromise = callUniversalLLM(prompt, {
      maxTokens: 500,
      temperature: 0,
      feature: 'grounding',
      routing: {
        policy: 'fastest',
      },
    })

    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutTimer = setTimeout(() => resolve(null), LLM_JUDGE_TIMEOUT_MS)
    })

    const rawRes = await Promise.race([judgePromise, timeoutPromise])
    if (timeoutTimer) clearTimeout(timeoutTimer)

    if (!rawRes || !rawRes.text || rawRes.truncated) {
      if (rawRes?.truncated) {
        console.warn('[answerGrounding] LLM judge response was truncated mid-stream; falling back to degraded')
      }
      return { ...syncResult, degraded: true }
    }

    const cleanText = rawRes.text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim()

    let judgeItems: LLMJudgeItem[] = []
    try {
      judgeItems = JSON.parse(cleanText)
    } catch {
      return { ...syncResult, degraded: true }
    }

    if (!Array.isArray(judgeItems)) {
      return { ...syncResult, degraded: true }
    }

    // Merge LLM Judge verdicts into claims
    const updatedClaims = syncResult.claims.map((claim) => {
      const judge = judgeItems.find((j) => j.claimId === claim.id)
      if (!judge) return claim

      return {
        ...claim,
        classification: judge.verdict as ClaimClassification,
        reason: judge.reason || claim.reason,
        confidence: judge.confidence ?? claim.confidence,
      }
    })

    const risky = updatedClaims.filter(
      (c) =>
        (c.classification === 'UNSUPPORTED' && (c.claimType === 'personal_experience' || c.claimType === 'metric')) ||
        c.classification === 'CONTRADICTED'
    )

    const overallRisk: GroundingRisk =
      risky.length === 0 ? 'low' : risky.some((c) => c.priority === 'high' || c.classification === 'CONTRADICTED') ? 'high' : 'medium'

    const sentences = splitSentences(input.answer)
    const correctedAnswer = rewriteAnswer(sentences, updatedClaims, input.mode || 'balanced')
    const hasDiscrepancies = overallRisk !== 'low' || risky.length > 0

    return {
      claims: updatedClaims,
      evidence: syncResult.evidence,
      confidence: updatedClaims.reduce((s, c) => s + c.confidence, 0) / updatedClaims.length,
      overallRisk,
      correctedAnswer,
      originalAnswer: input.answer,
      hasDiscrepancies,
      warning:
        risky.length > 0
          ? `${risky.length} phát biểu cá nhân / số liệu cần được kiểm chứng lại với CV.`
          : undefined,
      degraded: false,
    }
  } catch (err) {
    return { ...syncResult, degraded: true }
  }
}

// ─── STREAMING GROUNDING PIPELINE ───────────────────────────────────────────

export interface StreamingGrounder {
  pushDelta: (delta: string) => GroundingClaim[]
  finalize: () => GroundingResult
}

/**
 * Creates an incremental streaming grounder that evaluates complete sentences as tokens arrive.
 * UI receives progressive claims to render badges without altering active reading text.
 */
export function createStreamingGrounder(
  input: Omit<GroundingInput, 'answer'> & {
    onSentenceGround?: (claim: GroundingClaim) => void
  }
): StreamingGrounder {
  const mode = input.mode || 'balanced'
  const evidence = buildEvidence(input as GroundingInput)
  const factSheet = extractFactSheet(input.cv, input.profile)

  let accumulated = ''
  let groundedSentencesCount = 0
  const allClaims: GroundingClaim[] = []
  const allSentences: string[] = []

  return {
    pushDelta: (delta: string): GroundingClaim[] => {
      accumulated += delta
      const sentences = splitSentences(accumulated)
      const newlyGrounded: GroundingClaim[] = []

      // If there are multiple sentences, all except the last one are complete
      while (groundedSentencesCount < sentences.length - 1) {
        const sentenceText = sentences[groundedSentencesCount]
        allSentences.push(sentenceText)
        const classified = classifyClaimDeterministic(sentenceText, evidence, factSheet, mode)
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
        const classified = classifyClaimDeterministic(sentenceText, evidence, factSheet, mode)
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

