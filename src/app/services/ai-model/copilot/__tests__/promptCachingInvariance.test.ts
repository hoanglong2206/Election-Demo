import { describe, it, expect } from 'bun:test'
import {
  buildStaticSystemPrefix,
  buildDynamicUserPrompt,
} from '../promptTemplate'
import { SSEStreamParser } from '../../../../../electron/services/llm/sseParser'

describe('Prompt Caching Prefix Invariance & Multi-Provider Cache Telemetry', () => {
  const sampleCandidateContext = `
Họ tên: Nguyễn Văn A
Vị trí mục tiêu: Senior Backend Engineer
Kinh nghiệm: 6 năm kinh nghiệm phát triển hệ thống phân tán, microservices với Go, Java và TypeScript.
Dự án tiêu biểu:
- E-commerce Payment Gateway: Xử lý 10,000 TPS, triển khai Kafka, Redis Cluster, Postgres partition. Giảm latency P99 từ 450ms xuống 65ms.
- High-throughput Notification Dispatcher: Quản lý hàng triệu push notifications mỗi ngày qua RabbitMQ và WebSockets.
Kỹ năng chính: Distributed Systems, Kafka, RabbitMQ, PostgreSQL, Redis, Docker, Kubernetes, CI/CD.
Học vấn: Cử nhân Công nghệ Thông tin - Đại học Bách Khoa.
`.trim()

  const sampleRole = 'Staff Backend Engineer'
  const sampleCompany = 'TechCorp Global'
  const sampleCustomInstructions = 'Tập trung nêu số liệu định lượng (metrics) và các quyết định kiến trúc đánh đổi (tradeoffs).'

  it('buildStaticSystemPrefix produces 100% byte-for-byte identical output across turns', () => {
    // Turn 1
    const prefixTurn1 = buildStaticSystemPrefix({
      candidateContext: sampleCandidateContext,
      role: sampleRole,
      companyName: sampleCompany,
      customInstructions: sampleCustomInstructions,
    })

    // Turn 2 (simulating turn 2 with same permanent context)
    const prefixTurn2 = buildStaticSystemPrefix({
      candidateContext: sampleCandidateContext,
      role: sampleRole,
      companyName: sampleCompany,
      customInstructions: sampleCustomInstructions,
    })

    // Turn 3
    const prefixTurn3 = buildStaticSystemPrefix({
      candidateContext: sampleCandidateContext,
      role: sampleRole,
      companyName: sampleCompany,
      customInstructions: sampleCustomInstructions,
    })

    // Byte-level exact identity check
    expect(prefixTurn1).toBe(prefixTurn2)
    expect(prefixTurn2).toBe(prefixTurn3)

    // Token length check: Ensure prefix is substantial enough for provider prompt caching
    // (1024 tokens ~ 4000 characters)
    expect(prefixTurn1.length).toBeGreaterThan(1000)
    expect(prefixTurn1.includes('<<INTENT|<normalizedIntent>|<độ tin cậy từ 0.00 đến 1.00>>>')).toBe(true)
    expect(prefixTurn1.includes('Nguyễn Văn A')).toBe(true)
    expect(prefixTurn1.includes('TechCorp Global')).toBe(true)
  })

  it('buildDynamicUserPrompt isolates dynamic data away from static system prefix', () => {
    const staticPrefix = buildStaticSystemPrefix({
      candidateContext: sampleCandidateContext,
      role: sampleRole,
      companyName: sampleCompany,
    })

    const turn1Question = 'Làm thế nào bạn tối ưu Kafka latency trong dự án Payment Gateway?'
    const dynamicTurn1 = buildDynamicUserPrompt({
      question: turn1Question,
      strategyDirective: 'Tập trung STAR framework và metrics',
      retrievalContext: '[Dự án Payment Gateway: Kafka producer batching 5ms]',
      sessionMemoryBlock: 'Ứng viên vừa giới thiệu kinh nghiệm làm việc',
      recentTranscriptBlock: 'Interviewer: Em hãy chia sẻ về dự án gần nhất',
      lang: 'vi',
    })

    const turn2Question = 'Khi Redis cluster bị network partition thì bạn xử lý thế nào?'
    const dynamicTurn2 = buildDynamicUserPrompt({
      question: turn2Question,
      strategyDirective: 'Phân tích định lý CAP và Split-brain prevention',
      retrievalContext: '[Dự án Payment Gateway: Redis failover Sentinel]',
      sessionMemoryBlock: 'Ứng viên đã trả lời xong phần Kafka',
      recentTranscriptBlock: 'Interviewer: Khá tốt, thế còn về Redis?',
      lang: 'vi',
    })

    // Dynamic prompt changes with each question
    expect(dynamicTurn1).not.toBe(dynamicTurn2)
    expect(dynamicTurn1.includes(turn1Question)).toBe(true)
    expect(dynamicTurn2.includes(turn2Question)).toBe(true)

    // Static prefix remains completely unaffected by turn questions or rolling history
    expect(staticPrefix.includes(turn1Question)).toBe(false)
    expect(staticPrefix.includes(turn2Question)).toBe(false)
    expect(staticPrefix.includes('Interviewer:')).toBe(false)
  })

  it('SSEStreamParser accurately extracts cachedTokens from OpenAI SSE response', () => {
    let capturedUsage: any = null
    const parser = new SSEStreamParser('openai', {
      onUsage: (u) => {
        capturedUsage = u
      },
    })

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Chào "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"bạn!"}}]}\n\n',
      'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":1200,"completion_tokens":25,"prompt_tokens_details":{"cached_tokens":1024}}}\n\n',
      'data: [DONE]\n\n',
    ]

    for (const chunk of sseChunks) {
      parser.feed(chunk)
    }
    parser.flush()

    expect(parser.getAccumulatedText()).toBe('Chào bạn!')
    expect(capturedUsage).not.toBeNull()
    expect(capturedUsage.inputTokens).toBe(1200)
    expect(capturedUsage.cachedTokens).toBe(1024)
    expect(capturedUsage.outputTokens).toBe(25)
  })

  it('SSEStreamParser accurately extracts cachedTokens from Gemini SSE response', () => {
    let capturedUsage: any = null
    const parser = new SSEStreamParser('gemini', {
      onUsage: (u) => {
        capturedUsage = u
      },
    })

    const sseChunk =
      'data: {"candidates":[{"content":{"parts":[{"text":"Gemini cached response"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":2048,"candidatesTokenCount":40,"cachedContentTokenCount":1536}}\n\n'

    parser.feed(sseChunk)
    parser.flush()

    expect(parser.getAccumulatedText()).toBe('Gemini cached response')
    expect(capturedUsage).not.toBeNull()
    expect(capturedUsage.inputTokens).toBe(2048)
    expect(capturedUsage.cachedTokens).toBe(1536)
    expect(capturedUsage.outputTokens).toBe(40)
  })

  it('SSEStreamParser accurately extracts cachedTokens from Anthropic SSE response', () => {
    let capturedUsage: any = null
    const parser = new SSEStreamParser('anthropic', {
      onUsage: (u) => {
        capturedUsage = u
      },
    })

    const startEvent =
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","usage":{"input_tokens":1400,"cache_creation_input_tokens":0,"cache_read_input_tokens":1250}}}\n\n'

    const deltaEvent =
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude cached reply"}}\n\n'

    const stopEvent =
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":30}}\n\n'

    parser.feed(startEvent)
    parser.feed(deltaEvent)
    parser.feed(stopEvent)
    parser.flush()

    expect(parser.getAccumulatedText()).toBe('Claude cached reply')
    expect(capturedUsage).not.toBeNull()
    expect(capturedUsage.inputTokens).toBe(1400)
    expect(capturedUsage.cachedTokens).toBe(1250)
    expect(capturedUsage.outputTokens).toBe(30)
  })
})
