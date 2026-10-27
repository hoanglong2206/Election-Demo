import { getAllAIModels, getSavedAIModelId } from '../aiModels'
import { modelRegistryService } from '../model-registry'
import { settingsManager } from '../../settings'
import type { UniversalLLMResult } from './types'
import type { LLMProvider } from '../types'
import { usageTrackerService, type AIUsageFeature } from '../../usage-tracker'
import { smartModelRouter, type ModelRouterRequest, type SmartModelRouter } from '../model-router'
import {
  classifyProviderError,
  providerCircuitBreaker,
} from '../model-router'
import { createStreamingTagFilter } from './streamingTagFilter'

/**
 * Format provider badge label for display
 */
export function getProviderBadgeLabel(provider?: string, modelId?: string): string {
  if (!provider) return 'AI Copilot'
  if (provider === 'Groq') {
    return modelId?.includes('70b') ? 'Groq LPU (Llama 3.3 70B)' : 'Groq LPU (Llama 3.1)'
  }
  if (provider === 'Google') {
    return modelId?.includes('pro') ? 'Google Gemini 1.5 Pro' : 'Google Gemini 1.5 Flash'
  }
  if (provider === 'OpenAI') {
    return modelId?.includes('gpt-4o-mini')
      ? 'OpenAI GPT-4o Mini'
      : modelId?.includes('gpt-4o')
      ? 'OpenAI GPT-4o'
      : 'OpenAI GPT'
  }
  return `${provider}`
}

function providerError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

export interface UniversalLLMStreamCallbacks {
  onFirstToken?: (ttftMs: number) => void
  onDelta: (delta: string) => void
  onDone: (result: UniversalLLMResult) => void
  onError: (error: Error, partialText: string) => void
}

export interface UniversalLLMOptions {
  modelId?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  sessionId?: string
  feature?: AIUsageFeature
  routing?: Partial<ModelRouterRequest> & {
    enabled?: boolean
    router?: SmartModelRouter
  }
  signal?: AbortSignal
}

