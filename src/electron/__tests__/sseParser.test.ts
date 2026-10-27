import { describe, expect, it } from 'bun:test'
import { SSEStreamParser } from '../services/llm/sseParser'

describe('SSEStreamParser', () => {
  it('parses standard OpenAI stream chunks cleanly', () => {
    let output = ''
    const parser = new SSEStreamParser('groq', {
      onDelta: (delta) => {
        output += delta
      },
    })

    parser.feed('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
    parser.feed('data: {"choices":[{"delta":{"content":" world!"}}]}\n\n')
    parser.feed('data: [DONE]\n\n')
    parser.flush()

    expect(output).toBe('Hello world!')
    expect(parser.getAccumulatedText()).toBe('Hello world!')
  })

  it('handles chunks split in the middle of a line and JSON payload', () => {
    let output = ''
    const parser = new SSEStreamParser('openai', {
      onDelta: (delta) => {
        output += delta
      },
    })

    // Split across chunk boundary
    parser.feed('data: {"choices":[{"delta":{"')
    parser.feed('content":"Part 1 and "}}]}\n\n')
    parser.feed('data: {"choices":[{"delta":{"content":"Part 2"')
    parser.feed('}}]}\n\n')
    parser.flush()

    expect(output).toBe('Part 1 and Part 2')
  })

  it('handles CRLF (\\r\\n) separators seamlessly', () => {
    let output = ''
    const parser = new SSEStreamParser('openai', {
      onDelta: (delta) => {
        output += delta
      },
    })

    parser.feed('data: {"choices":[{"delta":{"content":"CRLF"}}]}\r\n\r\n')
    parser.feed('data: {"choices":[{"delta":{"content":" support"}}]}\r\n\r\n')
    parser.flush()

    expect(output).toBe('CRLF support')
  })

  it('handles multi-byte UTF-8 Vietnamese characters split across Uint8Array chunk boundaries', () => {
    let output = ''
    const parser = new SSEStreamParser('groq', {
      onDelta: (delta) => {
        output += delta
      },
    })

    const encoder = new TextEncoder()
    // "Tiếng Việt" contains multi-byte characters:
    // 'ế' = [0xE1, 0xBA, 0xBF] (3 bytes)
    // 'ệ' = [0xE1, 0xBB, 0x87] (3 bytes)
    const jsonStr = 'data: {"choices":[{"delta":{"content":"Tiếng Việt"}}]}\n\n'
    const fullBytes = encoder.encode(jsonStr)

    // Find the offset where 'ế' begins
    const ePos = jsonStr.indexOf('ế')
    const prefixBytes = encoder.encode(jsonStr.slice(0, ePos))
    const splitPoint = prefixBytes.length + 1 // split right in the middle of the 3-byte 'ế'

    const chunk1 = fullBytes.slice(0, splitPoint)
    const chunk2 = fullBytes.slice(splitPoint)

    parser.feed(chunk1)
    parser.feed(chunk2)
    parser.flush()

    expect(output).toBe('Tiếng Việt')
  })

  it('extracts usage on final chunk for OpenAI/Groq', () => {
    let finalUsage: any = null
    const parser = new SSEStreamParser('groq', {
      onUsage: (usage) => {
        finalUsage = usage
      },
    })

    parser.feed('data: {"choices":[{"delta":{"content":"Answer"}}]}\n\n')
    // Final chunk has empty choices and usage object
    parser.feed('data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":25,"prompt_tokens_details":{"cached_tokens":4}}}\n\n')
    parser.flush()

    expect(finalUsage).toEqual({
      inputTokens: 12,
      outputTokens: 25,
      cachedTokens: 4,
    })
    expect(parser.getUsage()).toEqual({
      inputTokens: 12,
      outputTokens: 25,
      cachedTokens: 4,
    })
  })

  it('extracts Gemini stream content and usage metadata', () => {
    let output = ''
    let finalUsage: any = null
    const parser = new SSEStreamParser('gemini', {
      onDelta: (delta) => {
        output += delta
      },
      onUsage: (usage) => {
        finalUsage = usage
      },
    })

    parser.feed('data: {"candidates":[{"content":{"parts":[{"text":"Gemini"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"cachedContentTokenCount":2}}\n\n')
    parser.feed('data: {"candidates":[{"content":{"parts":[{"text":" response"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":12,"cachedContentTokenCount":2}}\n\n')
    parser.flush()

    expect(output).toBe('Gemini response')
    expect(finalUsage).toEqual({
      inputTokens: 10,
      outputTokens: 12,
      cachedTokens: 2,
    })
  })

  it('detects stream error events and invokes onError', () => {
    let errorCaught: Error | null = null
    const parser = new SSEStreamParser('groq', {
      onError: (err) => {
        errorCaught = err
      },
    })

    parser.feed('data: {"error":{"message":"Rate limit exceeded","code":429}}\n\n')
    parser.flush()

    expect(errorCaught).not.toBeNull()
    expect(errorCaught!.message).toContain('Rate limit exceeded')
  })
})
