/**
 * FactSheet Extraction & Caching (Layer 0 for Answer Grounding)
 * Extracts structured facts from candidate CV and profile once, caching by content hash.
 * Provides fast, deterministic fact checking for metrics, dates, companies, roles, and tech stack.
 */

export interface MetricFact {
  rawValue: string
  number: number
  unit?: string
  context: string
  sourceRef: string
}

export interface DirectedRelationFact {
  type: 'migration' | 'transition' | 'integration'
  from: string
  to: string
  rawText: string
  sourceRef: string
}

export interface CandidateFactSheet {
  contentHash: string
  companies: string[]
  roles: string[]
  techStack: Set<string>
  metrics: MetricFact[]
  directedRelations: DirectedRelationFact[]
  yearCounts: number[]
  sourceExcerpts: Array<{ id: string; source: 'cv' | 'profile'; text: string }>
}

const factSheetCache = new Map<string, CandidateFactSheet>()

/**
 * Fast djb2 string hash for cache keys
 */
export function computeContentHash(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

const KNOWN_TECH_KEYWORDS = [
  'react', 'react native', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
  'node.js', 'nodejs', 'express', 'nest.js', 'nestjs', 'fastapi', 'django', 'flask',
  'python', 'java', 'golang', 'go', 'rust', 'c#', 'c++', 'typescript', 'javascript', 'php', 'ruby',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'sqlite',
  'kafka', 'rabbitmq', 'sqs', 'sns', 'grpc', 'graphql', 'rest', 'websocket',
  'docker', 'kubernetes', 'k8s', 'aws', 'gcp', 'azure', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions',
  'linux', 'git', 'microservices', 'distributed systems', 'system design',
]

const KNOWN_ROLES = [
  'frontend', 'front-end', 'backend', 'back-end', 'fullstack', 'full-stack',
  'tech lead', 'team lead', 'lead engineer', 'engineering manager', 'senior engineer',
  'software engineer', 'developer', 'architect', 'devops', 'sre', 'qa', 'qc', 'tester',
  'data engineer', 'product manager', 'intern', 'fresher', 'junior',
]

/**
 * Extracts candidate FactSheet from CV and profile texts.
 * Results are cached in-memory by hash of combined content.
 */
export function extractFactSheet(cv?: string, profile?: string): CandidateFactSheet {
  const combined = [cv || '', profile || ''].join('\n---\n').trim()
  const contentHash = computeContentHash(combined)

  const cached = factSheetCache.get(contentHash)
  if (cached) return cached

  const companies: string[] = []
  const roles: string[] = []
  const techStack = new Set<string>()
  const metrics: MetricFact[] = []
  const directedRelations: DirectedRelationFact[] = []
  const yearCounts: number[] = []

  const sourceExcerpts: Array<{ id: string; source: 'cv' | 'profile'; text: string }> = []
  if (cv?.trim()) sourceExcerpts.push({ id: 'cv_source', source: 'cv', text: cv.trim() })
  if (profile?.trim()) sourceExcerpts.push({ id: 'profile_source', source: 'profile', text: profile.trim() })

  const lines = combined.split('\n').map((l) => l.trim()).filter(Boolean)

  // 1. Extract tech stack (case-insensitive keyword search)
  const combinedLower = combined.toLowerCase()
  for (const tech of KNOWN_TECH_KEYWORDS) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
    if (regex.test(combinedLower)) {
      techStack.add(tech.toLowerCase())
    }
  }

  // 2. Extract roles
  for (const role of KNOWN_ROLES) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
    if (regex.test(combinedLower)) {
      roles.push(role)
    }
  }

  // 3. Extract metrics and numbers from sentences
  const metricRegex = /(?<!\p{L})(\d+(?:\.\d+)?)\s*(%|percent|năm|years?|months?|tháng|members?|thành viên|engineers?|kỹ sư|people|người|triệu|million|k|m|ms|s|giây|req\/s|rps)?(?!\p{L})/giu

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    let match: RegExpExecArray | null
    while ((match = metricRegex.exec(line)) !== null) {
      const numStr = match[1]
      const unit = (match[2] || '').toLowerCase()
      const num = parseFloat(numStr)
      if (!isNaN(num)) {
        metrics.push({
          rawValue: match[0],
          number: num,
          unit: unit || undefined,
          context: line,
          sourceRef: `line_${idx}`,
        })
        if (unit.startsWith('năm') || unit.startsWith('year')) {
          yearCounts.push(num)
        }
      }
    }
  }

  // 4. Extract directed relations (e.g. "migrated our infrastructure from Kafka to RabbitMQ", "chuyển từ MySQL sang PostgreSQL")
  const relationRegex = /(?:migrat(?:e|ed|ing|ion)?|chuyển|chuyển đổi|nâng cấp|move[d]?|transition(?:ed)?)\s+[\s\S]*?\b(?:from|từ)\s+([\p{L}\p{N}.-]+)\s+(?:to|into|sang|qua)\s+(?:a\s+|an\s+)?([\p{L}\p{N}.-]+)/giu
  for (const line of lines) {
    let match: RegExpExecArray | null
    while ((match = relationRegex.exec(line)) !== null) {
      const from = match[1].toLowerCase().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim()
      const to = match[2].toLowerCase().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim()
      directedRelations.push({
        type: 'migration',
        from,
        to,
        rawText: match[0],
        sourceRef: line,
      })
    }
  }

  // Also match arrows like "Kafka -> RabbitMQ" or "Kafka → RabbitMQ"
  const arrowRegex = /([\p{L}\p{N}.-]+)\s*(?:->|→|==>|chuyển sang)\s*([\p{L}\p{N}.-]+)/giu
  for (const line of lines) {
    let match: RegExpExecArray | null
    while ((match = arrowRegex.exec(line)) !== null) {
      const from = match[1].toLowerCase().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim()
      const to = match[2].toLowerCase().replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim()
      if (from !== to && from.length > 1 && to.length > 1) {
        directedRelations.push({
          type: 'migration',
          from,
          to,
          rawText: match[0],
          sourceRef: line,
        })
      }
    }
  }

  // 5. Extract company mentions (heuristic: lines with Company/Corp/Inc/JSC/Ltd or Capitalized names with dates)
  const companyRegex = /(?:tại|at|for|công ty|company)\s+([A-Z\p{Lu}][\p{L}\p{N}\s&.-]{2,30}?)(?=[,.\n\r(]|\s+từ|\s+from|\s+as|\s+với|$)/gu
  for (const line of lines) {
    let match: RegExpExecArray | null
    while ((match = companyRegex.exec(line)) !== null) {
      const company = match[1].trim()
      if (company.length > 1 && !companies.includes(company)) {
        companies.push(company)
      }
    }
  }

  const factSheet: CandidateFactSheet = {
    contentHash,
    companies,
    roles: Array.from(new Set(roles)),
    techStack,
    metrics,
    directedRelations,
    yearCounts,
    sourceExcerpts,
  }

  factSheetCache.set(contentHash, factSheet)
  return factSheet
}

/**
 * Clear cache (for testing or profile changes)
 */
export function clearFactSheetCache(): void {
  factSheetCache.clear()
}
