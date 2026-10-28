import { describe, expect, it } from 'bun:test'
import { createStreamingTagFilter } from '../../llm/streamingTagFilter'

describe('createStreamingTagFilter', () => {
  it('should remove full <think> tag inside a single chunk', () => {
    const filter = createStreamingTagFilter()
    const result = filter.process('<think>Đây là suy nghĩ bí mật</think>Xin chào bạn!') + filter.flush()
    expect(result).toBe('Xin chào bạn!')
  })

  it('should remove split <think> tag across multiple chunks', () => {
    const filter = createStreamingTagFilter()
    const chunks = [
      'Chào bạn! ',
      '<th',
      'ink>Đang phân tích ',
      'câu hỏi phỏng vấn...</th',
      'ink>Câu trả lời ',
      'chính là đây.',
    ]

    let output = ''
    for (const chunk of chunks) {
      output += filter.process(chunk)
    }
    output += filter.flush()

    expect(output).toBe('Chào bạn! Câu trả lời chính là đây.')
  })

  it('should handle <thought> and <reasoning> tags split across chunks', () => {
    const filter = createStreamingTagFilter()
    const chunks = [
      'Bắt đầu: ',
      '<reas',
      'oning>Suy luận logic cấp cao</reas',
      'oning>',
      'Kết quả hoàn tất.',
    ]

    let output = ''
    for (const chunk of chunks) {
      output += filter.process(chunk)
    }
    output += filter.flush()

    expect(output).toBe('Bắt đầu: Kết quả hoàn tất.')
  })

  it('should preserve regular "<" characters and HTML-like non-reasoning tags', () => {
    const filter = createStreamingTagFilter()
    const chunks = [
      'Điều kiện: if (index < 10 && count < total) { return; }\n',
      'Thẻ HTML: <div className="card">Nội dung</div>',
    ]

    let output = ''
    for (const chunk of chunks) {
      output += filter.process(chunk)
    }
    output += filter.flush()

    expect(output).toBe(
      'Điều kiện: if (index < 10 && count < total) { return; }\nThẻ HTML: <div className="card">Nội dung</div>'
    )
  })

  it('should safely preserve Vietnamese multi-byte UTF-8 text and emoji', () => {
    const filter = createStreamingTagFilter()
    const chunks = [
      'Tôi là kỹ sư ',
      'phần mềm có 5 năm ',
      '<think>Kiểm tra CV tiếng Việt</think>',
      'kinh nghiệm tại các dự án quy mô lớn. 🚀🇻🇳',
    ]

    let output = ''
    for (const chunk of chunks) {
      output += filter.process(chunk)
    }
    output += filter.flush()

    expect(output).toBe('Tôi là kỹ sư phần mềm có 5 năm kinh nghiệm tại các dự án quy mô lớn. 🚀🇻🇳')
  })

  it('should flush pending buffer when stream ends on partial non-tag prefix', () => {
    const filter = createStreamingTagFilter()
    const output = filter.process('Giá trị nhỏ hơn <') + filter.flush()
    expect(output).toBe('Giá trị nhỏ hơn <')
  })
})

describe('SSE Parser UTF-8 & Split Stream Simulation', () => {
  it('should decode multi-byte Vietnamese UTF-8 chunks split in the middle of bytes', () => {
    const decoder = new TextDecoder('utf-8')
    const fullText = 'Chào bạn! Kiến trúc phần mềm phân tán.'
    const fullBytes = new TextEncoder().encode(fullText)

    // Split bytes arbitrarily in half (which may split a multi-byte Vietnamese character)
    const splitIndex = 14 // falls within multi-byte Vietnamese characters
    const chunk1 = fullBytes.slice(0, splitIndex)
    const chunk2 = fullBytes.slice(splitIndex)

    let decoded = decoder.decode(chunk1, { stream: true })
    decoded += decoder.decode(chunk2, { stream: true })
    decoded += decoder.decode()

    expect(decoded).toBe(fullText)
  })

  it('should parse SSE data lines split across chunk boundaries', () => {
    let buffer = ''
    const results: string[] = []

    const consume = (payload: string) => {
      if (!payload || payload === '[DONE]') return
      const data = JSON.parse(payload)
      if (data.choices?.[0]?.delta?.content) {
        results.push(data.choices[0].delta.content)
      }
    }

    // Two raw SSE packets, split awkwardly in the middle of a JSON line
    const rawStreamParts = [
      'data: {"choices":[{"delta":{"content":"Chào "}}]}\n\ndata: {"choices":[{"de',
      'lta":{"content":"bạn!"}}]}\n\ndata: [DONE]\n\n',
    ]

    for (const part of rawStreamParts) {
      buffer += part.replace(/\r\n/g, '\n')
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      for (const event of events) {
        const payload = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
        consume(payload)
      }
    }

    expect(results.join('')).toBe('Chào bạn!')
  })
})
