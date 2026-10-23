import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { settingsManager } from '../src/app/services/settings'
import { saveAIModelId } from '../src/app/services/ai-model/aiModels'
import { modelRegistryService } from '../src/app/services/ai-model/model-registry'
import { callUniversalLLM } from '../src/app/services/ai-model/copilot/universalLlm'

describe('Universal LLM API-discovered model routing', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    settingsManager.resetToDefaults()
    modelRegistryService.populateFromElectronSync({
      totalLoaded: 3,
      providerBreakdown: 'Groq: 2, OpenAI: 1',
      models: [
        {
          id: 'groq-test-primary',
          displayName: 'Groq Test Primary',
          provider: 'Groq',
          capabilities: ['text'],
        },
        {
          id: 'groq-test-fallback',
          displayName: 'Groq Test Fallback',
          provider: 'Groq',
          capabilities: ['text'],
        },
        {
          id: 'openai-test-other-provider',
          displayName: 'OpenAI Test Model',
          provider: 'OpenAI',
          capabilities: ['text'],
        },
      ],
    })
    settingsManager.set('groqKey', 'test-groq-key')
    saveAIModelId('groq-test-primary')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    settingsManager.resetToDefaults()
  })

  it('rejects a selected model missing from the registry before network access', async () => {
    saveAIModelId('not-in-registry')
    const fetchMock = mock(() => Promise.reject(new Error('fetch should not be called')))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(callUniversalLLM('test prompt')).rejects.toThrow(
      'không có trong danh sách model đã đồng bộ'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back only to a synchronized text model from the selected provider', async () => {
    const attemptedModels: string[] = []
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'))
      attemptedModels.push(body.model)

      if (attemptedModels.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'model unavailable' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'fallback response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await callUniversalLLM('test prompt')

    expect(attemptedModels).toEqual(['groq-test-primary', 'groq-test-fallback'])
    expect(result?.modelId).toBe('groq-test-fallback')
    expect(result?.text).toBe('fallback response')
  })
})
