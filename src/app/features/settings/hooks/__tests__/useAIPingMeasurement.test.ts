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
] as unknown as AIModelConfig[]

const mockSTT = [
  {
    id: 'whisper-large-v3-turbo',
    name: 'Groq Whisper Large V3 Turbo',
    provider: 'Groq',
    latencyMs: 140,
  },
] as unknown as STTEngineConfig[]

describe('useAIPingMeasurement Hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
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

  it('measures LLM and STT pings', async () => {
    const { result } = renderHook(() =>
      useAIPingMeasurement({
        selectedLLM: 'mock-model-1',
        selectedSTT: 'whisper-large-v3-turbo',
        modelsList: mockModels,
        sttEnginesList: mockSTT,
      })
    )

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

