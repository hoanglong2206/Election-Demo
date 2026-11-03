import { truncateToTokenLimit } from './tokenBudget'
import { createStructuralChunks, chunkText, type StructuralChunk, type ChunkingOptions } from './chunking'
import { BM25Index, type BM25Config } from './bm25'
import { tokenizeFiltered, PROTECTED_TECH_TERMS, VI_STOPWORDS, EN_STOPWORDS } from './stopwords'
import type { DocumentSourceType, SourceDocument, DocumentChunk, RetrievalCitation, RetrievalDiagnostics } from './types'

export type { SourceDocument, DocumentChunk }
export { BM25Index, type BM25Config, tokenizeFiltered, PROTECTED_TECH_TERMS, VI_STOPWORDS, EN_STOPWORDS }

export interface EmbeddingProvider {
  readonly id: string
  embed(text: string): Promise<number[]>
}

export interface VectorStore {
  upsert(chunks: DocumentChunk[], embeddings: Map<string, number[]>): void
  removeDocument(documentId: string): void
  search(queryEmbedding: number[], limit: number): Array<{ chunk: DocumentChunk; embedding: number[] }>
  all(): DocumentChunk[]
}

export interface RetrievalResult {
  context: string
  citations: RetrievalCitation[]
  diagnostics: RetrievalDiagnostics
}

export interface LocalRagOptions {
  enabled?: boolean
  topK?: number
  tokenBudget?: number
  keywordWeight?: number
  sourceWeights?: Partial<Record<DocumentSourceType, number>>
}

const DEFAULT_SOURCE_WEIGHTS: Record<DocumentSourceType, number> = {
  cv: 1.25,
  job_description: 0.9,
  project: 1.15,
  portfolio_note: 1,
  company_research: 0.8,
  interview_note: 1.1,
}

function hash(text: string): string {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(16)
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}+#.-]+/gu) || []
}

export { createStructuralChunks, chunkText, type StructuralChunk, type ChunkingOptions }

export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local-hash-v1'

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(64).fill(0)
    for (const token of tokenize(text)) {
      vector[parseInt(hash(token), 16) % vector.length] += 1
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
    return vector.map((value) => value / magnitude)
  }
}

export class InMemoryVectorStore implements VectorStore {
  protected readonly chunks = new Map<string, { chunk: DocumentChunk; embedding: number[] }>()

  upsert(chunks: DocumentChunk[], embeddings: Map<string, number[]>): void {
    for (const chunk of chunks) {
      const embedding = embeddings.get(chunk.embeddingRef)
      if (embedding) this.chunks.set(chunk.chunkId, { chunk, embedding })
    }
  }

  removeDocument(documentId: string): void {
    for (const [chunkId, item] of this.chunks) {
      if (item.chunk.documentId === documentId) this.chunks.delete(chunkId)
    }
  }

  search(queryEmbedding: number[], limit: number): Array<{ chunk: DocumentChunk; embedding: number[] }> {
    return Array.from(this.chunks.values())
      .sort((a, b) => cosine(queryEmbedding, b.embedding) - cosine(queryEmbedding, a.embedding))
      .slice(0, limit)
  }

  all(): DocumentChunk[] {
    return Array.from(this.chunks.values()).map((item) => item.chunk)
  }
}

function cosine(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0)
}

export function keywordScore(query: string, text: string): number {
  const queryTokens = tokenizeFiltered(query)
  if (queryTokens.length === 0) return 0
  const textTokenSet = new Set(tokenizeFiltered(text))
  const matched = queryTokens.filter((token) => textTokenSet.has(token))
  return matched.length / queryTokens.length
}

export class LocalStorageVectorStore extends InMemoryVectorStore {
  private readonly storageKey: string

