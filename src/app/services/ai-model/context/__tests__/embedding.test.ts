import { describe, expect, it } from 'bun:test'
import {
  EnhancedLexicalDenseEmbeddingProvider,
  LocalHashEmbeddingProvider,
  CloudEmbeddingProvider,
  AdaptiveEmbeddingProvider,
} from '../embedding'
import { LocalRagIndex, cosine } from '../localRag'
import type { SourceDocument } from '../types'

describe('Task 1: Semantic Vector Embedding & Adaptive Provider', () => {
  const provider = new EnhancedLexicalDenseEmbeddingProvider(384)

  it('produces 384-dimensional unit-normalized L2 vectors', async () => {
    const text = 'Thiết kế kiến trúc hệ thống phân tán microservices'
    const vec = await provider.embed(text)

    expect(vec.length).toBe(384)

    // Calculate L2 norm
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeGreaterThan(0.99)
    expect(norm).toBeLessThan(1.01)
  })

  it('proves semantic understanding between synonyms and cross-lingual concepts', async () => {
    // 1. "Kafka" vs "Hàng đợi tin nhắn" (Message Queue)
    const vecKafka = await provider.embed('Kafka')
    const vecQueue = await provider.embed('Hàng đợi tin nhắn')
    const simKafkaQueue = cosine(vecKafka, vecQueue)

    // 2. "Độ trễ" vs "Latency"
    const vecLatencyVi = await provider.embed('Độ trễ hệ thống')
    const vecLatencyEn = await provider.embed('System latency')
    const simLatency = cosine(vecLatencyVi, vecLatencyEn)

    // 3. "Redis" vs "Bộ nhớ đệm" (Cache)
    const vecRedis = await provider.embed('Redis')
    const vecCache = await provider.embed('Bộ nhớ đệm cache')
    const simRedisCache = cosine(vecRedis, vecCache)

    // 4. "Vi dịch vụ" vs "Microservices"
    const vecViDichVu = await provider.embed('Kiến trúc vi dịch vụ')
    const vecMicroservices = await provider.embed('Microservices architecture')
    const simMicro = cosine(vecViDichVu, vecMicroservices)

    // 5. Unrelated concept comparison
    const vecCooking = await provider.embed('Học nấu ăn và làm bánh ngọt')
    const simUnrelated = cosine(vecKafka, vecCooking)

    // Semantic pairs must have strong similarity (> 0.50), while unrelated is near 0 (< 0.15)
    expect(simKafkaQueue).toBeGreaterThan(0.55)
    expect(simLatency).toBeGreaterThan(0.55)
    expect(simRedisCache).toBeGreaterThan(0.55)
    expect(simMicro).toBeGreaterThan(0.55)
    expect(simUnrelated).toBeLessThan(0.15)
  })

  it('LocalHashEmbeddingProvider is upgraded to 384-dim semantic provider', async () => {
    const legacyCompatible = new LocalHashEmbeddingProvider()
    expect(legacyCompatible.dimensions).toBe(384)

    const vec = await legacyCompatible.embed('Golang development')
    expect(vec.length).toBe(384)
  })

  it('AdaptiveEmbeddingProvider supports batch embedding', async () => {
    const adaptive = new AdaptiveEmbeddingProvider(384)
    const batch = await adaptive.embedBatch([
      'Frontend developer with React and Vue',
      'Backend developer with Node.js and Postgres',
    ])

    expect(batch.length).toBe(2)
    expect(batch[0]?.length).toBe(384)
    expect(batch[1]?.length).toBe(384)
  })

  it('CloudEmbeddingProvider gracefully falls back to local dense when offline', async () => {
    const cloud = new CloudEmbeddingProvider(384)
    const vec = await cloud.embed('Tối ưu hóa hiệu năng cơ sở dữ liệu')

    expect(vec.length).toBe(384)
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeGreaterThan(0.99)
  })

  it('End-to-End: synonym query retrieves relevant project even without exact keyword match', async () => {
    const index = new LocalRagIndex(new EnhancedLexicalDenseEmbeddingProvider(384))
    const docs: SourceDocument[] = [
      {
        documentId: 'doc_kafka_project',
        sourceType: 'cv',
        section: 'Kinh nghiệm làm việc',
        text: `
## Dự án tiêu biểu
### Event Streaming Pipeline
- Triển khai cụm Kafka chịu tải 50,000 sự kiện mỗi giây.
- Đảm bảo tính toàn vẹn dữ liệu và phân vùng topic hợp lý.
`,
      },
      {
        documentId: 'doc_other_project',
        sourceType: 'cv',
        section: 'Kinh nghiệm làm việc',
        text: `
## Dự án tiêu biểu
### Mobile UI Development
- Xây dựng giao diện ứng dụng di động bằng React Native và Flutter.
- Thiết kế trải nghiệm người dùng tối ưu trên iOS và Android.
`,
      },
    ]

    await index.indexDocuments(docs)

    // Query uses the synonym concept "hàng đợi tin nhắn" instead of the literal word "Kafka"
    const result = await index.query('Kinh nghiệm của bạn với các hệ thống hàng đợi tin nhắn (Message Queue)?')

    expect(result.citations.length).toBeGreaterThan(0)
    // The Kafka project chunk must be retrieved at Rank 1 due to semantic understanding!
    expect(result.citations[0]?.text).toContain('Event Streaming Pipeline')
    expect(result.citations[0]?.text).toContain('Kafka')
  })
})

