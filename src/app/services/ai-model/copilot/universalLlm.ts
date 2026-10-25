import { getAllAIModels, getSavedAIModelId } from '../aiModels'
import { modelRegistryService } from '../model-registry'
import { settingsManager } from '../../settings'
import type { UniversalLLMResult } from './types'
import type { LLMProvider } from '../types'
import { usageTrackerService, type AIUsageFeature } from '../../usage-tracker'
import { smartModelRouter, type ModelRouterRequest, type SmartModelRouter } from '../model-router'
import {
  classifyProviderError,
  getDefaultRetryPolicy,
  providerCircuitBreaker,
  waitForRetry,
} from '../model-router'

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

interface ApiCallResponse {
  text: string
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
}

function providerError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Provider request timeout'), { name: 'AbortError' })), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function callGroqAPI(
  prompt: string,
  modelId: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
  systemPrompt?: string
): Promise<ApiCallResponse | null> {
  const modelToUse = modelId
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw providerError(err?.error?.message || `Groq error status: ${res.status}`, res.status)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) return null
  return {
    text,
    inputTokens: data?.usage?.prompt_tokens,
    outputTokens: data?.usage?.completion_tokens,
  }
}

async function callGoogleGeminiAPI(
  prompt: string,
  modelId: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
  systemPrompt?: string
): Promise<ApiCallResponse | null> {
  let modelToUse = modelId
  if (modelToUse.startsWith('models/')) {
    modelToUse = modelToUse.replace('models/', '')
  }
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelToUse
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemPrompt
            ? { system_instruction: { parts: [{ text: systemPrompt }] } }
            : {}),
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      }
    )
  } catch (err: any) {
    const safeMsg = String(err?.message || err).replace(/([?&]key=)[^&]+/gi, '$1***')
    throw new Error(`Google Gemini network error: ${safeMsg}`)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw providerError(err?.error?.message || `Gemini error status: ${res.status}`, res.status)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null
  return {
    text,
    inputTokens: data?.usageMetadata?.promptTokenCount,
    outputTokens: data?.usageMetadata?.candidatesTokenCount,
    cachedTokens: data?.usageMetadata?.cachedContentTokenCount,
  }
}

async function callOpenAIAPI(
  prompt: string,
  modelId: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
  systemPrompt?: string
): Promise<ApiCallResponse | null> {
  const modelToUse = modelId
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw providerError(err?.error?.message || `OpenAI error status: ${res.status}`, res.status)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) return null
  return {
    text,
    inputTokens: data?.usage?.prompt_tokens,
    outputTokens: data?.usage?.completion_tokens,
    cachedTokens: data?.usage?.prompt_tokens_details?.cached_tokens,
  }
}

/**
 * Universal LLM caller: uses the selected API-discovered model and, when it
 * fails, tries other API-discovered text models from the same provider.
 */
