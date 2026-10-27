import type { VisualAnalysisResult, VisualContentType } from './types'
import { settingsManager } from '../settings'
import { modelRegistryService } from '../ai-model/model-registry'
import { smartModelRouter } from '../ai-model/model-router'
import { usageTrackerService } from '../usage-tracker'
import { languageInstruction, type ResponseLanguage } from '../ai-model/language'

export const VISUAL_ANALYSIS_SYSTEM_PROMPT = `Bạn là Trợ lý AI Cố vấn Kỹ thuật và Phỏng vấn Cấp cao.
Nhiệm vụ của bạn là xem ảnh chụp màn hình chứa câu hỏi phỏng vấn kỹ thuật, bài toán coding (LeetCode/HackerRank/Codeforces), thông báo lỗi, sơ đồ kiến trúc hệ thống, hoặc câu hỏi tình huống công nghệ.

Hãy phân tích kỹ lưỡng các chi tiết hình ảnh, code, diagram, constraints, và trả về định dạng JSON thuần túy (hoặc bọc trong \`\`\`json):
{
  "contentType": "coding_question" | "error_trace" | "architecture_diagram" | "system_design" | "text_question",
  "title": "Tiêu đề ngắn gọn rõ ràng của câu hỏi/vấn đề",
  "language": "Ngôn ngữ lập trình chính được nhận diện từ code/signature/đề bài (ví dụ: TypeScript, Python, Java, Go, C++, SQL); nếu không có code thì ghi null",
  "difficulty": "Easy" | "Medium" | "Hard",
  "extractedCode": "Chỉ trích xuất code hoặc function signature THỰC SỰ NHÌN THẤY trong ảnh; nếu ảnh chỉ có đề bài/văn bản, bắt buộc ghi null",
  "solutionCode": "Lời giải hoàn chỉnh, chạy được bằng đúng ngôn ngữ trong trường language; nếu không phải bài coding thì ghi null",
  "timeComplexity": "Độ phức tạp thời gian của lời giải tối ưu, ký hiệu Big-O",
  "spaceComplexity": "Độ phức tạp bộ nhớ của lời giải tối ưu, ký hiệu Big-O",
  "problemSummary": "Tóm tắt 1-3 câu đề bài đang yêu cầu gì và các ràng buộc cốt lõi (constraints)",
  "keyInsights": [
    "Nhận định then chốt 1 (edge case, bẫy thường gặp)",
    "Cấu trúc dữ liệu / thuật toán tối ưu (Two Pointers, DP, Monotonic Stack, Cache L1/L2...)"
  ],
  "stepByStepSolution": "Các bước giải quyết tối ưu; phải giải thích vì sao không thể cải thiện thêm theo constraints và nêu rõ Time & Space Complexity",
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
  responseLanguage?: ResponseLanguage
  implementationLanguage?: string
  languageContext?: string
}

export class VisualQuestionAnalyzer {
  /**
   * Dispatches multimodal analysis request to preferred vision model.
   * Prioritizes secure OS Credential Store IPC in Electron, with direct web fallback.
   */
  public async analyzeVisualQuestion(options: AnalyzeVisualOptions): Promise<VisualAnalysisResult> {
    const startTime = performance.now()
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      thumbnailUrl = '',
      userContext,
      customModelId,
      customProvider,
      sessionId,
      responseLanguage = 'bilingual',
      implementationLanguage,
      languageContext,
    } = options

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
    const languagePreference = languageInstruction(responseLanguage)
    const userPrompt = `${userContext
      ? `Hãy phân tích câu hỏi/nội dung kỹ thuật trong ảnh này. Lưu ý ngữ cảnh bổ sung từ người dùng: ${userContext}`
      : 'Hãy phân tích chi tiết câu hỏi/nội dung kỹ thuật xuất hiện trong ảnh chụp màn hình này.'}

${languagePreference}
${implementationLanguage
  ? `Ngôn ngữ triển khai BẮT BUỘC: ${implementationLanguage}. Hãy viết solutionCode bằng ngôn ngữ này, dù ảnh không có mã nguồn.`
  : 'Nếu đây là bài toán thuật toán trên màn kiểm tra, hãy dùng ngôn ngữ được nhận diện từ code/signature nếu có. Nếu không có code, không tự bịa extractedCode; chỉ viết solutionCode sau khi xác định được ngôn ngữ từ ngữ cảnh.'}
${languageContext ? `Ngữ cảnh JD/CV để xác định ngôn ngữ công nghệ phù hợp:\n${languageContext.slice(0, 12000)}` : ''}
Nếu không có mã nguồn trong ảnh, extractedCode phải là null. solutionCode là phần code AI tự viết và phải được phân biệt rõ với code trích xuất.`

    // Determine target provider & model
    const savedMultimodalId = (settingsManager.get('selectedMultimodal') as string) || ''
    const routing = smartModelRouter.decide({
      feature: 'visual_question',
      requiredModality: 'vision',
      manualModelId: customModelId || savedMultimodalId || undefined,
      policy: settingsManager.get('modelRouterPolicy'),
    })
    let candidateModelId = routing.selectedModelId || customModelId || savedMultimodalId

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
          maxTokens: 3000,
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

    if (!rawTextResponse) {
      throw new Error('Dịch vụ phân tích màn hình yêu cầu Electron IPC và khóa an toàn trong OS Credential Store.')
    }

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
    const candidates = [
      rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
      ...(rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.slice(1) || []),
    ]

    // Prefer a complete JSON object, including responses preceded by prose.
    const objectStart = rawText.indexOf('{')
    const objectEnd = rawText.lastIndexOf('}')
    if (objectStart >= 0 && objectEnd > objectStart) {
      candidates.push(rawText.slice(objectStart, objectEnd + 1))
    }

    for (const candidate of candidates) {
      try {
        const value = JSON.parse(candidate)
        parsed = typeof value === 'string' ? JSON.parse(value) : value
        if (parsed && typeof parsed === 'object') break
      } catch {
        // Try the next representation; the model may have added a markdown fence.
      }
    }

    // Preserve useful fields when a provider truncates the JSON after producing
    // the main answer. This prevents the UI from rendering the entire raw JSON.
    if (!parsed || typeof parsed !== 'object') {
      const readStringField = (field: string): string | undefined => {
        const match = rawText.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`, 's'))
        if (!match?.[1]) return undefined
        try {
          return JSON.parse(`"${match[1]}"`)
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        }
      }
      const partialTitle = readStringField('title')
      const partialLanguage = readStringField('language')
      const partialSolution = readStringField('solutionCode')
      const partialSummary = readStringField('problemSummary')
      if (partialTitle || partialLanguage || partialSolution || partialSummary) {
        parsed = {
          title: partialTitle,
          language: partialLanguage,
          solutionCode: partialSolution,
          problemSummary: partialSummary,
          recommendedAnswer: partialSolution,
        }
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
        solutionCode: parsed.solutionCode || undefined,
        timeComplexity: parsed.timeComplexity || undefined,
        spaceComplexity: parsed.spaceComplexity || undefined,
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
