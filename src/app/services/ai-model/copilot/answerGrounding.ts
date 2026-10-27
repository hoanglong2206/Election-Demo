/**
 * Answer Grounding & Anti-Hallucination Pipeline (3-Tier Hybrid Engine)
 * Layer 0: Structured FactSheet extraction & caching.
 * Layer 1: Fast, deterministic verification (0 token, inverted alias map, tech entity validation, context-aware metrics).
 * Layer 2: LLM Entailment Judge (1 batched request, feature 'grounding', temperature 0, timeout guarded).
 */

import {
  extractFactSheet,
  computeContentHash,
  detectMetricContextCategory,
  type CandidateFactSheet,
} from './factSheet'
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

// ─── CONSTANTS & VOCABULARIES ────────────────────────────────────────────────

export const LLM_JUDGE_TIMEOUT_MS = 2500
export const EXPLICIT_OVERLAP_THRESHOLD = 0.80
export const INFERRED_OVERLAP_THRESHOLD = 0.25

// Lookaround-based patterns with Unicode flag 'u' to safely handle Vietnamese diacritics
export const PERSONAL_PATTERN = /(?<!\p{L})(?:i|i've|i have|i led|i built|i worked|i managed|my|we|our|ours|our team|our system|tôi|tôi đã|mình|chúng tôi|chúng em|em|em đã|anh đã|chị đã|bên mình|team mình|công ty cũ|nhóm mình|phía mình|kinh nghiệm của tôi|dự án của tôi|bản thân tôi|team của tôi)(?!\p{L})|(?<!\p{L})(?:at|tại)\s+[A-Z\p{Lu}][\p{L}\p{N}.-]+/iu

export const STARTING_ACTION_VERBS = /^\s*(?:implemented|led|built|designed|developed|optimized|scaled|managed|architected|created|integrated|migrated|authored|deployed|delivered|triển khai|xây dựng|thiết kế|tối ưu|tối ưu hóa|dẫn dắt|quản lý|chủ trì|phát triển|tạo ra|tích hợp|chuyển đổi|vận hành|đã\s+[\p{L}]+)\b/iu

export const BULLET_PREFIX_REGEX = /^\s*(?:[-*•]|\d+\.)\s+/

export const METRIC_PATTERN = /(?<!\p{L})(?:\d+(?:\.\d+)?%?|\d+\+?\s*(?:years?|năm|tháng|months?|members?|thành viên|engineers?|kỹ sư|người|people|triệu|million|scale|tỷ|billion|k|m|ms|rps|qps))(?!\p{L})/iu

// Architectural & theoretical concepts (tool names like kafka, docker, k8s, cache, sql, etc. removed)
export const GENERAL_TECHNICAL_MARKERS = /(?<!\p{L})(?:theorem|algorithm|architecture|pattern|protocol|concept|definition|trade-off|tradeoff|indexes|định lý|nguyên lý|mô hình|kiến trúc|khái niệm|bản chất|thông thường|theo lý thuyết|về mặt lý thuyết|trong thực tế|về cơ bản|in theory|by definition|stands for|is defined as|refers to|means that|là một khái niệm|được định nghĩa là|acid|cap|cap theorem|acid properties|acid principle|b-tree|cache-aside|event-driven|microservices|monolith)(?!\p{L})/iu

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
  'bên', 'mình', 'chúng', 'của', 'tôi',
])

