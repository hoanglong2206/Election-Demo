import '@/test/setupDom'
import { describe, it, expect, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useAIPingMeasurement } from '../useAIPingMeasurement'
import type { AIModelConfig, STTEngineConfig } from '@/services/ai-model/aiModels'

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
  afterEach(() => {
    cleanup()
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

