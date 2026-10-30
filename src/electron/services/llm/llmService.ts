import * as electron from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const electronApp = (electron as any)?.app || (electron as any)?.default?.app

import {
  type CredentialProvider,
  type CallLLMInput,
  type CallMultimodalLLMInput,
  CallLLMInputSchema,
  CallMultimodalLLMInputSchema,
  sanitizeLogMessage,
  getElectronCredentialStore,
  type ElectronCredentialStore,
} from '../credentials/index.js'
import { resolveSafeSessionPath } from '../sessions/index.js'
import { SSEStreamParser } from './sseParser.js'
import { getValidatedModelId } from './modelDefaults.js'
import { parseJsonSafe, readStreamingBenchmark } from './benchmark.js'

export class ElectronLlmService {
  private readonly credentialStore: ElectronCredentialStore

  constructor(credentialStore?: ElectronCredentialStore) {
    this.credentialStore = credentialStore || getElectronCredentialStore()
  }

  /**
   * Flexible detection for Speech-to-Text / Audio Transcription models.
   */
  public isSTTModel(m: any): boolean {
    if (m.active === false) return false
    const outMods = Array.isArray(m.output_modalities) ? m.output_modalities : []
    const inMods = Array.isArray(m.input_modalities) ? m.input_modalities : []
    if (outMods.includes('transcription') && inMods.includes('audio')) {
      return true
    }
    const id = String(m.id || '').toLowerCase()
    const sttKeywords = ['whisper', 'transcribe', 'speech', 'audio', 'stt', 'conformer', 'mms', 'canary']
    return sttKeywords.some((k) => id.includes(k))
  }

  /**
   * Dynamically formats STT model configuration from API response metadata.
   */
  public formatSTTModel(m: any, provider: string = 'Groq') {
    const id = String(m.id || '')
    const low = id.toLowerCase()
    const isTurbo = low.includes('turbo') || low.includes('fast') || low.includes('distil')

    const rawName = m.name || id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    const displayName = rawName.toLowerCase().startsWith(provider.toLowerCase())
      ? rawName
      : `${provider} ${rawName}`

    const modelLatency = isTurbo ? 180 : 240
    const badge = isTurbo ? 'LPU Siêu Tốc (~180ms)' : 'LPU Cloud (~240ms)'

    const ownerTag = m.owned_by ? ` (${m.owned_by})` : ''
    const description = `Nhận diện giọng nói STT trên hạ tầng ${provider} LPU qua mô hình ${rawName}${ownerTag}.`

    const recommendedFor = isTurbo
      ? 'Tốc độ phản hồi cực nhanh ~180ms, độ trễ thấp nhất cho phụ đề trực tiếp & hội thoại thời gian thực.'
      : 'Độ chính xác nhận diện cao, xử lý song ngữ và đa ngôn ngữ chuẩn xác trên đám mây Groq.'

    return {
      id,
      name: displayName,
      provider,
      badge,
      description,
      requiresKey: provider.toLowerCase(),
      latencyMs: modelLatency,
      recommendedFor,
      tier: 'Pro',
      ownedBy: m.owned_by,
      contextLength: m.context_window || m.context_length,
    }
  }

