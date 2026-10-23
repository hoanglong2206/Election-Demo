import type { VisualAnalysisResult, VisualContentType } from './types'
import { settingsManager } from '../settings'
import { modelRegistryService } from '../ai-model/model-registry'
import { usageTrackerService } from '../usage-tracker'

export const VISUAL_ANALYSIS_SYSTEM_PROMPT = `Bạn là Trợ lý AI Cố vấn Kỹ thuật và Phỏng vấn Cấp cao.
Nhiệm vụ của bạn là xem ảnh chụp màn hình chứa câu hỏi phỏng vấn kỹ thuật, bài toán coding (LeetCode/HackerRank/Codeforces), thông báo lỗi, sơ đồ kiến trúc hệ thống, hoặc câu hỏi tình huống công nghệ.

Hãy phân tích kỹ lưỡng các chi tiết hình ảnh, code, diagram, constraints, và trả về định dạng JSON thuần túy (hoặc bọc trong \`\`\`json):
{
  "contentType": "coding_question" | "error_trace" | "architecture_diagram" | "system_design" | "text_question",
  "title": "Tiêu đề ngắn gọn rõ ràng của câu hỏi/vấn đề",
  "language": "Ngôn ngữ lập trình chính nếu có (ví dụ: TypeScript, Python, Java, Go, C++, SQL)",
  "difficulty": "Easy" | "Medium" | "Hard",
  "extractedCode": "Đoạn mã nguồn hoặc function signature trích xuất từ ảnh (nếu có)",
  "problemSummary": "Tóm tắt 1-3 câu đề bài đang yêu cầu gì và các ràng buộc cốt lõi (constraints)",
  "keyInsights": [
    "Nhận định then chốt 1 (edge case, bẫy thường gặp)",
    "Cấu trúc dữ liệu / thuật toán tối ưu (Two Pointers, DP, Monotonic Stack, Cache L1/L2...)"
  ],
  "stepByStepSolution": "Các bước giải quyết tối ưu (nêu rõ Time & Space Complexity)",
  "recommendedAnswer": "Lời gợi ý trả lời tự tin, súc tích để người dùng nói trực tiếp với interviewer hoặc đồng nghiệp trong cuộc họp"
}`

export interface AnalyzeVisualOptions {
  imageBase64: string
  mimeType?: string
  thumbnailUrl?: string
  userContext?: string
  customModelId?: string
  customProvider?: 'Google' | 'OpenAI' | 'Groq'
  sessionId?: string
}

export class VisualQuestionAnalyzer {
  /**
   * Dispatches multimodal analysis request to preferred vision model.
   * Prioritizes secure OS Credential Store IPC in Electron, with direct web fallback.
   */
  public async analyzeVisualQuestion(options: AnalyzeVisualOptions): Promise<VisualAnalysisResult> {
    const startTime = performance.now()
    const { imageBase64, mimeType = 'image/jpeg', thumbnailUrl = '', userContext, customModelId, customProvider, sessionId } = options

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
    const userPrompt = userContext
      ? `Hãy phân tích câu hỏi/nội dung kỹ thuật trong ảnh này. Lưu ý ngữ cảnh bổ sung từ người dùng: ${userContext}`
      : 'Hãy phân tích chi tiết câu hỏi/nội dung kỹ thuật xuất hiện trong ảnh chụp màn hình này.'

    // Determine target provider & model
    const savedMultimodalId = (settingsManager.get('selectedMultimodal') as string) || ''
    let candidateModelId = customModelId || savedMultimodalId

    if (!candidateModelId) {
      const visionModels = modelRegistryService.getMultimodalModels()
      if (visionModels.length > 0) {
        candidateModelId = visionModels[0].id
      } else {
        throw new Error(
          'Chưa cấu hình mô hình Multimodal Vision. Vui lòng vào Cài đặt để đồng bộ và chọn mô hình phân tích ảnh (Google Gemini, GPT-4o,...).'
        )
      }
    }

    const validation = modelRegistryService.validateSelectedModel(candidateModelId, 'vision')
    const targetModelId = validation.valid
      ? candidateModelId
      : (validation.recommendedReplacement?.id || candidateModelId)

    const modelMeta = modelRegistryService.getModelById(targetModelId)
    let provider: 'Google' | 'OpenAI' | 'Groq' =
      customProvider || (modelMeta?.provider as any) || 'Google'
    if (!customProvider && !modelMeta) {
      if (targetModelId.includes('gpt') || targetModelId.includes('openai')) provider = 'OpenAI'
      else if (targetModelId.includes('llama') || targetModelId.includes('vision-preview')) provider = 'Groq'
      else provider = 'Google'
    }

    let rawTextResponse = ''
    let usageInfo: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } | undefined

    // ── Path 1: Secure Electron Main Process OS Credential Store ──────────────
    if (typeof window !== 'undefined' && window.api?.credentials?.callMultimodalLLM) {
      try {
        const ipcProvider = provider.toLowerCase()
        const res = await window.api.credentials.callMultimodalLLM({
          provider: ipcProvider,
          modelId: targetModelId,
          prompt: userPrompt,
          systemPrompt: VISUAL_ANALYSIS_SYSTEM_PROMPT,
          imageBase64: cleanBase64,
          mimeType,
          maxTokens: 1800,
          temperature: 0.2,
        })

        if (res && res.text) {
          rawTextResponse = res.text
          if (res.usage) {
            usageInfo = {
              inputTokens: res.usage.prompt_tokens,
              outputTokens: res.usage.completion_tokens,
              cachedTokens: res.usage.cached_tokens,
            }
          }
        }
      } catch (ipcErr: any) {
        console.warn('[VisualQuestionAnalyzer] IPC Multimodal call warning:', ipcErr)
      }
    }

