import { getAllAIModels, getSavedAIModelId } from '../aiModels'
import { modelRegistryService } from '../model-registry'
import { settingsManager } from '../../settings'
import type { UniversalLLMResult } from './types'
import type { AIModelConfig, LLMProvider } from '../types'
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


export interface UniversalLLMStreamCallbacks {
  onFirstToken?: (ttftMs: number) => void
  onDelta: (delta: string) => void
  onDone: (result: UniversalLLMResult) => void
  onError: (
    error: Error,
    partialText: string,
    metadata?: { provider?: LLMProvider; modelId?: string; modelName?: string; usage?: any }
  ) => void
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

const apiKeyCache = new Map<string, { hasKey: boolean; timestamp: number }>()
const API_KEY_CACHE_TTL_MS = 60_000

export function invalidateApiKeyCache(provider?: string): void {
  if (provider) {
    const p = provider.toLowerCase()
    apiKeyCache.delete(p)
    if (p === 'google' || p === 'gemini') {
      apiKeyCache.delete('google')
      apiKeyCache.delete('gemini')
    }
  } else {
    apiKeyCache.clear()
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('credential-store:key-changed', (e: any) => {
    invalidateApiKeyCache(e?.detail?.provider)
  })
}

export async function checkCachedHasApiKey(provider: string): Promise<boolean> {
  const norm = provider.toLowerCase() === 'google' ? 'gemini' : provider.toLowerCase()
  const cached = apiKeyCache.get(norm)
  const now = Date.now()
  if (cached && now - cached.timestamp < API_KEY_CACHE_TTL_MS) {
    return cached.hasKey
  }
  if (typeof window !== 'undefined' && window.api?.credentials?.hasApiKey) {
    const hasKey = await window.api.credentials.hasApiKey(norm)
    apiKeyCache.set(norm, { hasKey, timestamp: now })
    return hasKey
  }
  return false
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
  const hasIPC = typeof window !== 'undefined' && Boolean(window.api?.credentials?.streamLLM)
  if (!hasIPC) {
    const err = new Error(
      'Electron IPC streaming API (window.api.credentials.streamLLM) không khả dụng. Ứng dụng từ chối gọi LLM trực tiếp từ Renderer để bảo vệ API key.'
    )
    callbacks.onError(err, '')
    return () => {}
  }

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

  const fallbackModelConfig: AIModelConfig = {
    id: selectedModelId,
    name: selectedModelId.includes('70b')
      ? 'Llama 3.3 70B'
      : selectedModelId.includes('gemini')
      ? 'Google Gemini Flash'
      : selectedModelId.includes('gpt')
      ? 'OpenAI GPT-4o Mini'
      : selectedModelId,
    provider: (selectedModelId.includes('gemini')
      ? 'Google'
      : selectedModelId.includes('gpt')
      ? 'OpenAI'
      : 'Groq') as LLMProvider,
    contextWindow: '128k',
    tier: 'Free',
    badgeColor: '#10B981',
    pingMs: 0,
    description: '',
    recommendedFor: '',
    isLiveFromAPI: true,
  }

  const selectedModel: AIModelConfig =
    getAllAIModels().find((model) => model.id === selectedModelId) ||
    fallbackModelConfig

  if (selectedModelId === 'no-model-configured') {
    const err = new Error(
      'Chưa có mô hình LLM khả dụng. Vào Cài đặt, nhập API key, đồng bộ model từ API rồi chọn một model trước khi gọi AI.'
    )
    callbacks.onError(err, '')
    return () => {}
  }

  const validModels = getAllAIModels().filter((model) =>
    model.isLiveFromAPI &&
    modelRegistryService.getModelById(model.id)?.capabilities.includes('text')
  )
  const fallbackCandidates: AIModelConfig[] = routingDecision?.fallbackChain
    ? routingDecision.fallbackChain
        .map((item) => validModels.find((model) => model.id === item.modelId))
        .filter((model): model is AIModelConfig => Boolean(model))
    : [selectedModel]

  const providerCandidates: AIModelConfig[] = validModels.length > 0
    ? [
        ...(fallbackCandidates.length > 0 ? fallbackCandidates : [selectedModel]),
        ...validModels.filter((model) =>
          model.provider === selectedModel.provider &&
          model.id !== selectedModel.id &&
          !routingDecision?.fallbackChain?.some((item) => item.modelId === model.id)
        ),
      ]
    : [selectedModel]

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
    candidate: AIModelConfig,
    resText: string,
    usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } | undefined,
    attemptStartedAt: number,
    benchmarkData?: { ttftMs: number; generationMs: number; outputTokens?: number },
    deltaCount = 0
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

    const now = performance.now()
    const rendererTtftMs = Math.round(now - attemptStartedAt)
    const genMs = benchmarkData?.generationMs ?? Math.max(1, Math.round(now - attemptStartedAt))
    const mainTtft = benchmarkData?.ttftMs
    const ipcLag = mainTtft !== undefined ? Math.max(0, rendererTtftMs - mainTtft) : undefined
    const deltasPerSec =
      genMs > 0 && deltaCount > 0 ? Math.round((deltaCount / (genMs / 1000)) * 10) / 10 : undefined

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
      benchmark: {
        ttftMs: rendererTtftMs,
        generationMs: genMs,
        outputTokens: usageRecord.outputTokens,
        mainTtftMs: mainTtft,
        ipcLagMs: ipcLag,
        deltasPerSec,
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
    const hasIPC = typeof window !== 'undefined' && Boolean(window.api?.credentials?.streamLLM)
    if (!hasIPC) {
      isStreamDone = true
      callbacks.onError(
        new Error(
          'Electron IPC streaming API (window.api.credentials.streamLLM) không khả dụng. Ứng dụng từ chối gọi LLM trực tiếp từ Renderer để bảo vệ API key.'
        ),
        ''
      )
      return
    }

    const skippedDueToMissingKey = new Set<string>()

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

      const hasKey = await checkCachedHasApiKey(targetProvider)
      if (!hasKey) {
        skippedDueToMissingKey.add(candidateModel.provider)
        continue
      }

      const attemptStartedAt = Date.now()
      const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        let candidateFailedBeforeFirstToken = false
        let firstTokenTimer: ReturnType<typeof setTimeout> | null = null
        let ipcDeltaCount = 0

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
                ipcDeltaCount++
                handleFilteredDelta(delta)
              },
              onDone: (data) => {
                cleanupAttempt()
                handleStreamCompletion(
                  candidateModel,
                  data.text,
                  data.usage,
                  attemptStartedAt,
                  data.benchmark,
                  ipcDeltaCount
                )
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
                    const partialOutput = accumulatedCleanedText || partialText
                    const partialTokens = Math.max(1, Math.ceil(partialOutput.length / 4))
                    callbacks.onError(err, partialOutput, {
                      provider: candidateModel.provider as LLMProvider,
                      modelId: candidateModel.id,
                      modelName: candidateModel.name,
                      usage: {
                        promptTokens: 0,
                        outputTokens: partialTokens,
                        totalTokens: partialTokens,
                      },
                    })
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
    }

    if (!isStreamDone && !hasEmittedFirstToken) {
      isStreamDone = true
      const errorMsg =
        skippedDueToMissingKey.size > 0 && skippedDueToMissingKey.size === providerCandidates.length
          ? `Chưa có API key cho ${Array.from(skippedDueToMissingKey).join(', ')}.`
          : 'Tất cả provider LLM đều thất bại hoặc quá thời gian phản hồi.'
      callbacks.onError(new Error(errorMsg), '')
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
        onError: (error, partialText, metadata) => {
          const fallbackText = accumulatedText || partialText
          if (fallbackText.trim() && metadata?.provider) {
            resolve({
              text: fallbackText.trim(),
              provider: metadata.provider,
              modelId: metadata.modelId || options?.modelId || 'fallback',
              modelName: metadata.modelName || 'Partial Output',
              usage: metadata.usage,
              truncated: true,
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

