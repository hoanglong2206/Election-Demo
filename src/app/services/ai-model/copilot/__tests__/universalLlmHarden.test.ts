import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  callUniversalLLM,
  callUniversalLLMStream,
  checkCachedHasApiKey,
  invalidateApiKeyCache,
} from '../../llm'

describe('universalLlm Hardened IPC Streaming & Wrapper', () => {
  const originalWindow = (globalThis as any).window

  beforeEach(() => {
    invalidateApiKeyCache()
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
    invalidateApiKeyCache()
  })

  it('fails immediately with descriptive error when IPC is missing, refusing direct renderer fetch', async () => {
    // Setup window with NO credentials IPC
    ;(globalThis as any).window = {}

    let errorReceived: Error | null = null
    await new Promise<void>((resolve) => {
      callUniversalLLMStream(
        'Xin chào',
        {
          onDelta: () => {},
          onDone: () => {},
          onError: (err) => {
            errorReceived = err
            resolve()
          },
        },
        { routing: { enabled: false } }
      )
    })

    expect(errorReceived).not.toBeNull()
    expect(errorReceived!.message).toContain('Electron IPC streaming API')
    expect(errorReceived!.message).toContain('từ chối gọi LLM trực tiếp từ Renderer')
  })

  it('uses cached hasApiKey to eliminate redundant IPC calls and invalidates on demand', async () => {
    let checkCount = 0
    ;(globalThis as any).window = {
      api: {
        credentials: {
          hasApiKey: async (provider: string) => {
            checkCount++
            return provider === 'groq'
          },
        },
      },
    }

    const first = await checkCachedHasApiKey('groq')
    expect(first).toBe(true)
    expect(checkCount).toBe(1)

    // Second check should use cache without invoking IPC
    const second = await checkCachedHasApiKey('groq')
    expect(second).toBe(true)
    expect(checkCount).toBe(1)

    // Invalidate cache
    invalidateApiKeyCache('groq')
    const third = await checkCachedHasApiKey('groq')
    expect(third).toBe(true)
    expect(checkCount).toBe(2)
  })

  it('reports specific missing API key error when providers are skipped due to missing credentials', async () => {
    ;(globalThis as any).window = {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      api: {
        credentials: {
          hasApiKey: async () => false, // No keys configured
          streamLLM: () => () => {},
        },
      },
    }

    let errorReceived: Error | null = null
    await new Promise<void>((resolve) => {
      callUniversalLLMStream(
        'Test prompt',
        {
          onDelta: () => {},
          onDone: () => {},
          onError: (err) => {
            errorReceived = err
            resolve()
          },
        },
        { routing: { enabled: false }, modelId: 'llama-3.3-70b-versatile' }
      )
    })

    expect(errorReceived).not.toBeNull()
    expect(errorReceived!.message).toContain('Chưa có API key cho')
  })

  it('callUniversalLLM returns real provider, model, and truncated=true when stream fails mid-generation', async () => {
    ;(globalThis as any).window = {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      api: {
        credentials: {
          hasApiKey: async () => true,
          streamLLM: (_params: any, callbacks: any) => {
            // Emulate stream starting, first token arriving, delta, then mid-stream network drop
            setTimeout(() => {
              callbacks.onFirstToken?.({ requestId: 'r1', ttftMs: 250 })
              callbacks.onDelta?.({ requestId: 'r1', delta: 'Nội dung một phần ' })
              callbacks.onError?.({
                requestId: 'r1',
                error: 'Connection dropped mid-stream',
                partialText: 'Nội dung một phần ',
              })
            }, 10)
            return () => {}
          },
        },
      },
    }

    const result = await callUniversalLLM('Hãy viết bài phân tích', {
      modelId: 'llama-3.3-70b-versatile',
      routing: { enabled: false },
    })

    expect(result).not.toBeNull()
    expect(result!.truncated).toBe(true)
    expect(result!.provider).toBe('Groq')
    expect(result!.modelId).toBe('llama-3.3-70b-versatile')
    expect(result!.text).toBe('Nội dung một phần')
    expect(result!.usage?.outputTokens).toBeGreaterThan(0)
  })

  it('delivers telemetry benchmark (ttft, mainTtft, ipcLag, deltasPerSec) on completion', async () => {
    ;(globalThis as any).window = {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      api: {
        credentials: {
          hasApiKey: async () => true,
          streamLLM: (_params: any, callbacks: any) => {
            setTimeout(() => {
              callbacks.onFirstToken?.({ requestId: 'r1', ttftMs: 200 })
              callbacks.onDelta?.({ requestId: 'r1', delta: 'Trả lời hoàn chỉnh' })
              callbacks.onDone?.({
                requestId: 'r1',
                text: 'Trả lời hoàn chỉnh',
                modelName: 'llama-3.3-70b-versatile',
                provider: 'groq',
                usage: { inputTokens: 50, outputTokens: 10 },
                benchmark: { ttftMs: 200, generationMs: 150, outputTokens: 10 },
              })
            }, 10)
            return () => {}
          },
        },
      },
    }

    let finalResult: any = null
    await new Promise<void>((resolve) => {
      callUniversalLLMStream(
        'Test benchmark',
        {
          onDelta: () => {},
          onDone: (res) => {
            finalResult = res
            resolve()
          },
          onError: () => resolve(),
        },
        { routing: { enabled: false }, modelId: 'llama-3.3-70b-versatile' }
      )
    })

    expect(finalResult).not.toBeNull()
    expect(finalResult.benchmark).toBeDefined()
    expect(finalResult.benchmark.mainTtftMs).toBe(200)
    expect(typeof finalResult.benchmark.ipcLagMs).toBe('number')
    expect(typeof finalResult.benchmark.deltasPerSec).toBe('number')
  })
})