    // ── Path 2: Direct Frontend Web Fallback using Settings API Key ───────────
    if (!rawTextResponse) {
      const direct = await this.callDirectWebProvider(
        provider,
        targetModelId,
        cleanBase64,
        mimeType,
        userPrompt
      )
      rawTextResponse = direct.text
      if (direct.usage) {
        usageInfo = direct.usage
      }
    }

    // ── Track Usage & Cost ──────────────────────────────────────────────────
    try {
      usageTrackerService.trackUsage({
        sessionId,
        provider,
        model: targetModelId,
        feature: 'visual_question',
        inputTokens: usageInfo?.inputTokens,
        outputTokens: usageInfo?.outputTokens,
        cachedTokens: usageInfo?.cachedTokens,
      })
    } catch (trackErr) {
      console.warn('[VisualQuestionAnalyzer] Failed to track usage:', trackErr)
    }

    const elapsed = Math.round(performance.now() - startTime)
    return this.parseModelResponse(rawTextResponse, thumbnailUrl, provider, targetModelId, elapsed)
  }

  /**
   * Direct Web API request when running outside Electron or testing.
   */
  private async callDirectWebProvider(
    provider: string,
    modelId: string,
    cleanBase64: string,
    mimeType: string,
    prompt: string
  ): Promise<{ text: string; usage?: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } }> {
    if (provider === 'Google') {
      const geminiKey = String(settingsManager.get('llmKey') || '').trim()
      if (!geminiKey) {
        throw new Error('Chưa cấu hình Google Gemini API Key trong Cài đặt.')
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } },
                ],
              },
            ],
            systemInstruction: { parts: [{ text: VISUAL_ANALYSIS_SYSTEM_PROMPT }] },
            generationConfig: { maxOutputTokens: 1800, temperature: 0.2 },
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`Google Vision API (${res.status}): ${err?.error?.message || 'Lỗi gọi Gemini'}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const usageMeta = data?.usageMetadata
      const usage = usageMeta
        ? {
            inputTokens: usageMeta.promptTokenCount,
            outputTokens: usageMeta.candidatesTokenCount,
            cachedTokens: usageMeta.cachedContentTokenCount,
          }
        : undefined

      return { text, usage }
    }

    if (provider === 'OpenAI') {
      const openAiKey = String(settingsManager.get('llmKey') || '').trim()
      if (!openAiKey) {
        throw new Error('Chưa cấu hình OpenAI API Key trong Cài đặt.')
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: VISUAL_ANALYSIS_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${cleanBase64}`, detail: 'high' },
                },
              ],
            },
          ],
          max_tokens: 1800,
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(`OpenAI Vision API (${res.status}): ${err?.error?.message || 'Lỗi gọi GPT-4o'}`)
      }

      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content || ''
      const usage = data?.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
          }
        : undefined

      return { text, usage }
    }

    throw new Error(`Chưa có API key được cấu hình cho provider ${provider}. Hãy kiểm tra tab Cài đặt.`)
  }

  /**
   * Robust JSON parsing from LLM markdown fences or raw JSON.
   */
  public parseModelResponse(
    rawText: string,
    thumbnailUrl: string,
    provider: string,
    modelName: string,
    latencyMs: number
  ): VisualAnalysisResult {
    const id = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const now = new Date()
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    let parsed: any = null
    try {
      // Strip markdown ```json fences if present
      let cleaned = rawText.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim()
      }
      parsed = JSON.parse(cleaned)
    } catch {
      // Fallback regex search for JSON block
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {}
      }
    }

    if (parsed && typeof parsed === 'object') {
      const validTypes: VisualContentType[] = [
        'coding_question',
        'error_trace',
        'architecture_diagram',
        'system_design',
        'text_question',
      ]
      const contentType: VisualContentType = validTypes.includes(parsed.contentType)
        ? parsed.contentType
        : 'coding_question'

      return {
        id,
        timestamp,
        contentType,
        title: parsed.title || 'Câu hỏi trên màn hình',
        language: parsed.language || undefined,
        difficulty: parsed.difficulty || undefined,
        extractedCode: parsed.extractedCode || undefined,
        problemSummary: parsed.problemSummary || rawText.slice(0, 300),
        keyInsights: Array.isArray(parsed.keyInsights)
          ? parsed.keyInsights
          : ['Phân tích yêu cầu bài toán', 'Đảm bảo xử lý edge cases'],
        stepByStepSolution: parsed.stepByStepSolution || 'Xem đề xuất câu trả lời bên dưới.',
        recommendedAnswer: parsed.recommendedAnswer || rawText,
        thumbnailUrl,
        provider,
        modelName,
        latencyMs,
      }
    }

    // Text fallback if model did not produce valid JSON
    return {
      id,
      timestamp,
      contentType: 'text_question',
      title: 'Nội dung phân tích từ màn hình',
      problemSummary: rawText.slice(0, 300) || 'Đã phân tích ảnh chụp màn hình thành công.',
      keyInsights: ['Xem nội dung chi tiết trong câu trả lời'],
      stepByStepSolution: 'Phân tích tự do từ mô hình Multimodal.',
      recommendedAnswer: rawText || 'Không có phản hồi từ mô hình.',
      thumbnailUrl,
      provider,
      modelName,
      latencyMs,
    }
  }
}

export const visualQuestionAnalyzer = new VisualQuestionAnalyzer()
