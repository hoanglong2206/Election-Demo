import { describe, expect, it } from 'bun:test'
import { tokenizeFiltered } from '../stopwords'
import { BM25Index } from '../bm25'
import { LocalRagIndex } from '../localRag'
import type { SourceDocument } from '../types'

describe('Task 2: Okapi BM25 Index & Hybrid Search', () => {
  describe('Stopwords & Token Filtering', () => {
    it('filters common Vietnamese and English stopwords while keeping key terms', () => {
      const text = 'Tôi và anh ấy đã phát triển các microservices cho hệ thống thanh toán'
      const tokens = tokenizeFiltered(text)

      expect(tokens).not.toContain('tôi')
      expect(tokens).not.toContain('và')
      expect(tokens).not.toContain('đã')
      expect(tokens).not.toContain('các')
      expect(tokens).not.toContain('cho')

      expect(tokens).toContain('phát')
      expect(tokens).toContain('triển')
      expect(tokens).toContain('microservices')
      expect(tokens).toContain('thanh')
      expect(tokens).toContain('toán')
    })

    it('strictly preserves protected short tech terms and metrics', () => {
      const text = 'Built an AI pipeline using Go and C# deploying to K8s with 99.99% uptime in 4ms'
      const tokens = tokenizeFiltered(text)

      expect(tokens).toContain('ai')
      expect(tokens).toContain('go')
      expect(tokens).toContain('c#')
      expect(tokens).toContain('k8s')
      expect(tokens).toContain('99.99%')
      expect(tokens).toContain('4ms')
      expect(tokens).not.toContain('an')
      expect(tokens).not.toContain('and')
      expect(tokens).not.toContain('with')
      expect(tokens).not.toContain('in')
    })
  })

  describe('BM25 Algorithm & IDF Weighting', () => {
    it('assigns higher IDF weight to rare technical terms than common terms', () => {
      const bm25 = new BM25Index()
      const chunks = [
        {
          chunkId: 'c1',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Phát triển hệ thống backend xử lý dữ liệu với ClickHouse và Kafka.',
          tokenCount: 15,
          embeddingRef: 'h1',
          contentHash: 'h1',
        },
        {
          chunkId: 'c2',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Phát triển hệ thống frontend quản lý người dùng với React và Redux.',
          tokenCount: 14,
          embeddingRef: 'h2',
          contentHash: 'h2',
        },
        {
          chunkId: 'c3',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Phát triển hệ thống API mobile cho người dùng cuối.',
          tokenCount: 12,
          embeddingRef: 'h3',
          contentHash: 'h3',
        },
      ]

      bm25.build(chunks)

      // "phát", "triển", "hệ", "thống" appear in all 3 chunks (common)
      // "clickhouse" appears in only 1 chunk (rare)
      const commonIdf = bm25.idf('phát')
      const rareIdf = bm25.idf('clickhouse')

      expect(rareIdf).toBeGreaterThan(commonIdf)
      expect(rareIdf).toBeGreaterThan(0.8)
    })

    it('ranks the chunk containing the exact rare keyword at the top', () => {
      const bm25 = new BM25Index()
      const chunks = [
        {
          chunkId: 'c_general_1',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Kỹ sư phần mềm phát triển hệ thống phân tán chịu tải cao.',
          tokenCount: 14,
          embeddingRef: 'h1',
          contentHash: 'h1',
        },
        {
          chunkId: 'c_paxos',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Nghiên cứu và hiện thực hóa thuật toán đồng thuận Paxos cho phân tán cơ sở dữ liệu.',
          tokenCount: 18,
          embeddingRef: 'h2',
          contentHash: 'h2',
        },
        {
          chunkId: 'c_general_2',
          documentId: 'd1',
          sourceType: 'cv' as const,
          text: 'Quản lý cơ sở dữ liệu và tối ưu hóa hệ thống backend.',
          tokenCount: 13,
          embeddingRef: 'h3',
          contentHash: 'h3',
        },
      ]

      bm25.build(chunks)
      const results = bm25.search('thuật toán đồng thuận Paxos')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.chunkId).toBe('c_paxos')
      expect(results[0]?.score).toBeGreaterThan(1.0)
    })

    it('correctly updates index when removing a document', () => {
      const bm25 = new BM25Index()
      const chunks = [
        {
          chunkId: 'c1',
          documentId: 'doc_to_keep',
          sourceType: 'cv' as const,
          text: 'Lập trình viên Golang.',
          tokenCount: 4,
          embeddingRef: 'h1',
          contentHash: 'h1',
        },
        {
          chunkId: 'c2',
          documentId: 'doc_to_delete',
          sourceType: 'cv' as const,
          text: 'Lập trình viên Rust và WebAssembly.',
          tokenCount: 6,
          embeddingRef: 'h2',
          contentHash: 'h2',
        },
      ]

      bm25.build(chunks)
      expect(bm25.getDocCount()).toBe(2)
      expect(bm25.scoreAll('Rust').has('c2')).toBe(true)

      bm25.removeDocument('doc_to_delete')
      expect(bm25.getDocCount()).toBe(1)
      expect(bm25.scoreAll('Rust').has('c2')).toBe(false)
    })
  })

  describe('LocalRagIndex Hybrid Search Integration', () => {
    it('hybrid search boosts specific technical keyword queries to top citations', async () => {
      const index = new LocalRagIndex()
      const documents: SourceDocument[] = [
        {
          documentId: 'cv_candidate',
          sourceType: 'cv',
          section: 'Kinh nghiệm làm việc',
          text: `
## Dự án tiêu biểu

### Distributed Cache Accelerator
- Tối ưu hóa Redis Cluster và Memcached.
- Đạt P99 latency dưới 5ms cho 200,000 RPS.

### Message Streaming Hub
- Thiết kế luồng xử lý Kafka và RabbitMQ.
- Xử lý 100,000 tin nhắn mỗi giây với đảm bảo Exactly-Once Delivery.

### Database Migration
- Chuyển đổi dữ liệu từ MySQL sang PostgreSQL Citus.
- Thực hiện database sharding cho 500 triệu bản ghi.
`,
        },
      ]

      await index.indexDocuments(documents)

      // Query for Redis and latency
      const redisResult = await index.query('Làm thế nào bạn tối ưu Redis Cluster và P99 latency?')
      expect(redisResult.citations.length).toBeGreaterThan(0)
      expect(redisResult.citations[0]?.text).toContain('Redis Cluster')

      // Query for Kafka
      const kafkaResult = await index.query('Kinh nghiệm xử lý Exactly-Once Delivery với Kafka?')
      expect(kafkaResult.citations.length).toBeGreaterThan(0)
      expect(kafkaResult.citations[0]?.text).toContain('Kafka')
      expect(kafkaResult.citations[0]?.text).toContain('Exactly-Once')
    })
  })
})
