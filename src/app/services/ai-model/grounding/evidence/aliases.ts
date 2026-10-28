import { stem } from '../text/normalize'
import { tokens } from '../text/tokens'

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