async function streamDirectFetch(
  provider: LLMProvider,
  modelId: string,
  apiKey: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  systemPrompt: string | undefined,
  callbacks: {
    onFirstToken?: (ttftMs: number) => void
    onDelta: (delta: string) => void
    onDone: (data: { text: string; usage?: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } }) => void
    onError: (err: Error) => void
  },
  signal?: AbortSignal
) {
  let url = ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let body: any

  if (provider === 'Groq' || provider === 'OpenAI') {
    url = provider === 'Groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    headers.Authorization = `Bearer ${apiKey}`
    const reasoningModel = provider === 'OpenAI' && /^(o[134]|gpt-5)/i.test(modelId)
    body = {
      model: modelId,
      messages: [
        ...(systemPrompt ? [{ role: reasoningModel ? 'developer' : 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: maxTokens,
      ...(!reasoningModel ? { temperature } : {}),
      stream: true,
      ...(provider === 'OpenAI' || provider === 'Groq' ? { stream_options: { include_usage: true } } : {}),
    }
  } else if (provider === 'Google') {
    let cleanModelId = modelId.replace(/^models\//, '')
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModelId)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    }
  } else {
    throw new Error(`Direct streaming unsupported for provider: ${provider}`)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw providerError(err?.error?.message || `Provider ${provider} error status: ${res.status}`, res.status)
  }

  if (!res.body) {
    throw new Error(`No response body from ${provider}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let streamBuffer = ''
  let accumulated = ''
  let firstTokenAt: number | undefined
  const startedAt = performance.now()
  const usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } = {}

  const consume = (payload: string) => {
    if (!payload || payload === '[DONE]') return
    let data: any
    try { data = JSON.parse(payload) } catch { return }

    let delta = ''
    if (provider === 'Google') {
      delta = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
      if (data?.usageMetadata) {
        usage.inputTokens = data.usageMetadata.promptTokenCount ?? usage.inputTokens
        usage.outputTokens = data.usageMetadata.candidatesTokenCount ?? usage.outputTokens
        usage.cachedTokens = data.usageMetadata.cachedContentTokenCount ?? usage.cachedTokens
      }
    } else {
      delta = data?.choices?.[0]?.delta?.content || ''
      if (data?.usage) {
        usage.inputTokens = data.usage.prompt_tokens ?? usage.inputTokens
        usage.outputTokens = data.usage.completion_tokens ?? usage.outputTokens
        usage.cachedTokens = data.usage.prompt_tokens_details?.cached_tokens ?? usage.cachedTokens
      }
    }

    if (delta) {
      accumulated += delta
      if (firstTokenAt === undefined) {
        firstTokenAt = performance.now()
        callbacks.onFirstToken?.(Math.round(firstTokenAt - startedAt))
      }
      callbacks.onDelta(delta)
    }
  }

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {})
      throw new Error('Streaming cancelled')
    }
    const { value, done } = await reader.read()
    if (done) break
    streamBuffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    const events = streamBuffer.split('\n\n')
    streamBuffer = events.pop() || ''
    for (const event of events) {
      const payload = event
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n')
      consume(payload)
    }
  }

  streamBuffer += decoder.decode()
  if (streamBuffer.trim()) {
    const payload = streamBuffer
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .join('\n')
    consume(payload)
  }

  callbacks.onDone({ text: accumulated, usage })
}

/**
 * Streaming Universal LLM caller with:
 * - Routing & Fallback chain
 * - First-token failover timeout (~1.2s). Once first token arrives, provider is locked!
 * - Stateful streaming tag filter (<think>...</think>, <thought>, <reasoning>)
 * - Circuit breaker & Usage tracking
 */
export async function callUniversalLLMStream(
  prompt: string,
  callbacks: UniversalLLMStreamCallbacks,
  options?: UniversalLLMOptions
): Promise<() => void> {
  const maxTokens = options?.maxTokens ?? 600
  const temperature = options?.temperature ?? 0.3
  const systemPrompt = options?.systemPrompt

  const explicitlySavedModelId = String(settingsManager.get('selectedLLM') || '').trim()
  const router = options?.routing?.router || smartModelRouter
  const routingDecision = options?.routing?.enabled === false
    ? undefined
    : router.decide({
        feature: options?.feature || 'general',
        sessionId: options?.sessionId,
        ...options?.routing,
        policy: options?.routing?.policy || settingsManager.get('modelRouterPolicy'),
        manualModelId: options?.modelId || options?.routing?.manualModelId,
      })
  const selectedModelId =
    options?.modelId?.trim() || routingDecision?.selectedModelId || explicitlySavedModelId || getSavedAIModelId()
  const hasDiscoveredModels = modelRegistryService.getModels().length > 0
  const registryModel = modelRegistryService.getModelById(selectedModelId)
  const selectedModel = getAllAIModels().find((model) => model.id === selectedModelId)

  if (!hasDiscoveredModels || selectedModelId === 'no-model-configured') {
    const err = new Error(
      'Chưa có mô hình LLM khả dụng. Vào Cài đặt, nhập API key, đồng bộ model từ API rồi chọn một model trước khi gọi AI.'
    )
    callbacks.onError(err, '')
    return () => {}
  }

  if (
    !registryModel ||
    !selectedModel ||
    !registryModel.isLiveFromAPI ||
    !registryModel.capabilities.includes('text')
  ) {
    const err = new Error(
      `Model "${selectedModelId}" không có trong danh sách model đã đồng bộ. Vào Cài đặt, đồng bộ lại danh sách và chọn một model hiện có.`
    )
    callbacks.onError(err, '')
    return () => {}
  }

  const validModels = getAllAIModels().filter((model) =>
    model.isLiveFromAPI &&
    modelRegistryService.getModelById(model.id)?.capabilities.includes('text')
  )
  const providerCandidates = [
    ...(routingDecision?.fallbackChain
      ?.map((item) => validModels.find((model) => model.id === item.modelId))
      .filter((model): model is typeof selectedModel => Boolean(model)) || [selectedModel]),
    ...validModels.filter((model) =>
      model.provider === selectedModel.provider &&
      model.id !== selectedModel.id &&
      !routingDecision?.fallbackChain?.some((item) => item.modelId === model.id)
    ),
  ]

  const FIRST_TOKEN_TIMEOUT_MS = 1200
  const tagFilter = createStreamingTagFilter()
  let hasEmittedFirstToken = false
  let accumulatedCleanedText = ''
  let failoverFromProvider: string | undefined
  let failoverReason: string | undefined
  let isStreamDone = false
  let cancelCurrent: (() => void) | null = null

  const handleFilteredDelta = (rawDelta: string, ttftMs?: number) => {
    const cleaned = tagFilter.process(rawDelta)
    if (cleaned) {
      if (!hasEmittedFirstToken) {
        hasEmittedFirstToken = true
        callbacks.onFirstToken?.(ttftMs ?? 0)
      }
      accumulatedCleanedText += cleaned
      callbacks.onDelta(cleaned)
    }
  }

  const handleStreamCompletion = (
    candidate: (typeof providerCandidates)[0],
    resText: string,
    usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } | undefined,
    attemptStartedAt: number
  ) => {
    if (isStreamDone) return
    isStreamDone = true

    const tail = tagFilter.flush()
    if (tail) {
      if (!hasEmittedFirstToken) {
        hasEmittedFirstToken = true
        callbacks.onFirstToken?.(Math.round(performance.now() - attemptStartedAt))
      }
      accumulatedCleanedText += tail
      callbacks.onDelta(tail)
    }

    providerCircuitBreaker.recordSuccess(candidate.provider, Date.now() - attemptStartedAt)
    router.recordResult(candidate.id, Date.now() - attemptStartedAt, true)

    const resolvedProvider = candidate.provider as LLMProvider
    const usageRecord = usageTrackerService.trackUsage({
      sessionId: options?.sessionId,
      provider: resolvedProvider,
      model: candidate.id,
      feature: options?.feature || 'copilot',
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      cachedTokens: usage?.cachedTokens,
    })

    const inTok = usageRecord.inputTokens || 0
    const cachedTok = usageRecord.cachedTokens || 0
    const uncachedTok = Math.max(0, inTok - cachedTok)
    const cacheHitRate = inTok > 0 && cachedTok > 0 ? Math.round((cachedTok / inTok) * 100) : 0

    callbacks.onDone({
      text: accumulatedCleanedText || resText.trim(),
      modelId: candidate.id,
      modelName: candidate.name,
      provider: resolvedProvider,
      usage: {
        inputTokens: inTok,
        outputTokens: usageRecord.outputTokens || 0,
        cachedTokens: cachedTok,
        uncachedTokens: uncachedTok,
        cacheHitRate,
        estimatedCostUsd: usageRecord.estimatedCostUsd,
      },
      routing: routingDecision,
      failover: {
        switched: Boolean(failoverFromProvider),
        fromProvider: failoverFromProvider,
        toProvider: candidate.provider,
        reason: failoverReason,
      },
    })
  }

  // Execute candidate sequence with failover ONLY before first token
  const runSequence = async () => {
    for (const candidateModel of providerCandidates) {
      if (hasEmittedFirstToken || isStreamDone || options?.signal?.aborted) {
        break
      }

      const provider = candidateModel.provider
      if (!providerCircuitBreaker.canRequest(provider)) {
        continue
      }

      let targetProvider = candidateModel.provider.toLowerCase()
      if (targetProvider === 'google') targetProvider = 'gemini'

      // Check if Electron IPC is available
      const hasIPC = typeof window !== 'undefined' && Boolean(window.api?.credentials?.streamLLM)

      if (hasIPC) {
        const hasKey = await window.api!.credentials!.hasApiKey(targetProvider)
        if (!hasKey) continue

        const attemptStartedAt = Date.now()
        const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        let candidateFailedBeforeFirstToken = false
        let firstTokenTimer: ReturnType<typeof setTimeout> | null = null

        await new Promise<void>((resolve) => {
          let cancelIpc: (() => void) | null = null

          const cleanupAttempt = () => {
            if (firstTokenTimer) {
              clearTimeout(firstTokenTimer)
              firstTokenTimer = null
            }
          }

          firstTokenTimer = setTimeout(() => {
            if (!hasEmittedFirstToken && !isStreamDone) {
              console.warn(
                `[universalLlm] First-token timeout (${FIRST_TOKEN_TIMEOUT_MS}ms) for ${candidateModel.id}. Failing over to next provider.`
              )
              candidateFailedBeforeFirstToken = true
              failoverFromProvider = provider
              failoverReason = 'first_token_timeout'
              providerCircuitBreaker.recordFailure(
                provider,
                classifyProviderError(new Error('First-token timeout'), provider),
                Date.now() - attemptStartedAt
              )
              router.recordResult(candidateModel.id, Date.now() - attemptStartedAt, false)
              if (cancelIpc) cancelIpc()
              cleanupAttempt()
              resolve()
            }
          }, FIRST_TOKEN_TIMEOUT_MS)

          cancelIpc = window.api!.credentials!.streamLLM!(
            {
              requestId,
              input: {
                provider: targetProvider,
                modelId: candidateModel.id,
                prompt,
                systemPrompt,
                maxTokens,
                temperature,
              },
            },
            {
              onFirstToken: ({ ttftMs }) => {
                cleanupAttempt()
                // Provider is locked!
                hasEmittedFirstToken = true
                callbacks.onFirstToken?.(ttftMs)
              },
              onDelta: ({ delta }) => {
                cleanupAttempt()
                handleFilteredDelta(delta)
              },
              onDone: (data) => {
                cleanupAttempt()
                handleStreamCompletion(candidateModel, data.text, data.usage, attemptStartedAt)
                resolve()
              },
              onError: ({ error, partialText }) => {
                cleanupAttempt()
                const err = new Error(error)
                if (!hasEmittedFirstToken) {
                  // Failover before first token
                  candidateFailedBeforeFirstToken = true
                  failoverFromProvider = provider
                  failoverReason = error
                  providerCircuitBreaker.recordFailure(
                    provider,
                    classifyProviderError(err, provider),
                    Date.now() - attemptStartedAt
                  )
                  router.recordResult(candidateModel.id, Date.now() - attemptStartedAt, false)
                  resolve()
                } else {
                  // Keep partial text, do not failover mid-stream
                  if (!isStreamDone) {
                    isStreamDone = true
                    const tail = tagFilter.flush()
                    if (tail) accumulatedCleanedText += tail
                    callbacks.onError(err, accumulatedCleanedText || partialText)
                  }
                  resolve()
                }
              },
            }
          )

          cancelCurrent = () => {
            cleanupAttempt()
            if (cancelIpc) cancelIpc()
          }
        })

        if (!candidateFailedBeforeFirstToken && (hasEmittedFirstToken || isStreamDone)) {
          return
        }
      } else {
        // Fallback: Direct browser fetch
        const groqKey = String(settingsManager.get('groqKey') || '').trim()
        const llmKey = String(settingsManager.get('llmKey') || '').trim()
        const key = candidateModel.provider === 'Groq' ? groqKey : llmKey
        if (!key) continue

        const attemptStartedAt = Date.now()
        const directController = new AbortController()

        let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          if (!hasEmittedFirstToken && !isStreamDone) {
            failoverFromProvider = provider
            failoverReason = 'first_token_timeout'
            directController.abort()
          }
        }, FIRST_TOKEN_TIMEOUT_MS)

        cancelCurrent = () => directController.abort()

        try {
          await streamDirectFetch(
            candidateModel.provider as LLMProvider,
            candidateModel.id,
            key,
            prompt,
            maxTokens,
            temperature,
            systemPrompt,
            {
              onFirstToken: (ttftMs) => {
                if (firstTokenTimer) clearTimeout(firstTokenTimer)
                hasEmittedFirstToken = true
                callbacks.onFirstToken?.(ttftMs)
              },
              onDelta: (delta) => {
                if (firstTokenTimer) clearTimeout(firstTokenTimer)
                handleFilteredDelta(delta)
              },
              onDone: (data) => {
                if (firstTokenTimer) clearTimeout(firstTokenTimer)
                handleStreamCompletion(candidateModel, data.text, data.usage, attemptStartedAt)
              },
              onError: (err) => {
                if (firstTokenTimer) clearTimeout(firstTokenTimer)
                throw err
              },
            },
            directController.signal
          )
          return
        } catch (err: any) {
          if (firstTokenTimer) clearTimeout(firstTokenTimer)
          if (!hasEmittedFirstToken) {
            failoverFromProvider = provider
            failoverReason = err?.message || 'direct_fetch_failed'
            providerCircuitBreaker.recordFailure(
              provider,
              classifyProviderError(err, provider),
              Date.now() - attemptStartedAt
            )
            router.recordResult(candidateModel.id, Date.now() - attemptStartedAt, false)
          } else {
            if (!isStreamDone) {
              isStreamDone = true
              const tail = tagFilter.flush()
              if (tail) accumulatedCleanedText += tail
              callbacks.onError(err, accumulatedCleanedText)
            }
            return
          }
        }
      }
    }

    if (!isStreamDone && !hasEmittedFirstToken) {
      isStreamDone = true
      callbacks.onError(new Error('Tất cả provider LLM đều thất bại hoặc quá thời gian phản hồi.'), '')
    }
  }

  runSequence().catch((err) => {
    if (!isStreamDone) {
      isStreamDone = true
      callbacks.onError(err, accumulatedCleanedText)
    }
  })

  return () => {
    if (cancelCurrent) cancelCurrent()
  }
}

/**
 * Universal LLM caller: Retained as a wrapper around callUniversalLLMStream
 * to accumulate stream chunks into a complete string.
 * Keeps Diagnostics, summaries, and discussion fully operational.
 */
export async function callUniversalLLM(
  prompt: string,
  options?: UniversalLLMOptions
): Promise<UniversalLLMResult | null> {
  return new Promise<UniversalLLMResult | null>((resolve, reject) => {
    let accumulatedText = ''

    callUniversalLLMStream(
      prompt,
      {
        onDelta: (delta) => {
          accumulatedText += delta
        },
        onDone: (result) => {
          resolve(result)
        },
        onError: (error, partialText) => {
          const fallbackText = accumulatedText || partialText
          if (fallbackText.trim()) {
            resolve({
              text: fallbackText.trim(),
              provider: (options?.modelId ? 'Groq' : 'AI') as LLMProvider,
              modelId: options?.modelId || 'fallback',
              modelName: 'Partial Output',
            })
          } else {
            reject(error)
          }
        },
      },
      options
    ).catch(reject)
  })
}

