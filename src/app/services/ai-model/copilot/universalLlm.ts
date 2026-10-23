import { getAllAIModels, getSavedAIModelId } from '../aiModels'
import { modelRegistryService } from '../model-registry'
import { settingsManager } from '../../settings'
import type { UniversalLLMResult } from './types'
import type { LLMProvider } from '../types'
import { usageTrackerService, type AIUsageFeature } from '../../usage-tracker'

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
    throw new Error(err?.error?.message || `Groq error status: ${res.status}`)
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
    throw new Error(err?.error?.message || `Gemini error status: ${res.status}`)
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
    throw new Error(err?.error?.message || `OpenAI error status: ${res.status}`)
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
  }
): Promise<UniversalLLMResult | null> {
  const maxTokens = options?.maxTokens ?? 600
  const temperature = options?.temperature ?? 0.3
  const systemPrompt = options?.systemPrompt

  const explicitlySavedModelId = String(settingsManager.get('selectedLLM') || '').trim()
  const selectedModelId =
    options?.modelId?.trim() || explicitlySavedModelId || getSavedAIModelId()
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

  const validModels = getAllAIModels().filter(
    (model) =>
      model.provider === selectedModel.provider &&
      model.isLiveFromAPI &&
      modelRegistryService.getModelById(model.id)?.capabilities.includes('text')
  )
  const providerCandidates = [
    selectedModel,
    ...validModels.filter((model) => model.id !== selectedModel.id),
  ]

  // 0. High security path: If running in Electron with OS Credential Store, call via secure IPC
  if (typeof window !== 'undefined' && window.api?.credentials?.callLLM) {
    for (const candidateModel of providerCandidates) {
      try {
        let targetProvider = candidateModel.provider.toLowerCase()
        if (targetProvider === 'google') targetProvider = 'gemini'
        const hasKey = await window.api.credentials.hasApiKey(targetProvider)
        if (!hasKey) continue

        const res = await window.api.credentials.callLLM({
          provider: targetProvider,
          modelId: candidateModel.id,
          prompt,
          systemPrompt,
          maxTokens,
          temperature,
        })
        if (res && res.text) {
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
          }
        }
      } catch (ipcErr) {
        console.warn(
          `[universalLlm] Secure call failed for discovered model ${candidateModel.id}:`,
          ipcErr
        )
      }
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
    try {
      console.log(`[universalLlm] Calling LLM API: ${candidate.provider} (${candidate.modelId})`)
      let apiRes: ApiCallResponse | null = null
      if (candidate.provider === 'Groq') {
        apiRes = await callGroqAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt)
      } else if (candidate.provider === 'Google') {
        apiRes = await callGoogleGeminiAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt)
      } else if (candidate.provider === 'OpenAI') {
        apiRes = await callOpenAIAPI(prompt, candidate.modelId, candidate.key, maxTokens, temperature, systemPrompt)
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
        }
      }
    } catch (err) {
      console.warn(`[universalLlm] Candidate ${candidate.provider} failed:`, err)
    }
  }

  return null
}
