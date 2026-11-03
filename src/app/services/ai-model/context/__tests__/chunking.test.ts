import { describe, expect, it } from 'bun:test'
import {
  createStructuralChunks,
  chunkText,
} from '../chunking'
import { LocalRagIndex, type SourceDocument } from '../localRag'

describe('Task 3: Semantic Markdown & CV Structural Chunking', () => {
  it('detects Markdown headings (#, ##, ###) and groups content hierarchically', () => {
    const cvText = `
# NGUYỄN VĂN A - SENIOR BACKEND ENGINEER

## Tóm tắt chuyên môn
Có 6 năm kinh nghiệm thiết kế hệ thống phân tán, xử lý hàng triệu requests mỗi ngày.

## Kinh nghiệm làm việc
### Tech Lead tại TechCorp (2021 - 2024)
- Xây dựng hệ thống microservices xử lý 45,000 TPS.
- Tối ưu hóa database PostgreSQL giảm 40% latency.

### Backend Developer tại StartupX (2018 - 2021)
- Phát triển API gateway sử dụng Golang và gRPC.
- Quản lý cache Redis và hàng đợi RabbitMQ.

## Kỹ năng chuyên môn
Golang, Java, Kubernetes, Docker, Kafka, PostgreSQL, MongoDB.
`
    const chunks = createStructuralChunks(cvText)
    expect(chunks.length).toBeGreaterThanOrEqual(4)

    // Check that TechCorp project entity chunk has injected context header
    const techCorpChunk = chunks.find((c) => c.text.includes('TechCorp'))
    expect(techCorpChunk).toBeDefined()
    expect(techCorpChunk?.section).toContain('Kinh nghiệm làm việc')
    expect(techCorpChunk?.section).toContain('Tech Lead tại TechCorp')
    expect(techCorpChunk?.contextHeader).toContain('Kinh nghiệm làm việc')
    expect(techCorpChunk?.contextHeader).toContain('Tech Lead tại TechCorp')
    expect(techCorpChunk?.text.startsWith('[Ngữ cảnh:')).toBe(true)

    // Check that StartupX project entity chunk is also recognized
    const startupXChunk = chunks.find((c) => c.text.includes('StartupX'))
    expect(startupXChunk).toBeDefined()
    expect(startupXChunk?.section).toContain('StartupX')

    // Check skills section
    const skillsChunk = chunks.find((c) => c.text.includes('Golang, Java, Kubernetes'))
    expect(skillsChunk).toBeDefined()
    expect(skillsChunk?.section).toContain('Kỹ năng chuyên môn')
  })

  it('performs Contextual Header Injection and 15% sliding overlap on long project blocks', () => {
    // Generate a long project block > 1500 chars
    const longProject = `
## DỰ ÁN TIÊU BIỂU

### E-Commerce Omni-Channel Payment Hub (2022 - 2024)
- Kiến trúc giải pháp chịu tải cao cho 15 triệu người dùng hoạt động hàng tháng.
- Thiết kế cơ chế Distributed Transaction bằng Saga Pattern kết hợp Kafka event-driven architecture.
- Đảm bảo tính toán Idempotency tuyệt đối cho toàn bộ luồng thanh toán thẻ tín dụng và ví điện tử.
- Thiết lập Redis Cluster phân tán với bộ đệm đa tầng (Multi-tier caching) giúp giảm tải DB 75%.
- Triển khai giải pháp phân vùng cơ sở dữ liệu PostgreSQL (Database Sharding) với Citus extension.
- Tối ưu hóa câu truy vấn phức tạp, giảm P99 Response Time từ 620ms xuống dưới 45ms.
- Tích hợp hệ thống giám sát Prometheus và Grafana theo dõi từng microservice theo thời gian thực.
- Thiết lập cảnh báo tự động qua PagerDuty và Telegram Bot khi tỷ lệ lỗi vượt ngưỡng 0.5%.
- Tuân thủ nghiêm ngặt tiêu chuẩn an toàn bảo mật thanh toán PCI-DSS Level 1.
- Huấn luyện và cố vấn kỹ thuật cho đội ngũ 8 kỹ sư phần mềm backend và DevOps.
`
    const chunks = createStructuralChunks(longProject, { maxChars: 500, overlapRatio: 0.15 })
    expect(chunks.length).toBeGreaterThan(1)

    // All sub-chunks must maintain the project header
    for (const chunk of chunks) {
      expect(chunk.contextHeader).toContain('DỰ ÁN TIÊU BIỂU')
      expect(chunk.contextHeader).toContain('E-Commerce Omni-Channel Payment Hub')
      expect(chunk.text.startsWith('[Ngữ cảnh:')).toBe(true)
    }

    // Verify part numbers (Phần 1/x, Phần 2/x)
    expect(chunks[0]?.contextHeader).toContain('Phần 1')
    expect(chunks[1]?.contextHeader).toContain('Phần 2')

    // Verify overlap: some content from chunk 0 must be present in chunk 1
    const lines0 = chunks[0]?.rawText.split('\n').filter(Boolean) || []
    const lastLineOfChunk0 = lines0[lines0.length - 1]
    expect(lastLineOfChunk0).toBeDefined()
    expect(chunks[1]?.rawText).toContain(lastLineOfChunk0!)
  })

  it('recognizes bold and un-prefixed CV sections in both Vietnamese and English', () => {
    const rawCv = `
**WORK EXPERIENCE**

**Senior Distributed Systems Engineer** - Grab (2020 - 2023)
Led migration of ride-hailing core dispatcher to Go microservices.
Achieved 99.99% availability during peak holiday traffic.

**EDUCATION & CERTIFICATIONS**
Bachelor of Computer Science - Hanoi University of Science and Technology
AWS Certified Solutions Architect - Professional
`
    const chunks = createStructuralChunks(rawCv)
    expect(chunks.length).toBeGreaterThanOrEqual(2)

    const workChunk = chunks.find((c) => c.text.includes('Grab'))
    expect(workChunk).toBeDefined()
    expect(workChunk?.contextHeader).toContain('WORK EXPERIENCE')

    const eduChunk = chunks.find((c) => c.text.includes('Hanoi University'))
    expect(eduChunk).toBeDefined()
    expect(eduChunk?.contextHeader).toContain('EDUCATION & CERTIFICATIONS')
  })

  it('backward compatibility: chunkText returns string array and does not cut words in half', () => {
    const text = 'Hệ thống vi dịch vụ xử lý dữ liệu lớn. Công nghệ sử dụng bao gồm Kafka và ClickHouse.'
    const result = chunkText(text, 1000)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(1)
    expect(result[0]).toContain('Kafka và ClickHouse')
  })

  it('integrates seamlessly with LocalRagIndex.indexDocuments', async () => {
    const index = new LocalRagIndex()
    const doc: SourceDocument = {
      documentId: 'doc_cv_test',
      sourceType: 'cv',
      section: 'Hồ sơ ứng viên',
      text: `
## Dự án tiêu biểu
### Realtime Telemetry Monitor
- Thiết kế hệ thống thu thập metrics sử dụng WebSockets và InfluxDB.
- Giảm độ trễ hiển thị dữ liệu xuống dưới 100ms.
`,
    }

    await index.indexDocuments([doc])
    const chunks = index.getChunks()
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]?.section).toContain('Dự án tiêu biểu')
    expect(chunks[0]?.text).toContain('[Ngữ cảnh:')
    expect(chunks[0]?.text).toContain('Realtime Telemetry Monitor')
  })
})
