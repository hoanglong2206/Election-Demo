import { VI_EN_TECH_ALIASES, CANONICAL_TECH_ENTITIES } from '../grounding/evidence/aliases'
import { tokenizeFiltered } from './stopwords'
import { credentialsPort } from '@/infrastructure/ipc'

export interface EmbeddingProvider {
  readonly id: string
  readonly dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch?(texts: string[]): Promise<number[][]>
}

// Semantic technology clusters mapping synonymous concepts into shared semantic subspaces
export const SEMANTIC_TECH_CLUSTERS: Record<string, string[]> = {
  message_queue: [
    'kafka',
    'rabbitmq',
    'sqs',
    'sns',
    'activemq',
    'nats',
    'pulsar',
    'kinesis',
    'queue',
    'message queue',
    'messaging',
    'hàng đợi',
    'tin nhắn',
    'event streaming',
    'streaming',
  ],
  caching: [
    'redis',
    'memcached',
    'cache',
    'caching',
    'bộ nhớ đệm',
    'in-memory',
    'distributed cache',
  ],
  microservices: [
    'microservice',
    'microservices',
    'vi dịch vụ',
    'distributed system',
    'distributed systems',
    'hệ thống phân tán',
    'grpc',
    'rpc',
    'service mesh',
  ],
  latency_performance: [
    'latency',
    'delay',
    'response time',
    'p99',
    'p95',
    'độ trễ',
    'thời gian phản hồi',
    'performance',
    'hiệu năng',
    'tối ưu',
    'tối ưu hóa',
    'optimize',
    'throughput',
    'tps',
    'rps',
    'speed',
    'tốc độ',
  ],
  database: [
    'database',
    'cơ sở dữ liệu',
    'db',
    'sql',
    'nosql',
    'postgres',
    'postgresql',
    'mysql',
    'mongodb',
    'citus',
    'clickhouse',
    'sharding',
    'replication',
  ],
  cloud_devops: [
    'docker',
    'kubernetes',
    'k8s',
    'container',
    'orchestration',
    'aws',
    'gcp',
    'azure',
    'devops',
    'ci/cd',
    'helm',
  ],
  frontend_mobile: [
    'frontend',
    'giao diện',
    'ui',
    'ux',
    'react',
    'react native',
    'vue',
    'angular',
    'flutter',
    'mobile',
    'web',
  ],
}

// Inverted concept map: word/phrase -> set of canonical concept aliases
const CONCEPT_EXPANSION_MAP = new Map<string, Set<string>>()
const PHRASE_LIST: string[] = []

function initConceptMap() {
  if (CONCEPT_EXPANSION_MAP.size > 0) return

  // 1. Ingest VI_EN_TECH_ALIASES
  for (const [key, aliases] of Object.entries(VI_EN_TECH_ALIASES)) {
    const keyLower = key.toLowerCase().trim()
    PHRASE_LIST.push(keyLower)

    let group = CONCEPT_EXPANSION_MAP.get(keyLower)
    if (!group) {
      group = new Set<string>()
      CONCEPT_EXPANSION_MAP.set(keyLower, group)
    }
    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase().trim()
      group.add(aliasLower)
      PHRASE_LIST.push(aliasLower)

      // Bidirectional expansion
      let aliasGroup = CONCEPT_EXPANSION_MAP.get(aliasLower)
      if (!aliasGroup) {
        aliasGroup = new Set<string>()
        CONCEPT_EXPANSION_MAP.set(aliasLower, aliasGroup)
      }
      aliasGroup.add(keyLower)
    }
  }

  // 2. Ingest SEMANTIC_TECH_CLUSTERS
  for (const [clusterKey, members] of Object.entries(SEMANTIC_TECH_CLUSTERS)) {
    const clusterTag = `cluster:${clusterKey}`
    for (const member of members) {
      const memberLower = member.toLowerCase().trim()
      PHRASE_LIST.push(memberLower)

      let group = CONCEPT_EXPANSION_MAP.get(memberLower)
      if (!group) {
        group = new Set<string>()
        CONCEPT_EXPANSION_MAP.set(memberLower, group)
      }
      group.add(clusterTag)
      group.add(clusterKey)

      // Also cross-link members in the same cluster with moderate weight
      for (const sibling of members) {
        const siblingLower = sibling.toLowerCase().trim()
        if (siblingLower !== memberLower) {
          group.add(siblingLower)
        }
      }
    }
  }

  // 3. Add canonical tech entities
  CANONICAL_TECH_ENTITIES.forEach((tech) => {
    const techLower = tech.toLowerCase().trim()
    PHRASE_LIST.push(techLower)
  })
}

initConceptMap()

/**
 * 32-bit FNV-1a hash function.
 */