export const CANONICAL_TECH_ENTITIES = new Set([
  // Message & Streaming
  'kafka', 'rabbitmq', 'sqs', 'sns', 'activemq', 'nats', 'pulsar', 'kinesis',
  // Data Warehouses & Big Data
  'snowflake', 'dbt', 'bigquery', 'redshift', 'databricks', 'spark', 'pyspark', 'flink', 'hadoop', 'hive', 'airflow', 'clickhouse', 'presto', 'trino',
  // Databases & Stores
  'postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'sqlite', 'mariadb', 'oracle', 'neo4j', 'couchbase', 'memcached',
  // Programming Languages
  'python', 'java', 'golang', 'go', 'rust', 'c#', 'c++', 'typescript', 'javascript', 'php', 'ruby', 'scala', 'kotlin', 'swift', 'dart',
  // Frameworks & Libraries
  'react', 'react native', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt', 'node.js', 'nodejs', 'express', 'nest.js', 'nestjs', 'fastapi', 'django', 'flask', 'spring', 'spring boot', 'laravel', 'asp.net', '.net',
  // Cloud & DevOps
  'docker', 'kubernetes', 'k8s', 'aws', 'gcp', 'azure', 'terraform', 'ansible', 'jenkins', 'gitlab ci', 'github actions', 'helm', 'argocd', 'argo cd', 'prometheus', 'grafana',
  // Protocols & APIs
  'grpc', 'graphql', 'rest', 'websocket',
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
  'hiệu năng': ['performance', 'latency', 'throughput', 'speed', 'vitals'],
  'tốc độ': ['speed', 'performance', 'latency', 'render', 'vitals'],
  'vitals': ['performance', 'speed', 'tốc độ', 'render', 'hiệu năng'],
  'triển khai': ['deploy', 'deployed', 'deployment', 'release'],
  'xây dựng': ['build', 'built', 'develop', 'developed', 'architect'],
  'phát triển': ['develop', 'developed', 'development', 'build', 'built'],
  'hệ thống': ['system', 'systems', 'platform', 'infrastructure'],
  'hạ tầng': ['infrastructure', 'platform'],
  'dịch vụ': ['service', 'services', 'microservices'],
  'vi dịch vụ': ['microservices', 'microservice'],
  'phân tán': ['distributed', 'distributed systems'],
  'bộ nhớ đệm': ['cache', 'caching', 'redis', 'memcached'],
  'hàng đợi': ['queue', 'message queue', 'messaging'],
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
 * Prebuilt Inverted Alias Map built once at module load:
 * Maps each token and stem to its aliases for O(1) lookup.
 */
export const INVERTED_ALIAS_MAP: Map<string, string[]> = (() => {
  const map = new Map<string, Set<string>>()

  const addMapping = (from: string, to: string) => {
    if (!from || !to || from === to) return
    let existing = map.get(from)
    if (!existing) {
      existing = new Set<string>()
      map.set(from, existing)
    }
    existing.add(to)
  }

  for (const [viPhrase, enList] of Object.entries(VI_EN_TECH_ALIASES)) {
    const viClean = viPhrase.toLowerCase().trim()
    const viParts = viClean.split(/\s+/).filter(Boolean)
    const viStem = stem(viClean)

    const viVariants = new Set<string>([viClean])
    if (viStem) viVariants.add(viStem)
    for (const p of viParts) {
      viVariants.add(p)
      const pStem = stem(p)
      if (pStem) viVariants.add(pStem)
    }

    const enVariants = new Set<string>()
    for (const en of enList) {
      const enClean = en.toLowerCase().trim()
      enVariants.add(enClean)
      const enSt = stem(enClean)
      if (enSt) enVariants.add(enSt)
      const enParts = enClean.split(/\s+/).filter(Boolean)
      for (const ep of enParts) {
        enVariants.add(ep)
        const epSt = stem(ep)
        if (epSt) enVariants.add(epSt)
      }
    }

    for (const v of viVariants) {
      for (const e of enVariants) {
        addMapping(v, e)
        addMapping(e, v)
      }
    }

    for (const e1 of enVariants) {
      for (const e2 of enVariants) {
        if (e1 !== e2) addMapping(e1, e2)
      }
    }
  }

  const result = new Map<string, string[]>()
  for (const [key, set] of map.entries()) {
    result.set(key, Array.from(set))
  }
  return result
})()

/**
 * Normalizes technology entity names to canonical form.
 */
export function normalizeTechEntity(entity: string): string {
  const norm = entity.toLowerCase().trim().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '')
  if (norm === 'postgresql') return 'postgres'
  if (norm === 'k8s') return 'kubernetes'
  if (norm === 'nodejs') return 'node.js'
  if (norm === 'nextjs') return 'next.js'
  if (norm === 'nestjs') return 'nest.js'
  if (norm === 'nuxtjs') return 'nuxt'
  if (norm === 'golang') return 'go'
  if (norm === 'argo cd') return 'argocd'
  if (norm === 'reactnative') return 'react native'
  return norm
}

export const CANONICAL_TECH_REGEX = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
    Array.from(CANONICAL_TECH_ENTITIES)
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')(?![\\p{L}\\p{N}])',
  'giu'
)