  constructor(storageKey = 'copilot.local-rag.v1') {
    super()
    this.storageKey = storageKey
    if (typeof localStorage === 'undefined') return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]') as Array<{ chunk: DocumentChunk; embedding: number[] }>
      super.upsert(saved.map((item) => item.chunk), new Map(saved.map((item) => [item.chunk.embeddingRef, item.embedding])))
    } catch (error) {
      console.warn('[LocalRAG] Failed to restore local vector index:', error)
    }
  }

  override upsert(chunks: DocumentChunk[], embeddings: Map<string, number[]>): void {
    super.upsert(chunks, embeddings)
    this.persist()
  }

  override removeDocument(documentId: string): void {
    super.removeDocument(documentId)
    this.persist()
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return
    try {
      const items = this.all().map((chunk) => ({
        chunk,
        embedding: Array.from(this.chunks.values()).find((item) => item.chunk.embeddingRef === chunk.embeddingRef)?.embedding,
      })).filter((item): item is { chunk: DocumentChunk; embedding: number[] } => Boolean(item.embedding))
      localStorage.setItem(this.storageKey, JSON.stringify(items))
    } catch (error) {
      console.warn('[LocalRAG] Failed to persist local vector index:', error)
    }
  }
}

export class LocalRagIndex {
  private readonly embeddingCache = new Map<string, number[]>()
  private readonly documentHashes = new Map<string, string>()
  private readonly embeddingProvider: EmbeddingProvider
  private readonly vectorStore: VectorStore
  private readonly bm25Index: BM25Index

  constructor(
    embeddingProvider: EmbeddingProvider = new LocalHashEmbeddingProvider(),
    vectorStore: VectorStore = new LocalStorageVectorStore(),
    bm25Index: BM25Index = new BM25Index(),
  ) {
    this.embeddingProvider = embeddingProvider
    this.vectorStore = vectorStore
    this.bm25Index = bm25Index

    // Rehydrate BM25 index if vector store already has existing chunks
    const existing = this.vectorStore.all()
    if (existing.length > 0) {
      this.bm25Index.build(existing)
    }
  }

  getBm25Index(): BM25Index {
    return this.bm25Index
  }

  async indexDocuments(documents: SourceDocument[]): Promise<void> {
    for (const document of documents) {
      const contentHash = hash(`${document.sourceType}:${document.section || ''}:${document.text}`)
      const existing = this.vectorStore.all().filter((chunk) => chunk.documentId === document.documentId)
      if (this.documentHashes.get(document.documentId) === contentHash ||
        (existing.length > 0 && existing.every((chunk) => chunk.contentHash === contentHash))) continue
      this.vectorStore.removeDocument(document.documentId)
      this.bm25Index.removeDocument(document.documentId)
      const structuralChunks = createStructuralChunks(document.text, {
        defaultSection: document.section,
      })
      const chunks = structuralChunks.map((sc, index) => ({
        chunkId: `${document.documentId}:${contentHash}:${index}`,
        documentId: document.documentId,
        sourceType: document.sourceType,
        section: sc.section || document.section,
        text: sc.text,
        tokenCount: sc.tokenCount,
        embeddingRef: hash(sc.text),
        contentHash,
      }))
      const embeddings = new Map<string, number[]>()
      for (const chunk of chunks) {
        let embedding = this.embeddingCache.get(chunk.embeddingRef)
        if (!embedding) {
          embedding = await this.embeddingProvider.embed(chunk.text)
          this.embeddingCache.set(chunk.embeddingRef, embedding)
        }
        embeddings.set(chunk.embeddingRef, embedding)
      }
      this.vectorStore.upsert(chunks, embeddings)
      this.bm25Index.upsert(chunks)
      this.documentHashes.set(document.documentId, contentHash)
    }
  }

