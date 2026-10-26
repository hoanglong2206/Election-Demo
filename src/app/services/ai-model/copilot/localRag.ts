import { estimateTokenCount, truncateToTokenLimit } from './contextManager'

export type DocumentSourceType =
  | 'cv'
  | 'job_description'
  | 'project'
  | 'portfolio_note'
  | 'company_research'
  | 'interview_note'

export interface SourceDocument {
  documentId: string
  sourceType: DocumentSourceType
  text: string
  section?: string
  updatedAt?: number
}

export interface DocumentChunk {
  chunkId: string
  documentId: string
  sourceType: DocumentSourceType
  section?: string
  text: string
  tokenCount: number
  embeddingRef: string
  contentHash: string
}

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

export interface RetrievalCitation {
  citationId: string
  chunkId: string
  documentId: string
  sourceType: DocumentSourceType
  section?: string
  source?: string
  text: string
  score: number
}

export interface RetrievalDiagnostics {
  query: string
  topResults: Array<{ chunkId: string; score: number; sourceType: DocumentSourceType }>
  selectedTokenCount: number
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

function chunkText(text: string, maxChars = 900): string[] {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  for (const paragraph of paragraphs.length > 0 ? paragraphs : [text.trim()]) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph)
      continue
    }
    for (let start = 0; start < paragraph.length; start += maxChars) {
      chunks.push(paragraph.slice(start, start + maxChars).trim())
    }
  }
  return chunks.filter(Boolean)
}

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

function keywordScore(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return 0
  const matched = tokenize(text).filter((token) => queryTokens.has(token))
  return new Set(matched).size / queryTokens.size
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

  constructor(
    embeddingProvider: EmbeddingProvider = new LocalHashEmbeddingProvider(),
    vectorStore: VectorStore = new LocalStorageVectorStore(),
  ) {
    this.embeddingProvider = embeddingProvider
    this.vectorStore = vectorStore
  }

  async indexDocuments(documents: SourceDocument[]): Promise<void> {
    for (const document of documents) {
      const contentHash = hash(`${document.sourceType}:${document.section || ''}:${document.text}`)
      const existing = this.vectorStore.all().filter((chunk) => chunk.documentId === document.documentId)
      if (this.documentHashes.get(document.documentId) === contentHash ||
        (existing.length > 0 && existing.every((chunk) => chunk.contentHash === contentHash))) continue
      this.vectorStore.removeDocument(document.documentId)
      const chunks = chunkText(document.text).map((text, index) => ({
        chunkId: `${document.documentId}:${contentHash}:${index}`,
        documentId: document.documentId,
        sourceType: document.sourceType,
        section: document.section,
        text,
        tokenCount: estimateTokenCount(text),
        embeddingRef: hash(text),
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
    const scored = this.vectorStore.search(queryEmbedding, Math.max(topK * 4, 12))
      .map(({ chunk, embedding }) => ({
        chunk,
        score: (cosine(queryEmbedding, embedding) * (1 - keywordWeight) + keywordScore(query, chunk.text) * keywordWeight) *
          (sourceWeights[chunk.sourceType] || 1),
      }))
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