  /**
   * Verifies an API key by calling the provider's test endpoint directly from Main process.
   */
  public async verifyApiKey(
    rawProvider: string,
    rawKey?: string
  ): Promise<{
    valid: boolean
    provider: string
    message: string
    pingMs?: number
    modelCount?: number
    models?: any[]
    sttModels?: any[]
  }> {
    const provider = this.credentialStore.normalizeProvider(rawProvider)
    const key = rawKey?.trim() || this.credentialStore.getDecryptedKey(provider)

    if (!key) {
      return {
        valid: false,
        provider,
        message: `Chưa có API key được cấu hình cho ${provider} trong OS Credential Store.`,
      }
    }

    try {
      if (provider === 'groq') {
        const pingStart = Date.now()
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${key}`,
          },
        })
        const pingMs = Date.now() - pingStart
        if (!res.ok) {
          const err = await parseJsonSafe(res)
          return {
            valid: false,
            provider,
            message: `Xác thực Groq thất bại (${res.status}): ${err?.error?.message || 'Khóa không hợp lệ'}`,
          }
        }
        const data = await parseJsonSafe(res)
        const allModels = Array.isArray(data?.data) ? data.data : []
        const sttModels = allModels
          .filter((m: any) => this.isSTTModel(m))
          .map((m: any) => this.formatSTTModel(m, 'Groq'))
        const models = allModels.filter((m: any) => !this.isSTTModel(m) && m.active !== false)
        return {
          valid: true,
          provider: 'Groq',
          message: `Khóa Groq hợp lệ! Đã kết nối thành công tới Groq Cloud (${models.length} LLM, ${sttModels.length} STT, Ping: ~${pingMs}ms).`,
          pingMs,
          modelCount: models.length,
          models,
          sttModels,
        }
      }

      if (provider === 'openai') {
        const pingStart = Date.now()
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${key}`,
          },
        })
        const pingMs = Date.now() - pingStart
        if (!res.ok) {
          const err = await parseJsonSafe(res)
          return {
            valid: false,
            provider,
            message: `Xác thực OpenAI thất bại (${res.status}): ${err?.error?.message || 'Khóa không hợp lệ'}`,
          }
        }
        const data = await parseJsonSafe(res)
        const rawList = Array.isArray(data?.data) ? data.data : []
        const nonChatPrefixes = [
          'text-embedding-',
          'whisper-',
          'tts-',
          'dall-e-',
          'moderation-',
        ]
        const models = rawList
          .filter((m: any) => {
            const id = String(m.id || '').toLowerCase()
            return id.length > 0 && !nonChatPrefixes.some((prefix) => id.startsWith(prefix))
          })
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            provider: 'OpenAI',
            contextWindow: 128000,
            tier: 'Cloud AI',
            pingMs,
          }))
        return {
          valid: true,
          provider: 'OpenAI',
          message: `Khóa OpenAI hợp lệ! Đã kết nối thành công tới OpenAI GPT (${models.length} models khả dụng, Ping: ~${pingMs}ms).`,
          pingMs,
          modelCount: models.length,
          models,
        }
      }

      if (provider === 'gemini') {
        const pingStart = Date.now()
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models',
          {
            headers: {
              'x-goog-api-key': key,
            },
          }
        )
        const pingMs = Date.now() - pingStart
        if (!res.ok) {
          const err = await parseJsonSafe(res)
          return {
            valid: false,
            provider,
            message: `Xác thực Google Gemini thất bại (${res.status}): ${err?.error?.message || 'Khóa không hợp lệ'}`,
          }
        }
        const data = await parseJsonSafe(res)
        const rawList = Array.isArray(data?.models) ? data.models : []
        const nonChatKeywords = [
          'tts',
          'embed',
          'audio',
          'whisper',
          'transcribe',
          'guard',
          'realtime',
        ]
        const models = rawList
          .filter((m: any) => {
            if (!m.name || !m.name.includes('gemini')) return false
            const cleanId = m.name.replace(/^models\//, '').toLowerCase()
            if (nonChatKeywords.some((k: string) => cleanId.includes(k))) return false
            if (Array.isArray(m.supportedGenerationMethods)) {
              return m.supportedGenerationMethods.includes('generateContent')
            }
            return true
          })
          .map((m: any) => {
            const cleanId = m.name.replace(/^models\//, '')
            return {
              id: cleanId,
              name: m.displayName || cleanId,
              provider: 'Google',
              contextWindow: m.inputTokenLimit || 1000000,
              tier: 'Cloud AI',
              pingMs,
            }
          })
        return {
          valid: true,
          provider: 'Google Gemini',
          message: `Khóa Google Gemini hợp lệ! Đã kết nối thành công tới Google AI (${models.length} models khả dụng, Ping: ~${pingMs}ms).`,
          pingMs,
          modelCount: models.length,
          models,
        }
      }

      return { valid: false, provider, message: 'Provider không được hỗ trợ.' }
    } catch (err) {
      return {
        valid: false,
        provider,
        message: `Lỗi kết nối khi xác thực ${provider}: ${sanitizeLogMessage(err)}`,
      }
    }
  }

  private async callLLMStreaming(input: CallLLMInput, key: string, provider: CredentialProvider) {
    const modelId = getValidatedModelId(provider, input.modelId)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let url: string
    let body: any
    if (provider === 'groq' || provider === 'openai') {
      url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
      headers.Authorization = `Bearer ${key}`
      const reasoningModel = provider === 'openai' && /^(o[134]|gpt-5)/i.test(modelId)
      const messages = [
        ...(input.systemPrompt ? [{ role: reasoningModel ? 'developer' : 'system', content: input.systemPrompt }] : []),
        { role: 'user', content: input.prompt },
      ]
      body = {
        model: modelId,
        messages,
        max_completion_tokens: input.maxTokens ?? 250,
        ...(!reasoningModel ? { temperature: input.temperature ?? 0.2 } : {}),
        stream: true,
        ...(provider === 'openai' || provider === 'groq' ? { stream_options: { include_usage: true } } : {}),
      }
    } else if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`
      headers['x-goog-api-key'] = key
      body = { contents: [{ parts: [{ text: input.prompt }] }], generationConfig: { maxOutputTokens: input.maxTokens ?? 250, temperature: input.temperature ?? 0.2 }, ...(input.systemPrompt ? { systemInstruction: { parts: [{ text: input.systemPrompt }] } } : {}) }
    } else throw new Error(`Provider không được hỗ trợ: ${provider}`)
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await parseJsonSafe(res)
      const message = err?.error?.message || err?.message || 'Request failed'
      const label = provider === 'gemini' ? 'Google Gemini' : provider[0].toUpperCase() + provider.slice(1)
      throw new Error(`${label} error (${res.status}): ${message}`)
    }
    return { ...(await readStreamingBenchmark(res, provider)), modelName: modelId, provider }
  }

  /**
   * Real-time streaming LLM call via Server-Sent Events (SSE).
   */
  public async streamLLM(
    input: CallLLMInput,
    callbacks: {
      onFirstToken?: (data: { ttftMs: number }) => void
      onDelta: (data: { delta: string }) => void
      onDone: (data: {
        text: string
        modelName: string
        provider: string
        usage?: {
          inputTokens?: number
          outputTokens?: number
          cachedTokens?: number
        }
        benchmark: {
          ttftMs: number
          generationMs: number
          outputTokens?: number
        }
      }) => void
      onError: (data: { error: string; partialText: string }) => void
    },
    signal?: AbortSignal
  ): Promise<void> {
    const validated = CallLLMInputSchema.parse(input)
    const targetProvider: CredentialProvider = validated.provider || 'groq'
    const key = this.credentialStore.getDecryptedKey(targetProvider)

    if (!key) {
      callbacks.onError({
        error: `Chưa có API key được cấu hình cho ${targetProvider} trong OS Credential Store.`,
        partialText: '',
      })
      return
    }

    const modelId = getValidatedModelId(targetProvider, validated.modelId)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let url: string
    let body: any

    if (targetProvider === 'groq' || targetProvider === 'openai') {
      url = targetProvider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
      headers.Authorization = `Bearer ${key}`
      const reasoningModel = targetProvider === 'openai' && /^(o[134]|gpt-5)/i.test(modelId)
      const messages = [
        ...(validated.systemPrompt ? [{ role: reasoningModel ? 'developer' : 'system', content: validated.systemPrompt }] : []),
        { role: 'user', content: validated.prompt },
      ]
      body = {
        model: modelId,
        messages,
        max_completion_tokens: validated.maxTokens ?? 600,
        ...(!reasoningModel ? { temperature: validated.temperature ?? 0.3 } : {}),
        stream: true,
        stream_options: { include_usage: true },
      }
    } else if (targetProvider === 'gemini') {
      const cleanModelId = modelId.replace(/^models\//, '')
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModelId)}:streamGenerateContent?alt=sse`
      headers['x-goog-api-key'] = key
      body = {
        contents: [{ parts: [{ text: validated.prompt }] }],
        generationConfig: {
          maxOutputTokens: validated.maxTokens ?? 600,
          temperature: validated.temperature ?? 0.3,
        },
        ...(validated.systemPrompt ? { systemInstruction: { parts: [{ text: validated.systemPrompt }] } } : {}),
      }
    } else {
      callbacks.onError({
        error: `Provider không được hỗ trợ cho streaming: ${targetProvider}`,
        partialText: '',
      })
      return
    }

    let firstTokenAt: number | undefined
    const startedAt = performance.now()
    let batchBuffer = ''
    let batchTimer: ReturnType<typeof setTimeout> | null = null

    const flushBatch = () => {
      if (batchBuffer) {
        const delta = batchBuffer
        batchBuffer = ''
        callbacks.onDelta({ delta })
      }
    }

    const parser = new SSEStreamParser(targetProvider, {
      onDelta: (delta) => {
        const now = performance.now()
        if (firstTokenAt === undefined) {
          firstTokenAt = now
          const ttftMs = Math.round(now - startedAt)
          callbacks.onFirstToken?.({ ttftMs })
          callbacks.onDelta({ delta })
        } else {
          batchBuffer += delta
          if (!batchTimer) {
            batchTimer = setTimeout(() => {
              batchTimer = null
              flushBatch()
            }, 30)
          }
        }
      },
      onError: (streamErr) => {
        throw streamErr
      },
    })

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        const message = err?.error?.message || err?.message || `Request failed with status ${res.status}`
        const label = targetProvider === 'gemini' ? 'Google Gemini' : targetProvider[0].toUpperCase() + targetProvider.slice(1)
        throw new Error(`${label} error (${res.status}): ${message}`)
      }

      if (!res.body) {
        throw new Error('Provider không trả về luồng streaming.')
      }

      const reader = res.body.getReader()

      while (true) {
        if (signal?.aborted) {
          if (batchTimer) clearTimeout(batchTimer)
          reader.cancel().catch(() => {})
          throw new Error('Stream đã bị hủy bởi người dùng.')
        }

        const { value, done } = await reader.read()
        if (done) break

        parser.feed(value)
      }

      parser.flush()

      if (batchTimer) {
        clearTimeout(batchTimer)
        batchTimer = null
      }
      flushBatch()

      const endedAt = performance.now()
      const accumulatedText = parser.getAccumulatedText()
      const usage = parser.getUsage()
      callbacks.onDone({
        text: accumulatedText,
        modelName: modelId,
        provider: targetProvider,
        usage,
        benchmark: {
          ttftMs: Math.round((firstTokenAt ?? endedAt) - startedAt),
          generationMs: Math.max(1, Math.round(endedAt - (firstTokenAt ?? endedAt))),
          outputTokens: usage.outputTokens,
        },
      })
    } catch (err: any) {
      if (batchTimer) {
        clearTimeout(batchTimer)
        batchTimer = null
      }
      flushBatch()
      const accumulatedText = parser.getAccumulatedText()
      const usage = parser.getUsage()
      if (!usage.outputTokens && accumulatedText.length > 0) {
        usage.outputTokens = Math.max(1, Math.ceil(accumulatedText.length / 4))
      }
      callbacks.onError({
        error: sanitizeLogMessage(err?.message || err || 'Lỗi không xác định khi stream'),
        partialText: accumulatedText,
      })
    }
  }

  /**
   * Executes LLM requests directly in Main Process with decrypted credential.
   */
  public async callLLM(
    input: CallLLMInput
  ): Promise<{
    text: string
    modelName: string
    provider: string
    usage?: {
      inputTokens?: number
      outputTokens?: number
      cachedTokens?: number
      prompt_tokens?: number
      completion_tokens?: number
      cached_tokens?: number
    }
    benchmark?: { ttftMs: number; generationMs: number; outputTokens?: number }
  } | null> {
    const validated = CallLLMInputSchema.parse(input)
    const targetProvider: CredentialProvider = validated.provider || 'groq'
    const key = this.credentialStore.getDecryptedKey(targetProvider)

    if (!key) {
      throw new Error(`Chưa có API key được cấu hình cho ${targetProvider} trong OS Credential Store.`)
    }

    if (validated.stream) {
      if (!validated.modelId?.trim()) throw new Error('Benchmark yêu cầu model ID đã chọn, không được để trống.')
      return this.callLLMStreaming(validated, key, targetProvider)
    }

    const maxTokens = validated.maxTokens ?? 600
    const temperature = validated.temperature ?? 0.3
    const prompt = validated.prompt
    const systemPrompt = validated.systemPrompt

    if (targetProvider === 'groq') {
      let modelId = validated.modelId || 'llama-3.3-70b-versatile'
      const low = modelId.toLowerCase()
      if (
        low.includes('whisper') ||
        low.includes('tts') ||
        low.includes('transcribe') ||
        low.includes('audio') ||
        low.includes('speech') ||
        low.includes('embed') ||
        low.includes('guard')
      ) {
        console.warn(
          `[LlmService] Model '${modelId}' is not a chat completion model. Falling back to 'llama-3.3-70b-versatile'.`
        )
        modelId = 'llama-3.3-70b-versatile'
      }
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`Groq error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
          }
        : undefined
      return { text, modelName: modelId, provider: 'Groq', usage }
    }

    if (targetProvider === 'openai') {
      const modelId = validated.modelId || 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`OpenAI error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
          }
        : undefined
      return { text, modelName: modelId, provider: 'OpenAI', usage }
    }

    if (targetProvider === 'gemini') {
      const modelId = getValidatedModelId('gemini', validated.modelId)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature },
            ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
          }),
        }
      )

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`Google Gemini error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const usage = data?.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
            cachedTokens: data.usageMetadata.cachedContentTokenCount,
          }
        : undefined
      return { text, modelName: modelId, provider: 'Google', usage }
    }

    return null
  }

  /**
   * Executes Multimodal LLM requests with image & text directly in Main Process.
   */
  public async callMultimodalLLM(
    input: CallMultimodalLLMInput
  ): Promise<{
    text: string
    modelName: string
    provider: string
    usage?: {
      inputTokens?: number
      outputTokens?: number
      cachedTokens?: number
      prompt_tokens?: number
      completion_tokens?: number
      cached_tokens?: number
    }
  } | null> {
    const validated = CallMultimodalLLMInputSchema.parse(input)
    const targetProvider: CredentialProvider = validated.provider || 'gemini'
    const key = this.credentialStore.getDecryptedKey(targetProvider)

    if (!key) {
      throw new Error(`Chưa có API key được cấu hình cho ${targetProvider} trong OS Credential Store.`)
    }

    const maxTokens = validated.maxTokens ?? 1500
    const temperature = validated.temperature ?? 0.2
    const prompt = validated.prompt
    const systemPrompt = validated.systemPrompt
    const mimeType = validated.mimeType || 'image/jpeg'
    let cleanBase64 = ''

    if (validated.imageMediaUrl || validated.imagePath) {
      const srcUrl = validated.imageMediaUrl || validated.imagePath!
      const sessionsDir = path.join(electronApp ? electronApp.getPath('userData') : process.cwd(), 'sessions')
      const safePath = resolveSafeSessionPath(sessionsDir, srcUrl)
      if (safePath) {
        try {
          const buf = await fs.promises.readFile(safePath)
          cleanBase64 = buf.toString('base64')
        } catch (readErr) {
          console.warn('[LlmService] Failed to read image from resolved path:', readErr)
        }
      } else if (path.isAbsolute(srcUrl) && fs.existsSync(srcUrl)) {
        try {
          const buf = await fs.promises.readFile(srcUrl)
          cleanBase64 = buf.toString('base64')
        } catch (readErr) {
          console.warn('[LlmService] Failed to read image from absolute path:', readErr)
        }
      }
    }

    if (!cleanBase64 && validated.imageBase64) {
      cleanBase64 = validated.imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
    }

    if (!cleanBase64) {
      throw new Error('Không thể tải dữ liệu ảnh để gửi tới Vision API (thiếu imageBase64 hoặc file ảnh không tồn tại).')
    }

    // 1. Google Gemini Multimodal
    if (targetProvider === 'gemini') {
      const modelId = getValidatedModelId('gemini', validated.modelId)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: maxTokens, temperature },
            ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
          }),
        }
      )

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`Google Gemini Vision error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const usage = data?.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount,
            outputTokens: data.usageMetadata.candidatesTokenCount,
            cachedTokens: data.usageMetadata.cachedContentTokenCount,
          }
        : undefined
      return { text, modelName: modelId, provider: 'Google', usage }
    }

    // 2. OpenAI Multimodal (GPT-4o, GPT-4o-mini)
    if (targetProvider === 'openai') {
      const modelId = validated.modelId || 'gpt-4o-mini'
      const imageUrl = `data:${mimeType};base64,${cleanBase64}`
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`OpenAI Vision error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
          }
        : undefined
      return { text, modelName: modelId, provider: 'OpenAI', usage }
    }

    // 3. Groq Multimodal (Llama-3.2-Vision)
    if (targetProvider === 'groq') {
      const modelId = validated.modelId || 'llama-3.2-11b-vision-preview'
      const imageUrl = `data:${mimeType};base64,${cleanBase64}`
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })

      if (!res.ok) {
        const err = await parseJsonSafe(res)
        throw new Error(`Groq Vision error (${res.status}): ${err?.error?.message || 'Request failed'}`)
      }

      const data = await parseJsonSafe(res)
      const text = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined
      return { text, modelName: modelId, provider: 'Groq', usage }
    }

    return null
  }

  /**
   * Transcribes audio using Groq Whisper Cloud LPU in Main Process.
   */
  public async transcribeGroq(
    audioBase64: string,
    modelId: string = 'whisper-large-v3-turbo',
    language?: string,
    prompt?: string
  ): Promise<{ text: string; latencyMs: number } | null> {
    const key = this.credentialStore.getDecryptedKey('groq')
    if (!key) {
      throw new Error('Chưa có Groq API Key trong OS Credential Store.')
    }

    const cleanBase64 = (audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim()
    if (!cleanBase64) {
      return { text: '', latencyMs: 0 }
    }

    const buffer = Buffer.from(cleanBase64, 'base64')
    if (buffer.length === 0) {
      return { text: '', latencyMs: 0 }
    }

    // Determine container format and MIME type from header magic bytes
    let fileName = 'audio.wav'
    let mimeType = 'audio/wav'

    if (buffer.length >= 4) {
      if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
        fileName = 'audio.webm'
        mimeType = 'audio/webm'
      } else if (buffer.toString('ascii', 0, 4) === 'OggS') {
        fileName = 'audio.ogg'
        mimeType = 'audio/ogg'
      } else if (buffer.toString('ascii', 0, 4) === 'fLaC') {
        fileName = 'audio.flac'
        mimeType = 'audio/flac'
      } else if (
        buffer.toString('ascii', 0, 3) === 'ID3' ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      ) {
        fileName = 'audio.mp3'
        mimeType = 'audio/mpeg'
      } else if (buffer.toString('ascii', 0, 4) === 'RIFF') {
        fileName = 'audio.wav'
        mimeType = 'audio/wav'
      }
    }

    // If it's a WAV file with only a 44-byte header and no data samples, skip API call
    if (fileName === 'audio.wav' && buffer.length <= 44) {
      return { text: '', latencyMs: 0 }
    }

    const startTime = Date.now()
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType })

    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('model', modelId)
    formData.append('response_format', 'json')
    formData.append('temperature', '0')
    if (language && language !== 'auto') {
      formData.append('language', language)
    }
    if (prompt && prompt.trim()) {
      formData.append('prompt', prompt.trim())
    }

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: formData,
    })

    const latencyMs = Date.now() - startTime
    if (!res.ok) {
      const err = await parseJsonSafe(res)
      throw new Error(`Groq STT error (${res.status}): ${err?.error?.message || 'Request failed'}`)
    }

    const data = await parseJsonSafe(res)
    return {
      text: data.text || '',
      latencyMs,
    }
  }

  /**
   * Test a single model with an explicitly supplied, unsaved API key.
   */
  public async testModelAvailability(rawProvider: string, rawKey: string, modelId: string) {
    const provider = this.credentialStore.normalizeProvider(rawProvider)
    const key = rawKey.trim()
    const id = modelId.trim()
    if (!key) return { available: false, message: 'Nhập API key để kiểm tra model.' }
    if (!id) return { available: false, message: 'Thiếu model ID.' }

    let url: string
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: any
    if (provider === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`
      headers['x-goog-api-key'] = key
      body = { contents: [{ parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 8 } }
    } else {
      url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
      headers.Authorization = `Bearer ${key}`
      const reasoningModel = provider === 'openai' && /^(o[134]|gpt-5)/i.test(id)
      body = {
        model: id,
        messages: [
          ...(reasoningModel ? [{ role: 'developer', content: 'Reply with OK.' }] : []),
          { role: 'user', content: reasoningModel ? 'OK' : 'Reply with OK.' },
        ],
        max_completion_tokens: 8,
        stream: false,
      }
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
      if (response.ok) return { available: true, message: 'Model đã nhận request kiểm tra thành công.' }
      const errorBody = await parseJsonSafe(response)
      return {
        available: false,
        status: response.status,
        code: errorBody?.error?.code || errorBody?.error?.type || errorBody?.code,
        message: errorBody?.error?.message || errorBody?.message || response.statusText || 'Provider từ chối request.',
      }
    } catch (error: any) {
      return { available: false, message: error?.message || 'Không thể kết nối provider.' }
    }
  }

  /**
   * Syncs active models from all configured providers in OS Credential Store.
   */
  public async syncModels(): Promise<{
    totalLoaded: number
    providerBreakdown: string
    models: any[]
    sttModels?: any[]
    configuredProviders?: string[]
  }> {
    const models: any[] = []
    const sttModels: any[] = []
    const breakdown: string[] = []

    // 1. Groq
    const groqKey = this.credentialStore.getDecryptedKey('groq')
    if (groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqKey}` },
        })
        if (res.ok) {
          const data = await parseJsonSafe(res)
          if (Array.isArray(data?.data)) {
            const groqSTTs = data.data
              .filter((m: any) => this.isSTTModel(m))
              .map((m: any) => this.formatSTTModel(m, 'Groq'))

            sttModels.push(...groqSTTs)

            const nonChatKeywords = [
              'whisper',
              'tts',
              'transcribe',
              'audio',
              'speech',
              'embed',
              'guard',
              'safeguard',
              'moderation',
            ]
            const groqModels = data.data
              .filter((m: any) => {
                if (m.active === false) return false
                if (this.isSTTModel(m)) return false
                const low = String(m.id || '').toLowerCase()
                return !nonChatKeywords.some((k) => low.includes(k))
              })
              .map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
                provider: 'Groq',
                contextWindow: m.context_window || m.context_length || 8192,
                tier: 'Cloud LPU',
                ownedBy: m.owned_by,
              }))
            models.push(...groqModels)
            breakdown.push(`Groq: ${groqModels.length} LLM + ${groqSTTs.length} STT`)
          }
        }
      } catch {}
    }

    // 2. OpenAI
    const openAiKey = this.credentialStore.getDecryptedKey('openai')
    if (openAiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openAiKey}` },
        })
        if (res.ok) {
          const data = await parseJsonSafe(res)
          if (Array.isArray(data?.data)) {
            const nonChatPrefixes = [
              'text-embedding-',
              'whisper-',
              'tts-',
              'dall-e-',
              'moderation-',
            ]
            const gptModels = data.data
              .filter((m: any) => {
                const id = String(m.id || '').toLowerCase()
                return id.length > 0 && !nonChatPrefixes.some((prefix) => id.startsWith(prefix))
              })
              .map((m: any) => ({
                id: m.id,
                name: m.id,
                provider: 'OpenAI',
                contextWindow: 128000,
                tier: 'Cloud AI',
              }))
            models.push(...gptModels)
            breakdown.push(`OpenAI: ${gptModels.length}`)
          }
        }
      } catch {}
    }

    // 3. Gemini
    const geminiKey = this.credentialStore.getDecryptedKey('gemini')
    if (geminiKey) {
      try {
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models',
          {
            headers: {
              'x-goog-api-key': geminiKey,
            },
          }
        )
        if (res.ok) {
          const data = await parseJsonSafe(res)
          if (Array.isArray(data?.models)) {
            const nonChatKeywords = [
              'tts',
              'embed',
              'audio',
              'whisper',
              'transcribe',
              'guard',
              'realtime',
            ]
            const gemModels = data.models
              .filter((m: any) => {
                if (!m.name || !m.name.includes('gemini')) return false
                const cleanId = m.name.replace(/^models\//, '').toLowerCase()
                if (nonChatKeywords.some((k) => cleanId.includes(k))) return false
                if (Array.isArray(m.supportedGenerationMethods)) {
                  return m.supportedGenerationMethods.includes('generateContent')
                }
                return true
              })
              .map((m: any) => {
                const cleanId = m.name.replace(/^models\//, '')
                return {
                  id: cleanId,
                  name: m.displayName || cleanId,
                  provider: 'Google',
                  contextWindow: m.inputTokenLimit || 1000000,
                  tier: 'Cloud AI',
                }
              })
            models.push(...gemModels)
            breakdown.push(`Gemini: ${gemModels.length}`)
          }
        }
      } catch {}
    }

    const configuredProviders: string[] = []
    if (groqKey) configuredProviders.push('Groq')
    if (openAiKey) configuredProviders.push('OpenAI')
    if (geminiKey) configuredProviders.push('Google')

    return {
      totalLoaded: models.length,
      providerBreakdown: breakdown.join(', ') || 'Chưa có model nào',
      models,
      sttModels,
      configuredProviders,
    }
  }

  /**
   * Official authenticated text translation through Google Cloud Translation v2 or DeepL API.
   */
  public async translateText(params: {
    texts: string[]
    sourceLang?: string
    targetLang?: string
    provider?: 'google_translate' | 'deepl'
  }): Promise<{
    success: boolean
    translations: string[]
    error?: string
    status?: number
    retryAfterSec?: number
  }> {
    const { texts, sourceLang, targetLang = 'vi', provider = 'google_translate' } = params
    if (!texts || texts.length === 0) {
      return { success: true, translations: [] }
    }

    const key = this.credentialStore.getDecryptedKey(provider)
    if (!key) {
      if (provider === 'google_translate') {
        try {
          const translations = await Promise.all(
            texts.map(async (text) => {
              const trimmed = text.trim()
              if (!trimmed) return ''
              const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang || 'auto'}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`
              const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
              if (!res.ok) return trimmed
              const json = (await res.json()) as any
              if (Array.isArray(json) && Array.isArray(json[0])) {
                return json[0].map((seg: any) => seg?.[0] || '').join('').trim() || trimmed
              }
              return trimmed
            })
          )
          return { success: true, translations }
        } catch (err: any) {
          return {
            success: false,
            translations: texts,
            error: `Google Translate error: ${err?.message || 'network error'}`,
            status: 500,
          }
        }
      }

      return {
        success: false,
        translations: texts,
        error: `Chưa cấu hình API Key cho ${provider === 'deepl' ? 'DeepL' : 'Google Cloud Translation'} trong Credential Store`,
        status: 401,
      }
    }

    try {
      if (provider === 'deepl') {
        const isFree = key.endsWith(':fx')
        const url = isFree
          ? 'https://api-free.deepl.com/v2/translate'
          : 'https://api.deepl.com/v2/translate'

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: texts,
            target_lang: targetLang.toUpperCase(),
            ...(sourceLang ? { source_lang: sourceLang.toUpperCase() } : {}),
          }),
          signal: AbortSignal.timeout(4000),
        })

        if (!res.ok) {
          const retryAfter = res.headers.get('retry-after')
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined
          return {
            success: false,
            translations: texts,
            error: `DeepL HTTP error ${res.status}`,
            status: res.status,
            retryAfterSec,
          }
        }

        const json = (await res.json()) as any
        const translations = (json?.translations || []).map((t: any) => t.text || '')
        return { success: true, translations }
      } else {
        const url = 'https://translation.googleapis.com/language/translate/v2'
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            q: texts,
            target: targetLang,
            format: 'text',
            ...(sourceLang ? { source: sourceLang } : {}),
          }),
          signal: AbortSignal.timeout(4000),
        })

        if (!res.ok) {
          const retryAfter = res.headers.get('retry-after')
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined
          return {
            success: false,
            translations: texts,
            error: `Google Cloud Translation HTTP error ${res.status}`,
            status: res.status,
            retryAfterSec,
          }
        }

        const json = (await res.json()) as any
        const translations = (json?.data?.translations || []).map((t: any) => t.translatedText || '')
        return { success: true, translations }
      }
    } catch (err: any) {
      return {
        success: false,
        translations: texts,
        error: err instanceof Error ? err.message : String(err),
        status: err?.name === 'TimeoutError' ? 408 : 500,
      }
    }
  }
}

let llmServiceInstance: ElectronLlmService | null = null

export function getElectronLlmService(): ElectronLlmService {
  if (!llmServiceInstance) {
    llmServiceInstance = new ElectronLlmService()
  }
  return llmServiceInstance
}
