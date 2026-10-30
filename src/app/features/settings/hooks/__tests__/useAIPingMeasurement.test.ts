import '@/test/setupDom'
import { describe, it, expect, afterEach, beforeEach, spyOn } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useAIPingMeasurement } from '../useAIPingMeasurement'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'
import * as aiModels from '@/services/ai-model/aiModels'
import { measureRealAIPing, type AIModelConfig, type STTEngineConfig } from '@/services/ai-model/aiModels'

const mockModels = [
  {
    id: 'mock-model-1',
    name: 'Mock Model 1',
    provider: 'OpenAI',
    tier: 'Free',
    pingMs: 95,
  },
  {
    id: 'mock-model-2',
    name: 'Mock Model 2',
    provider: 'Google',
    tier: 'Free',
    pingMs: 110,
  },
] as unknown as AIModelConfig[]

const mockSTT = [
  {
    id: 'whisper-large-v3-turbo',
    name: 'Groq Whisper Large V3 Turbo',
    provider: 'Groq',
    latencyMs: 140,
  },
  {
    id: 'ggml-tiny.bin',
    name: 'Local Whisper Tiny',
    provider: 'Local',
    latencyMs: 50,
  },
] as unknown as STTEngineConfig[]

describe('useAIPingMeasurement Hook', () => {
  let activeSpies: Array<{ mockRestore: () => void }> = []

  beforeEach(() => {
    localStorage.clear()
    activeSpies = []
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
    for (const spy of activeSpies) {
      spy.mockRestore()
    }
    activeSpies = []
  })

  it('ignores STT IDs when measuring LLM latency', async () => {
    const mockIpc = new MockIpcAdapter()
    let verifyCalls = 0
    mockIpc.credentials.verifyApiKey = async () => {
      verifyCalls += 1
      return { valid: true, provider: 'groq', message: 'verified', pingMs: 123 }
    }
    setIpcClient(mockIpc)

    const ping = await measureRealAIPing('whisper-large-v3-turbo')

    expect(ping).toBeGreaterThan(0)
    expect(verifyCalls).toBe(0)
  })

  it('does not auto-measure LLM ping when STT changes', async () => {
    const spy = spyOn(aiModels, 'measureRealAIPing').mockResolvedValue(150)
    activeSpies.push(spy)

    const { rerender } = renderHook(
      ({ sttId }) =>
        useAIPingMeasurement({
          selectedLLM: 'mock-model-1',
          selectedSTT: sttId,
          modelsList: mockModels,
          sttEnginesList: mockSTT,
        }),
      { initialProps: { sttId: 'whisper-large-v3-turbo' } }
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(spy).toHaveBeenCalledTimes(1)

    rerender({ sttId: 'whisper-base' })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not auto-measure STT latency when LLM changes', async () => {
    const sttSpy = spyOn(aiModels, 'measureRealSTTLatency').mockResolvedValue(120)
    const llmSpy = spyOn(aiModels, 'measureRealAIPing').mockResolvedValue(90)
    activeSpies.push(sttSpy, llmSpy)

    const { rerender } = renderHook(
      ({ llmId }) =>
        useAIPingMeasurement({
          selectedLLM: llmId,
          selectedSTT: 'whisper-large-v3-turbo',
          modelsList: mockModels,
          sttEnginesList: mockSTT,
        }),
      { initialProps: { llmId: 'mock-model-1' } }
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    expect(llmSpy).toHaveBeenCalledTimes(1)
    expect(sttSpy).toHaveBeenCalledTimes(1)

    // Change LLM
    rerender({ llmId: 'mock-model-2' })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    // LLM measured again, but STT should NOT be measured again!
    expect(llmSpy).toHaveBeenCalledTimes(2)
    expect(sttSpy).toHaveBeenCalledTimes(1)
  })

  it('clears STT test result for Local engines and does not trigger remote ping', async () => {
    const sttSpy = spyOn(aiModels, 'measureRealSTTLatency').mockResolvedValue(120)
    activeSpies.push(sttSpy)

    const { result, rerender } = renderHook(
      ({ sttId }) =>
        useAIPingMeasurement({
          selectedLLM: 'mock-model-1',
          selectedSTT: sttId,
          modelsList: mockModels,
          sttEnginesList: mockSTT,
        }),
      { initialProps: { sttId: 'whisper-large-v3-turbo' } }
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    expect(sttSpy).toHaveBeenCalledTimes(1)

    // Switch to Local model
    rerender({ sttId: 'ggml-tiny.bin' })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    // No new remote ping calls for local
    expect(sttSpy).toHaveBeenCalledTimes(1)
    expect(result.current.groqSTTTestResult).toBeNull()
  })

  it('rapid consecutive LLM changes ignore older resolved promises', async () => {
    let resolveFirst: (val: number) => void = () => {}
    let resolveSecond: (val: number) => void = () => {}

    const spy = spyOn(aiModels, 'measureRealAIPing').mockImplementation((modelId) => {
      if (modelId === 'mock-model-1') {
        return new Promise<number>((res) => {
          resolveFirst = res
        })
      }
      return new Promise<number>((res) => {
        resolveSecond = res
      })
    })
    activeSpies.push(spy)

    const { result, rerender } = renderHook(
      ({ llmId }) =>
        useAIPingMeasurement({
          selectedLLM: llmId,
          selectedSTT: 'ggml-tiny.bin',
          modelsList: mockModels,
          sttEnginesList: mockSTT,
        }),
      { initialProps: { llmId: 'mock-model-1' } }
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })

    // Rapidly switch to second model before first resolves
    rerender({ llmId: 'mock-model-2' })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })

    // Resolve second request first with 88ms
    await act(async () => {
      resolveSecond(88)
    })
    expect(result.current.liveLLMPing).toBe(88)

    // Resolve first request later with 999ms -> must NOT overwrite second result!
    await act(async () => {
      resolveFirst(999)
    })
    expect(result.current.liveLLMPing).toBe(88)
  })

  it('measures LLM and STT pings', async () => {
    let hookResult: any
    await act(async () => {
      hookResult = renderHook(() =>
        useAIPingMeasurement({
          selectedLLM: 'mock-model-1',
          selectedSTT: 'whisper-large-v3-turbo',
          modelsList: mockModels,
          sttEnginesList: mockSTT,
        })
      )
    })
    const { result } = hookResult

    await act(async () => {
      await result.current.handleTestLLMPing('mock-model-1')
    })

    expect(result.current.liveLLMPing).toBeNumber()

    await act(async () => {
      await result.current.handleTestGroqSTTPing('whisper-large-v3-turbo')
    })

    expect(result.current.groqSTTTestResult).not.toBeNull()
    expect(result.current.groqSTTTestResult?.latencyMs).toBeNumber()
  })
})