/**
 * Extracts tech entities from text using canonical dictionary + heuristics (CamelCase, dotted names).
 */
export function extractTechEntitiesFromText(text: string): Set<string> {
  const result = new Set<string>()
  if (!text) return result

  // 1. Single-pass regex for all canonical tech keywords
  CANONICAL_TECH_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CANONICAL_TECH_REGEX.exec(text)) !== null) {
    const raw = m[0].toLowerCase()
    result.add(raw)
    result.add(normalizeTechEntity(raw))
  }

  // 2. Dotted names (e.g. Node.js, Vue.js, Three.js)
  const dottedRegex = /(?<![\p{L}\p{N}])([A-Za-z0-9]+(?:\.[a-zA-Z0-9]+)+)(?![\p{L}\p{N}])/gu
  while ((m = dottedRegex.exec(text)) !== null) {
    const raw = m[1].toLowerCase()
    if (!/^\d+(\.\d+)+$/.test(raw) && !raw.endsWith('.com') && !raw.endsWith('.org')) {
      result.add(raw)
      result.add(normalizeTechEntity(raw))
    }
  }

  // 3. CamelCase technology names (e.g. ElasticSearch, DynamoDB, BigQuery, Snowflake, etc.)
  const camelRegex = /(?<![\p{L}\p{N}])([A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*)(?![\p{L}\p{N}])/gu
  while ((m = camelRegex.exec(text)) !== null) {
    const raw = m[1].toLowerCase()
    result.add(raw)
    result.add(normalizeTechEntity(raw))
  }

  return result
}

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
 * Extracts meaningful tokens.
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
      if (/^\d+(?:\.\d+)?%?$/.test(token)) return true
      if (token.length > 2) return true
      if (SHORT_TECH_TERMS.has(token)) return true
      if (token.length === 2 && /[\p{L}]/u.test(token)) return true
      return false
    })
}

/**
 * Fast O(tokens) alias expansion using prebuilt inverted map.
 */
export function expandTokensWithAliases(tokenList: string[]): Set<string> {
  const set = new Set<string>()
  for (const token of tokenList) {
    if (!token) continue
    set.add(token)
    const st = stem(token)
    if (st && st.length >= 2) set.add(st)

    const aliases = INVERTED_ALIAS_MAP.get(token)
    if (aliases) {
      for (let i = 0; i < aliases.length; i++) {
        set.add(aliases[i])
      }
    }
    if (st && st !== token) {
      const stemAliases = INVERTED_ALIAS_MAP.get(st)
      if (stemAliases) {
        for (let i = 0; i < stemAliases.length; i++) {
          set.add(stemAliases[i])
        }
      }
    }
  }
  return set
}

/**
 * Robust sentence splitter that preserves abbreviations and markdown bullets.
 */
export function splitSentences(answer: string): string[] {
  if (!answer || !answer.trim()) return []

  const lines = answer.split('\n')
  const results: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^[-*•]\s+|^\d+\.\s+/.test(line)) {
      const cleanLine = line.replace(/^[-*•]\s+|^\d+\.\s+/, '').trim()
      if (cleanLine) results.push(cleanLine)
      continue
    }

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
 * Determines whether a sentence expresses personal experience or actions without requiring 1st-person pronouns.
 */
export function isPersonalSentence(sentence: string, index?: EvidenceIndex): boolean {
  if (PERSONAL_PATTERN.test(sentence)) return true
  if (STARTING_ACTION_VERBS.test(sentence)) return true
  if (BULLET_PREFIX_REGEX.test(sentence)) return true

  if (index?.candidateCompanies) {
    const lower = sentence.toLowerCase()
    for (const company of index.candidateCompanies) {
      if (company.length >= 3 && lower.includes(company)) {
        return true
      }
    }
  }
  return false
}

