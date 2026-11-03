import { tokenizeFiltered } from './stopwords'
import type { DocumentChunk } from './types'

export interface BM25Config {
  k1?: number // Controls term frequency saturation (default 1.2)
  b?: number // Controls document length normalization (default 0.75)
}

export class BM25Index {
  private readonly k1: number
  private readonly b: number

  // chunkId -> token count of the chunk
  private readonly docLengths = new Map<string, number>()
  // chunkId -> documentId
  private readonly chunkToDocId = new Map<string, string>()
  // term -> Map<chunkId, termFrequency>
  private readonly invertedIndex = new Map<string, Map<string, number>>()

  private docCount = 0
  private avgDocLength = 0

  constructor(config: BM25Config = {}) {
    this.k1 = config.k1 ?? 1.2
    this.b = config.b ?? 0.75
  }

  /**
   * Clears and builds the index from a list of DocumentChunks.
   */
  build(chunks: DocumentChunk[]): void {
    this.clear()
    this.upsert(chunks)
  }

  /**
   * Adds or updates chunks in the inverted index.
   */
  upsert(chunks: DocumentChunk[]): void {
    if (chunks.length === 0) return

    for (const chunk of chunks) {
      // Remove previous entry for this chunkId if exists
      if (this.docLengths.has(chunk.chunkId)) {
        this.removeChunk(chunk.chunkId)
      }

      const tokens = tokenizeFiltered(chunk.text)
      const length = Math.max(1, tokens.length)
      this.docLengths.set(chunk.chunkId, length)
      this.chunkToDocId.set(chunk.chunkId, chunk.documentId)

      // Count term frequencies within chunk
      const tfMap = new Map<string, number>()
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1)
      }

      for (const [term, freq] of tfMap) {
        let postings = this.invertedIndex.get(term)
        if (!postings) {
          postings = new Map<string, number>()
          this.invertedIndex.set(term, postings)
        }
        postings.set(chunk.chunkId, freq)
      }
    }

    this.recomputeStats()
  }

  /**
   * Removes all chunks belonging to a specific documentId.
   */
  removeDocument(documentId: string): void {
    const chunkIdsToRemove: string[] = []
    for (const [chunkId, docId] of this.chunkToDocId) {
      if (docId === documentId) {
        chunkIdsToRemove.push(chunkId)
      }
    }

    for (const chunkId of chunkIdsToRemove) {
      this.removeChunk(chunkId)
    }

    this.recomputeStats()
  }

  /**
   * Clears the entire index.
   */
  clear(): void {
    this.docLengths.clear()
    this.chunkToDocId.clear()
    this.invertedIndex.clear()
    this.docCount = 0
    this.avgDocLength = 0
  }

  /**
   * Computes Robertson-Spärck Jones IDF for a query term.
   * IDF(q) = ln(1 + (N - n(q) + 0.5) / (n(q) + 0.5))
   */
  idf(term: string): number {
    const postings = this.invertedIndex.get(term)
    const n = postings ? postings.size : 0
    const N = Math.max(1, this.docCount)
    return Math.log(1 + (N - n + 0.5) / (n + 0.5))
  }

  /**
   * Scores a single chunk against a list of pre-tokenized query terms.
   */
  scoreChunk(queryTokens: string[], chunkId: string): number {
    const docLen = this.docLengths.get(chunkId)
    if (!docLen || this.avgDocLength === 0) return 0

    let totalScore = 0
    const lenNorm = 1 - this.b + this.b * (docLen / this.avgDocLength)

    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term)
      if (!postings) continue

      const tf = postings.get(chunkId)
      if (!tf || tf <= 0) continue

      const idfWeight = this.idf(term)
      const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * lenNorm)
      totalScore += idfWeight * tfNorm
    }

    return totalScore
  }

  /**
   * Computes BM25 scores for all matching chunks for a given query text.
   * Returns Map<chunkId, rawBM25Score>.
   */
  scoreAll(query: string): Map<string, number> {
    const queryTokens = tokenizeFiltered(query)
    const scores = new Map<string, number>()
    if (queryTokens.length === 0 || this.docCount === 0) return scores

    // Candidate chunks that contain at least one query term
    const candidates = new Set<string>()
    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term)
      if (postings) {
        for (const chunkId of postings.keys()) {
          candidates.add(chunkId)
        }
      }
    }

    for (const chunkId of candidates) {
      const score = this.scoreChunk(queryTokens, chunkId)
      if (score > 0) {
        scores.set(chunkId, score)
      }
    }

    return scores
  }

  /**
   * Searches top-K chunks by BM25 score.
   */
  search(query: string, limit = 10): Array<{ chunkId: string; score: number }> {
    const scores = this.scoreAll(query)
    return Array.from(scores.entries())
      .map(([chunkId, score]) => ({ chunkId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  getDocCount(): number {
    return this.docCount
  }

  getAvgDocLength(): number {
    return this.avgDocLength
  }

  private removeChunk(chunkId: string): void {
    this.docLengths.delete(chunkId)
    this.chunkToDocId.delete(chunkId)

    for (const [term, postings] of this.invertedIndex) {
      if (postings.has(chunkId)) {
        postings.delete(chunkId)
        if (postings.size === 0) {
          this.invertedIndex.delete(term)
        }
      }
    }
  }

  private recomputeStats(): void {
    this.docCount = this.docLengths.size
    if (this.docCount === 0) {
      this.avgDocLength = 0
      return
    }

    let totalLen = 0
    for (const len of this.docLengths.values()) {
      totalLen += len
    }
    this.avgDocLength = totalLen / this.docCount
  }
}