export async function callUniversalLLM(
  prompt: string,
  options?: {
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
  }
): Promise<UniversalLLMResult | null> {
  const maxTokens = options?.maxTokens ?? 600
  const temperature = options?.temperature ?? 0.3
  const systemPrompt = options?.systemPrompt

  const explicitlySavedModelId = String(settingsManager.get('selectedLLM') || '').trim()
  const router = options?.routing?.router || smartModelRouter
  const routingDecision = options?.routing?.enabled === false
    ? undefined
    : router.decide({
        feature: options?.feature || 'general',
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
    throw new Error(
      'Chưa có mô hình LLM khả dụng. Vào Cài đặt, nhập API key, đồng bộ model từ API rồi chọn một model trước khi gọi AI.'
    )
  }

  if (
    !registryModel ||
    !selectedModel ||
    !registryModel.isLiveFromAPI ||
    !registryModel.capabilities.includes('text')
  ) {
    throw new Error(
      `Model "${selectedModelId}" không có trong danh sách model đã đồng bộ. Vào Cài đặt, đồng bộ lại danh sách và chọn một model hiện có.`
    )
  }
  const requestStartedAt = Date.now()
  const retryPolicy = getDefaultRetryPolicy()
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
  let failoverFromProvider: string | undefined
  let failoverReason: string | undefined

  // 0. High security path: If running in Electron with OS Credential Store, call via secure IPC
  if (typeof window !== 'undefined' && window.api?.credentials?.callLLM) {
    for (const candidateModel of providerCandidates) {
      const provider = candidateModel.provider
      if (!providerCircuitBreaker.canRequest(provider)) continue
      try {
        let targetProvider = candidateModel.provider.toLowerCase()
        if (targetProvider === 'google') targetProvider = 'gemini'
        const hasKey = await window.api.credentials.hasApiKey(targetProvider)
        if (!hasKey) continue

        const attemptStartedAt = Date.now()
        let res
        let attempt = 0
        while (attempt < retryPolicy.maxAttempts) {
          attempt += 1
          try {
            res = await withTimeout(window.api.credentials.callLLM({
              provider: targetProvider,
              modelId: candidateModel.id,
              prompt,
              systemPrompt,
              maxTokens,
              temperature,
            }), Math.max(250, retryPolicy.latencyBudgetMs - (Date.now() - requestStartedAt)))
            break
          } catch (error) {
            const failure = classifyProviderError(error, provider)
            providerCircuitBreaker.recordFailure(provider, failure, Date.now() - attemptStartedAt)
            router.recordResult(candidateModel.id, Date.now() - attemptStartedAt, false)
            failoverReason = failure.type
            if (!failure.retryable || attempt >= retryPolicy.maxAttempts) break
            await waitForRetry(attempt, retryPolicy)
          }
        }
        if (res && res.text) {
          providerCircuitBreaker.recordSuccess(provider, Date.now() - attemptStartedAt)
          router.recordResult(candidateModel.id, Date.now() - attemptStartedAt, true)
          const resolvedProvider = (res.provider || selectedModel.provider) as LLMProvider
          const usageRecord = usageTrackerService.trackUsage({
            sessionId: options?.sessionId,
            provider: resolvedProvider,
            model: candidateModel.id,
            feature: options?.feature || 'copilot',
            inputTokens: res.usage?.inputTokens,
            outputTokens: res.usage?.outputTokens,
            cachedTokens: res.usage?.cachedTokens,
          })

          return {
            text: res.text,
            modelId: candidateModel.id,
            modelName: res.modelName,
            provider: resolvedProvider,
            usage: {
              inputTokens: usageRecord.inputTokens || 0,
              outputTokens: usageRecord.outputTokens || 0,
              cachedTokens: usageRecord.cachedTokens,
              estimatedCostUsd: usageRecord.estimatedCostUsd,
            },
            routing: routingDecision,
            failover: {
              switched: Boolean(failoverFromProvider),
              fromProvider: failoverFromProvider,
              toProvider: provider,
              reason: failoverReason,
            },
          }
        }
      } catch (ipcErr) {
        const failure = classifyProviderError(ipcErr, provider)
        providerCircuitBreaker.recordFailure(provider, failure, Date.now() - requestStartedAt)
        router.recordResult(candidateModel.id, Date.now() - requestStartedAt, false)
        failoverReason = failure.type
        console.warn(
          `[universalLlm] Secure call failed for discovered model ${candidateModel.id}:`,
          ipcErr
        )
      }
      if (!failoverFromProvider) failoverFromProvider = provider
    }
  }

  const groqKey = String(settingsManager.get('groqKey') || '').trim()
  const llmKey = String(settingsManager.get('llmKey') || '').trim()

  const providerAttempts: Array<{
    provider: LLMProvider
    key: string
    modelId: string
    modelName: string
  }> = []

  // Try the selected model first, then only API-discovered models from the same
  // provider. No model ID is synthesized or substituted here.
  for (const candidateModel of providerCandidates) {
    const key = candidateModel.provider === 'Groq' ? groqKey : llmKey
    if (!key) continue

    providerAttempts.push({
      provider: candidateModel.provider as LLMProvider,
      key,
      modelId: candidateModel.id,
      modelName: candidateModel.name,
    })
  }

  // 3. Execute in sequence
  for (const candidate of providerAttempts) {
    if (!providerCircuitBreaker.canRequest(candidate.provider)) {
      console.info(`[universalLlm] Circuit open; skipping provider ${candidate.provider}`)
      continue
    }
    try {
      console.log(`[universalLlm] Calling LLM API: ${candidate.provider} (${candidate.modelId})`)
      const attemptStartedAt = Date.now()
      let apiRes: ApiCallResponse | null = null
      let attempt = 0
      while (attempt < retryPolicy.maxAttempts) {
        attempt += 1
        try {
          const remainingBudget = Math.max(250, retryPolicy.latencyBudgetMs - (Date.now() - requestStartedAt))
          if (candidate.provider === 'Groq') {
            apiRes = await withTimeout(callGroqAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt), remainingBudget)
          } else if (candidate.provider === 'Google') {
            apiRes = await withTimeout(callGoogleGeminiAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt), remainingBudget)
          } else if (candidate.provider === 'OpenAI') {
            apiRes = await withTimeout(callOpenAIAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt), remainingBudget)
          }
          break
        } catch (error) {
          const failure = classifyProviderError(error, candidate.provider)
          providerCircuitBreaker.recordFailure(candidate.provider, failure, Date.now() - attemptStartedAt)
          router.recordResult(candidate.modelId, Date.now() - attemptStartedAt, false)
          failoverReason = failure.type
          if (!failure.retryable || attempt >= retryPolicy.maxAttempts) break
          await waitForRetry(attempt, retryPolicy)
        }
      }

      if (apiRes && apiRes.text && apiRes.text.trim()) {
        const cleanedText = apiRes.text
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
          .trim()

        const usageRecord = usageTrackerService.trackUsage({
          sessionId: options?.sessionId,
          provider: candidate.provider,
          model: candidate.modelId,
          feature: options?.feature || 'copilot',
          inputTokens: apiRes.inputTokens,
          outputTokens: apiRes.outputTokens,
          cachedTokens: apiRes.cachedTokens,
        })

        console.log(`[universalLlm] LLM responded successfully from ${candidate.provider}`)
        providerCircuitBreaker.recordSuccess(candidate.provider, Date.now() - attemptStartedAt)
        router.recordResult(candidate.modelId, Date.now() - requestStartedAt, true)
        return {
          text: cleanedText || apiRes.text.trim(),
          provider: candidate.provider,
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          usage: {
            inputTokens: usageRecord.inputTokens || 0,
            outputTokens: usageRecord.outputTokens || 0,
            cachedTokens: usageRecord.cachedTokens,
            estimatedCostUsd: usageRecord.estimatedCostUsd,
          },
          routing: routingDecision,
          failover: {
            switched: Boolean(failoverFromProvider),
            fromProvider: failoverFromProvider,
            toProvider: candidate.provider,
            reason: failoverReason,
          },
        }
      }
    } catch (err) {
      const failure = classifyProviderError(err, candidate.provider)
      providerCircuitBreaker.recordFailure(candidate.provider, failure, Date.now() - requestStartedAt)
      router.recordResult(candidate.modelId, Date.now() - requestStartedAt, false)
      failoverReason = failure.type
      console.warn(`[universalLlm] Candidate ${candidate.provider} failed:`, err)
    }
    if (!failoverFromProvider) failoverFromProvider = candidate.provider
  }

  return null
}