/**
 * Categorizes a claim to decide proper verification policy.
 */
export function classifyClaimType(sentence: string, index?: EvidenceIndex): ClaimType {
  if (OPINION_APPROACH_MARKERS.test(sentence)) {
    return 'opinion_approach'
  }

  const isPersonal = isPersonalSentence(sentence, index)
  const hasMetric = METRIC_PATTERN.test(sentence)

  if (hasMetric && (isPersonal || /(?:reduced|increased|scaled|achieved|tăng|giảm|đạt)/i.test(sentence))) {
    return 'metric'
  }
  if (isPersonal) {
    return 'personal_experience'
  }

  // Not personal: general technical concept, principle, architecture, or 3rd-person mechanics
  return 'general_technical'
}

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

// ─── EVIDENCE INDEX & CACHING (REQUIREMENT 1) ───────────────────────────────

const evidenceIndexCache = new Map<string, EvidenceIndex>()

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

/**
 * Computes overlap score against a precomputed candidate token set in O(claim_tokens).
 */
export function overlapScoreWithTokenSet(claim: string, candidateTokenSet: Set<string>): number {
  const claimTokens = tokens(claim)
  if (claimTokens.length === 0) return 0

  let matched = 0
  for (const t of claimTokens) {
    const tStem = stem(t)
    if (candidateTokenSet.has(t) || (tStem && candidateTokenSet.has(tStem))) {
      matched++
      continue
    }

    const tAliases = INVERTED_ALIAS_MAP.get(t) || (tStem ? INVERTED_ALIAS_MAP.get(tStem) : undefined)
    if (tAliases) {
      let found = false
      for (let i = 0; i < tAliases.length; i++) {
        if (candidateTokenSet.has(tAliases[i])) {
          found = true
          break
        }
      }
      if (found) {
        matched++
      }
    }
  }

  return matched / claimTokens.length
}

/**
 * Overlap score (backward-compatible signature).
 */
export function overlapScore(claim: string, evidenceText: string): number {
  const claimTokens = tokens(claim)
  if (claimTokens.length === 0) return 0

  const evidenceTokens = tokens(evidenceText)
  const evidenceTokenSet = expandTokensWithAliases(evidenceTokens)

  return overlapScoreWithTokenSet(claim, evidenceTokenSet)
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

/**
 * Scans candidate evidence for negation of the claim's core predicates or keywords.
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
  const evidenceSentences = candidateEvidence.split(/(?<=[.!?。！？\n])\s+/u)

  for (const sentence of evidenceSentences) {
    if (!NEGATION_PATTERN.test(sentence)) continue

    const words = sentence.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const cleanWord = words[i].replace(/[^\p{L}\p{N}]+/gu, '')
      if (NEGATION_PATTERN.test(cleanWord)) {
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

  // 7. Fast Overlap Score with precomputed token set
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

/**
 * Generates minimally corrected answer in the same language as input answer.
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

    if (c.classification === 'CONTRADICTED') {
      continue
    }

    if (
      c.classification === 'UNSUPPORTED' &&
      (c.claimType === 'personal_experience' || c.claimType === 'metric' || PERSONAL_PATTERN.test(s))
    ) {
      if (mode === 'strict') {
        continue
      }
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

// ─── TIER 2: LLM ENTAILMENT JUDGE (ASYNC PIPELINE) ──────────────────────────

interface LLMJudgeItem {
  claimId: string
  verdict: 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'GENERAL_KNOWLEDGE'
  reason: string
  confidence?: number
}

/**
 * Asynchronously evaluates candidate claims with LLM Judge (Layer 2).
 */
export async function validateAnswerGroundingAsync(
  input: GroundingInput
): Promise<GroundingResult> {
  const syncResult = validateAnswerGrounding(input)

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
  } catch {
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