  async query(query: string, options: LocalRagOptions = {}): Promise<RetrievalResult> {
    const topK = options.topK ?? 6
    const tokenBudget = options.tokenBudget ?? 1200
    const keywordWeight = options.keywordWeight ?? 0.35
    const sourceWeights = { ...DEFAULT_SOURCE_WEIGHTS, ...(options.sourceWeights || {}) }
    if (options.enabled === false || !query.trim()) {
      return { context: '', citations: [], diagnostics: { query, topResults: [], selectedTokenCount: 0 } }
    }
    const queryEmbedding = await this.embeddingProvider.embed(query)

    // Compute BM25 scores for corpus chunks
    const bm25Scores = this.bm25Index.scoreAll(query)

    // Pool candidates from Dense Vector Search
    const vectorCandidates = this.vectorStore.search(queryEmbedding, Math.max(topK * 4, 16))
    const candidateMap = new Map<string, { chunk: DocumentChunk; embedding: number[] }>()
    for (const item of vectorCandidates) {
      candidateMap.set(item.chunk.chunkId, item)
    }

    // Also pull top candidates from BM25 sparse search
    const allChunks = this.vectorStore.all()
    const chunkLookup = new Map<string, DocumentChunk>(allChunks.map((c) => [c.chunkId, c]))
    const topBm25List = this.bm25Index.search(query, Math.max(topK * 4, 16))
    for (const bmItem of topBm25List) {
      if (!candidateMap.has(bmItem.chunkId)) {
        const chunk = chunkLookup.get(bmItem.chunkId)
        if (chunk) {
          const emb = this.embeddingCache.get(chunk.embeddingRef) || []
          candidateMap.set(chunk.chunkId, { chunk, embedding: emb })
        }
      }
    }

    // Find max BM25 score among candidates for normalization to [0, 1]
    let maxBm25 = 0
    for (const { chunk } of candidateMap.values()) {
      const bScore = bm25Scores.get(chunk.chunkId) || 0
      if (bScore > maxBm25) maxBm25 = bScore
    }

    const scored = Array.from(candidateMap.values())
      .map(({ chunk, embedding }) => {
        const dense = embedding.length > 0 ? Math.max(0, cosine(queryEmbedding, embedding)) : 0
        const rawBm = bm25Scores.get(chunk.chunkId) || 0
        const normBm = maxBm25 > 0 ? rawBm / maxBm25 : 0
        const score = (dense * (1 - keywordWeight) + normBm * keywordWeight) *
          (sourceWeights[chunk.sourceType] || 1)
        return { chunk, score, dense, normBm }
      })
      .sort((a, b) => b.score - a.score)
    const selected: RetrievalCitation[] = []
    const seenHashes = new Set<string>()
    let selectedTokens = 0
    for (const item of scored) {
      if (selected.length >= topK || seenHashes.has(hash(item.chunk.text))) continue
      if (selectedTokens + item.chunk.tokenCount > tokenBudget) continue
      seenHashes.add(hash(item.chunk.text))
      selectedTokens += item.chunk.tokenCount
      selected.push({
        citationId: `citation_${selected.length + 1}`,
        chunkId: item.chunk.chunkId,
        documentId: item.chunk.documentId,
        sourceType: item.chunk.sourceType,
        section: item.chunk.section,
        source: item.chunk.section ? `${item.chunk.sourceType} (${item.chunk.section})` : item.chunk.sourceType,
        text: item.chunk.text,
        score: Number(item.score.toFixed(4)),
      })
    }
    const context = selected.map((citation) =>
      `[${citation.citationId} ${citation.sourceType}${citation.section ? ` / ${citation.section}` : ''}]\n${citation.text}`
    ).join('\n\n')
    return {
      context: truncateToTokenLimit(context, tokenBudget).text,
      citations: selected,
      diagnostics: {
        query,
        topResults: selected.map((citation) => ({
          chunkId: citation.chunkId,
          score: citation.score,
          sourceType: citation.sourceType,
        })),
        selectedTokenCount: selectedTokens,
      },
    }
  }

  getChunks(): DocumentChunk[] {
    return this.vectorStore.all()
  }
}

export function createInterviewDocuments(params: {
  cv?: string
  jobDescription?: string
  backgroundAnalysis?: string
  projects?: string[]
  portfolioNotes?: string
  companyResearch?: string
  interviewNotes?: string
}): SourceDocument[] {
  const documents: SourceDocument[] = []
  const add = (documentId: string, sourceType: DocumentSourceType, text?: string, section?: string) => {
    if (text?.trim()) documents.push({ documentId, sourceType, text, section })
  }
  add('cv', 'cv', params.cv, 'resume')
  add('job-description', 'job_description', params.jobDescription, 'requirements')
  add('background-analysis', 'interview_note', params.backgroundAnalysis, 'analysis')
  params.projects?.forEach((project, index) => add(`project-${index + 1}`, 'project', project, `project-${index + 1}`))
  add('portfolio-notes', 'portfolio_note', params.portfolioNotes, 'notes')
  add('company-research', 'company_research', params.companyResearch, 'research')
  add('interview-notes', 'interview_note', params.interviewNotes, 'notes')
  return documents
}

export const localRagIndex = new LocalRagIndex()
