/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONSOLIDATED SSE STREAM PARSER (Electron Main Process)
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Server-Sent Events (SSE) streaming for OpenAI-compatible APIs (Groq, OpenAI)
 * and Google Gemini with robust support for:
 * - Chunk boundaries splitting JSON or data lines
 * - Multi-byte UTF-8 character splitting across chunk boundaries (Vietnamese/CJK)
 * - CRLF (\r\n) and LF (\n) normalization
 * - Final usage chunk (include_usage in OpenAI, usageMetadata in Gemini)
 * - Stream error events
 * - [DONE] token termination
 */

import { TextDecoder } from 'util'

export interface SSEUsage {
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
}

export interface SSECallbacks {
  onDelta?: (delta: string) => void
  onUsage?: (usage: SSEUsage) => void
  onError?: (error: Error) => void
}

export class SSEStreamParser {
  private decoder: TextDecoder
  private buffer: string = ''
  private provider: 'groq' | 'openai' | 'gemini'
  private callbacks: SSECallbacks
  private usage: SSEUsage = {}
  private accumulatedText: string = ''

  constructor(provider: string, callbacks: SSECallbacks = {}) {
    this.decoder = new TextDecoder('utf-8')
    const norm = provider.toLowerCase().trim()
    this.provider = norm === 'gemini' || norm === 'google' ? 'gemini' : norm === 'openai' ? 'openai' : 'groq'
    this.callbacks = callbacks
  }

  /**
   * Feed a raw chunk (Uint8Array or string) into the SSE stream parser.
   */
  public feed(chunk: Uint8Array | string): void {
    const textChunk = typeof chunk === 'string'
      ? chunk
      : this.decoder.decode(chunk, { stream: true })

    this.buffer += textChunk.replace(/\r\n/g, '\n')
    const events = this.buffer.split('\n\n')
    // The last element is either empty (if ended with \n\n) or the incomplete remainder
    this.buffer = events.pop() ?? ''

    for (const event of events) {
      this.processEvent(event)
    }
  }

  /**
   * Flush any remaining buffered data at the end of the stream.
   */
  public flush(): void {
    const finalChunk = this.decoder.decode()
    if (finalChunk) {
      this.buffer += finalChunk.replace(/\r\n/g, '\n')
    }
    if (this.buffer.trim()) {
      this.processEvent(this.buffer)
      this.buffer = ''
    }
  }

  private processEvent(eventText: string): void {
    const lines = eventText.split('\n')
    const dataLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('data:')) {
        dataLines.push(trimmed.slice(5).trimStart())
      }
    }

    if (dataLines.length === 0) return

    const payload = dataLines.join('\n').trim()
    if (!payload || payload === '[DONE]') return

    let data: any
    try {
      data = JSON.parse(payload)
    } catch {
      // Incomplete or unparseable JSON payload
      return
    }

    // Check for error in stream
    if (data?.error) {
      const errMsg = data.error.message || data.error.code || JSON.stringify(data.error)
      const err = new Error(`Stream error: ${errMsg}`)
      this.callbacks.onError?.(err)
      return
    }

    let delta: string
    if (this.provider === 'gemini') {
      delta = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('') || ''
      if (data?.usageMetadata) {
        this.usage.inputTokens = data.usageMetadata.promptTokenCount ?? this.usage.inputTokens
        this.usage.outputTokens = data.usageMetadata.candidatesTokenCount ?? this.usage.outputTokens
        this.usage.cachedTokens = data.usageMetadata.cachedContentTokenCount ?? this.usage.cachedTokens
        this.callbacks.onUsage?.({ ...this.usage })
      }
    } else {
      delta = data?.choices?.[0]?.delta?.content ?? data?.choices?.[0]?.delta?.text ?? ''
      if (data?.usage) {
        this.usage.inputTokens = data.usage.prompt_tokens ?? this.usage.inputTokens
        this.usage.outputTokens = data.usage.completion_tokens ?? this.usage.outputTokens
        this.usage.cachedTokens = data.usage.prompt_tokens_details?.cached_tokens ?? this.usage.cachedTokens
        this.callbacks.onUsage?.({ ...this.usage })
      }
    }

    if (delta) {
      this.accumulatedText += delta
      this.callbacks.onDelta?.(delta)
    }
  }

  public getAccumulatedText(): string {
    return this.accumulatedText
  }

  public getUsage(): SSEUsage {
    return { ...this.usage }
  }
}