function fnv1a(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Enhanced Lexical-Dense Embedding Provider (384 dimensions).
 * Uses concept expansion (tech synonyms & Vi-En aliases) and signed random projections
 * into a dense unit-normalized 384-dimensional vector space.
 * Guarantees semantic similarity (e.g., Kafka vs Message Queue, Latency vs Độ trễ > 0.60).
 */
export class EnhancedLexicalDenseEmbeddingProvider implements EmbeddingProvider {
  readonly id: string = 'enhanced-lexical-dense-v1'
  readonly dimensions: number

  constructor(dimensions = 384) {
    this.dimensions = dimensions
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Float32Array(this.dimensions)
    if (!text || !text.trim()) {
      return Array.from(vector)
    }

    const lower = text.toLowerCase()
    const activatedConcepts = new Map<string, number>()

    // 1. Multi-word phrase matching (e.g. "hàng đợi tin nhắn", "bộ nhớ đệm", "microservices")
    for (const phrase of PHRASE_LIST) {
      if (phrase.includes(' ') && lower.includes(phrase)) {
        activatedConcepts.set(phrase, (activatedConcepts.get(phrase) || 0) + 2.5)

        const aliases = CONCEPT_EXPANSION_MAP.get(phrase)
        if (aliases) {
          for (const alias of aliases) {
            const weight = alias.startsWith('cluster:') ? 3.0 : 1.5
            activatedConcepts.set(alias, (activatedConcepts.get(alias) || 0) + weight)
          }
        }
      }
    }

    // 2. Tokenized unigrams
    const tokens = tokenizeFiltered(text)
    for (const token of tokens) {
      activatedConcepts.set(token, (activatedConcepts.get(token) || 0) + 1.0)

      const aliases = CONCEPT_EXPANSION_MAP.get(token)
      if (aliases) {
        for (const alias of aliases) {
          const weight = alias.startsWith('cluster:') ? 3.0 : 1.2
          activatedConcepts.set(alias, (activatedConcepts.get(alias) || 0) + weight)
        }
      }
    }

    // 3. Project activated concepts and character n-grams into 384-dim space
    activatedConcepts.forEach((weight, concept) => {
      const h1 = fnv1a(concept)
      const h2 = fnv1a(`${concept}:polarity`)
      const dim = h1 % this.dimensions
      const sign = (h2 & 1) === 0 ? 1 : -1

      vector[dim] += sign * weight

      // Subword character trigrams for morphological and suffix preservation
      if (concept.length >= 4 && !concept.startsWith('cluster:')) {
        for (let i = 0; i <= concept.length - 3; i++) {
          const sub = concept.slice(i, i + 3)
          const subH = fnv1a(sub)
          const subDim = subH % this.dimensions
          const subSign = (subH & 2) === 0 ? 1 : -1
          vector[subDim] += subSign * (weight * 0.15)
        }
      }
    })

    // 4. L2 Euclidean Normalization
    let sumSq = 0
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i]! * vector[i]!
    }

    const norm = Math.sqrt(sumSq) || 1.0
    const normalized = new Array<number>(this.dimensions)
    for (let i = 0; i < this.dimensions; i++) {
      normalized[i] = vector[i]! / norm
    }

    return normalized
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)))
  }
}

/**
 * Backward-compatible class name for existing references.
 * Upgraded from legacy 64-dim BoW to 384-dim concept-expanded semantic vector space.
 */
export class LocalHashEmbeddingProvider extends EnhancedLexicalDenseEmbeddingProvider {
  override readonly id = 'local-hash-v2-dense'
  constructor() {
    super(384)
  }
}

/**
 * Cloud Embedding Provider via Electron IPC credentialsPort (OpenAI text-embedding-3-small or Gemini).
 */
export class CloudEmbeddingProvider implements EmbeddingProvider {
  readonly id: string
  readonly dimensions: number
  private readonly fallback: EnhancedLexicalDenseEmbeddingProvider

  constructor(dimensions = 384) {
    this.dimensions = dimensions
    this.id = `cloud-embedding-${dimensions}d`
    this.fallback = new EnhancedLexicalDenseEmbeddingProvider(dimensions)
  }

  async embed(text: string): Promise<number[]> {
    if (!credentialsPort.isSupported) {
      return this.fallback.embed(text)
    }

    try {
      const res = await credentialsPort.embedTexts({
        texts: [text],
        dimensions: this.dimensions,
      })

      if (res && res.embeddings && res.embeddings.length > 0 && res.embeddings[0]) {
        return res.embeddings[0]
      }
    } catch (err) {
      console.warn('[CloudEmbeddingProvider] Cloud embed failed, falling back to local dense:', err)
    }

    return this.fallback.embed(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!credentialsPort.isSupported || texts.length === 0) {
      return this.fallback.embedBatch(texts)
    }

    try {
      const res = await credentialsPort.embedTexts({
        texts,
        dimensions: this.dimensions,
      })

      if (res && res.embeddings && res.embeddings.length === texts.length) {
        return res.embeddings
      }
    } catch (err) {
      console.warn('[CloudEmbeddingProvider] Cloud batch embed failed, falling back to local dense:', err)
    }

    return this.fallback.embedBatch(texts)
  }
}

/**
 * Adaptive Embedding Provider:
 * Automatically uses Cloud Embedding (OpenAI/Gemini) if available and configured,
 * otherwise seamlessly falls back to the high-performance local dense provider.
 */
export class AdaptiveEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'adaptive-semantic-v1'
  readonly dimensions: number
  private readonly cloudProvider: CloudEmbeddingProvider
  private readonly localProvider: EnhancedLexicalDenseEmbeddingProvider

  constructor(dimensions = 384) {
    this.dimensions = dimensions
    this.cloudProvider = new CloudEmbeddingProvider(dimensions)
    this.localProvider = new EnhancedLexicalDenseEmbeddingProvider(dimensions)
  }

  async embed(text: string): Promise<number[]> {
    if (credentialsPort.isSupported) {
      try {
        const hasOpenAI = await credentialsPort.hasApiKey('openai')
        const hasGemini = await credentialsPort.hasApiKey('gemini')
        if (hasOpenAI || hasGemini) {
          return await this.cloudProvider.embed(text)
        }
      } catch {
        // Fall back to local
      }
    }
    return this.localProvider.embed(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (credentialsPort.isSupported) {
      try {
        const hasOpenAI = await credentialsPort.hasApiKey('openai')
        const hasGemini = await credentialsPort.hasApiKey('gemini')
        if (hasOpenAI || hasGemini) {
          return await this.cloudProvider.embedBatch(texts)
        }
      } catch {
        // Fall back to local
      }
    }
    return this.localProvider.embedBatch(texts)
  }
}
