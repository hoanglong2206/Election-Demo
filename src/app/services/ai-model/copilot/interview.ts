import type { CopilotInterviewResult } from './types'
import { callUniversalLLM, callUniversalLLMStream } from './universalLlm'
import { looksLikeJson, stripCodeFences } from './parseOptions'
import {
  languageInstruction,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '../language'
import { tieredContextManager, TieredContextManager } from './contextManager'
import {
  answerStrategyRouter,
  selectAnswerStrategy,
  type AnswerStrategyId,
} from './answerStrategyRouter'
import type { IntentDetectionResult } from './questionDetector'
import { validateAnswerGrounding, type GroundingMode } from './answerGrounding'
import {
  createInterviewDocuments,
  localRagIndex,
  type LocalRagOptions,
} from './localRag'

export interface InterviewStreamInit {
  label: string
  strategy: {
    strategyId: AnswerStrategyId
    confidence: number
    reasoningTags: string[]
    outputSections: string[]
  }
  retrieval: {
    citations: any[]
    diagnostics: any
  }
  contextUsage: {
    totalTokens: number
    maxBudget: number
    usagePercent: number
    breakdown: any
  }
  groundingBase: {
    cv: string
    profile: string
    transcript?: string
    session?: string
    mode: GroundingMode
  }
}

export interface GenerateInterviewAnswerStreamCallbacks {
  onInit?: (init: InterviewStreamInit) => void
  onFirstToken?: (ttftMs: number) => void
  onDelta: (delta: string) => void
  onDone: (result: CopilotInterviewResult) => void
  onError: (error: Error, partialText: string) => void
}

export interface GenerateInterviewAnswerParams {
  question: string
  cvSummary: string
  backgroundAnalysis?: string
  transcriptLines?: { speaker: string; original: string; translated?: string }[]
  language?: ResponseLanguage
  contextManager?: TieredContextManager
  sessionId?: string
  intent?: IntentDetectionResult | null
  strategyOverride?: AnswerStrategyId
  groundingMode?: GroundingMode
  rag?: LocalRagOptions & {
    projects?: string[]
    portfolioNotes?: string
    companyResearch?: string
    interviewNotes?: string
  }
  signal?: AbortSignal
}

function buildInterviewPrompt(params: {
  assembled: ReturnType<TieredContextManager['assembleContext']>
  retrievalContext?: string
  lang: ResponseLanguage
  strategy: ReturnType<typeof answerStrategyRouter.get>
  question: string
  intent?: IntentDetectionResult | null
}): string {
  const { assembled, retrievalContext, lang, strategy, question, intent } = params
  return `Bạn là AI Cố vấn phỏng vấn xuất sắc (Interview Copilot).
Ứng viên đang tham gia phỏng vấn tuyển dụng trực tiếp.

${assembled.fullPromptContext}

${retrievalContext ? `Evidence citations available for grounding:\n${retrievalContext}` : ''}

${languageInstruction(lang)}

Framework câu trả lời: ${strategy.label}
${strategy.buildPrompt({ question, intent })}

QUY TẮC PHẢN HỒI (BẮT BUỘC TEXT THUẦN, KHÔNG JSON, KHÔNG THẺ TAG META):
1. CÂU ĐẦU TIÊN (<= 20 từ): Trả lời trực diện, tự tin và rõ ràng vào trọng tâm câu hỏi để ứng viên có thể ĐỌC VÀ NÓI ĐƯỢC NGAY LẬP TỨC trong giây đầu tiên.
2. PHẦN THÂN: Sau câu đầu tiên, xuống dòng và trình bày 3 đến 4 gạch đầu dòng ngắn gọn, súc tích mở rộng luận điểm.
3. DỮ LIỆU: Chỉ lồng ghép dự án, số liệu và kinh nghiệm thực tế có trong CV và ngữ cảnh. Không bịa đặt thông tin.
4. TỔNG ĐỘ DÀI: Từ 120 đến 180 từ.
5. Tuyệt đối KHÔNG trả về JSON, KHÔNG bọc thẻ [FULL_ANSWER] hay [SHORT_ANSWER]. Viết trực tiếp câu trả lời text thuần.`
}

/**
 * Generates interview answer in real-time streaming mode for TTFT < 1s.
 * Initializes metadata (strategy, citations) synchronously/pre-stream.
 */
export async function generateInterviewAnswerStream(
  params: GenerateInterviewAnswerParams,
  callbacks: GenerateInterviewAnswerStreamCallbacks
): Promise<() => void> {
  const { question, cvSummary, backgroundAnalysis, transcriptLines, sessionId } = params
  const lang = normalizeResponseLanguage(params.language)

  if (!question || !question.trim()) {
    callbacks.onError(new Error('Question is empty'), '')
    return () => {}
  }

  const cm = params.contextManager || tieredContextManager
  cm.setPermanentContext({
    cvSummary,
    backgroundAnalysis,
  })
  if (transcriptLines) {
    cm.setTranscriptLines(transcriptLines)
  }

  const ragDocuments = createInterviewDocuments({
    cv: cvSummary,
    jobDescription: cm.getPermanentContext().jobDescription,
    backgroundAnalysis,
    projects: params.rag?.projects,
    portfolioNotes: params.rag?.portfolioNotes,
    companyResearch: params.rag?.companyResearch,
    interviewNotes: params.rag?.interviewNotes,
  })
  await localRagIndex.indexDocuments(ragDocuments)
  const retrieval = await localRagIndex.query(question, params.rag)

  const assembled = cm.assembleContext(question, 'interview', {
    permanentOverride: retrieval.context
      ? `RETRIEVED EVIDENCE (use citations internally; do not invent facts):\n${retrieval.context}`
      : undefined,
  })

  const selection = selectAnswerStrategy(
    { question, intent: params.intent },
    params.strategyOverride
  )
  const strategy = answerStrategyRouter.get(selection.strategyId)
  const label = `✨ ${strategy.label}`

  const outputSections = selection.strategyId === 'coding'
    ? ['clarification', 'approach', 'optimal_solution', 'complexity', 'edge_cases', 'code']
    : selection.strategyId === 'system_design'
      ? ['requirements', 'assumptions', 'api', 'data_model', 'architecture', 'scalability', 'bottlenecks', 'tradeoffs']
      : selection.strategyId === 'database'
        ? ['alternatives', 'consistency', 'indexing', 'transactions', 'scalability', 'tradeoffs']
        : selection.strategyId === 'behavioral' || selection.strategyId === 'leadership'
          ? ['situation', 'task_or_context', 'action', 'result', 'learning']
          : ['answer', 'example_or_tradeoffs']

  const strategyMetadata = {
    strategyId: selection.strategyId,
    confidence: selection.confidence,
    reasoningTags: selection.reasoningTags,
    outputSections,
  }

  const contextUsage = {
    totalTokens: assembled.estimatedTokens.total,
    maxBudget: assembled.tokenBudget.totalMax,
    usagePercent: assembled.usagePercent,
    breakdown: assembled.estimatedTokens,
  }

  const groundingBase = {
    cv: cvSummary,
    profile: cvSummary,
    transcript: transcriptLines?.map((line) => `${line.speaker}: ${line.original}`).join('\n'),
    session: [backgroundAnalysis, retrieval.context].filter(Boolean).join('\n\n'),
    mode: params.groundingMode || 'balanced',
  } as const

  callbacks.onInit?.({
    label,
    strategy: strategyMetadata,
    retrieval: { citations: retrieval.citations, diagnostics: retrieval.diagnostics },
    contextUsage,
    groundingBase,
  })

  const prompt = buildInterviewPrompt({
    assembled,
    retrievalContext: retrieval.context,
    lang,
    strategy,
    question,
    intent: params.intent,
  })

  let accumulated = ''

  return callUniversalLLMStream(
    prompt,
    {
      onFirstToken: (ttftMs) => {
        callbacks.onFirstToken?.(ttftMs)
      },
      onDelta: (delta) => {
        accumulated += delta
        callbacks.onDelta(delta)
      },
      onDone: (rawRes) => {
        const text = stripCodeFences(accumulated || rawRes.text)
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const shortContent = lines.slice(0, 3).join('\n')

        callbacks.onDone({
          label,
          content: text,
          shortContent: shortContent || text,
          confidence: 97,
          modelName: rawRes.modelName,
          isRealLLM: true,
          contextUsage,
          strategy: strategyMetadata,
          retrieval: { citations: retrieval.citations, diagnostics: retrieval.diagnostics },
          routing: rawRes.routing,
          failover: rawRes.failover,
        })
      },
      onError: (err, partialText) => {
        callbacks.onError(err, accumulated || partialText)
      },
    },
    {
      maxTokens: 600,
      temperature: 0.3,
      sessionId,
      feature: 'copilot_interview',
      signal: params.signal,
    }
  )
}

/**
 * Generates an interview answer personalized to the candidate CV and question.
 * Backward compatible wrapper for non-streaming callers.
 */
export async function generateInterviewAnswer(
  params: GenerateInterviewAnswerParams
): Promise<CopilotInterviewResult | null> {
  const { question, cvSummary, backgroundAnalysis, transcriptLines, sessionId } = params
  const lang = normalizeResponseLanguage(params.language)

  if (!question || !question.trim()) return null

  const cm = params.contextManager || tieredContextManager
  cm.setPermanentContext({
    cvSummary,
    backgroundAnalysis,
  })
  if (transcriptLines) {
    cm.setTranscriptLines(transcriptLines)
  }

  const ragDocuments = createInterviewDocuments({
    cv: cvSummary,
    jobDescription: cm.getPermanentContext().jobDescription,
    backgroundAnalysis,
    projects: params.rag?.projects,
    portfolioNotes: params.rag?.portfolioNotes,
    companyResearch: params.rag?.companyResearch,
    interviewNotes: params.rag?.interviewNotes,
  })
  await localRagIndex.indexDocuments(ragDocuments)
  const retrieval = await localRagIndex.query(question, params.rag)
  const assembled = cm.assembleContext(question, 'interview', {
    permanentOverride: retrieval.context
      ? `RETRIEVED EVIDENCE (use citations internally; do not invent facts):\n${retrieval.context}`
      : undefined,
  })
  const selection = selectAnswerStrategy(
    { question, intent: params.intent },
    params.strategyOverride
  )
  const strategy = answerStrategyRouter.get(selection.strategyId)

  const prompt = buildInterviewPrompt({
    assembled,
    retrievalContext: retrieval.context,
    lang,
    strategy,
    question,
    intent: params.intent,
  })

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 600,
    temperature: 0.3,
    sessionId,
    feature: 'copilot_interview',
  })
  if (!rawRes) return null

  const text = stripCodeFences(rawRes.text)
  if (!text) return null
  if (looksLikeJson(text)) {
    console.warn('[interview] LLM returned unparseable JSON — refusing to render it raw')
    return null
  }

  const label = `✨ ${strategy.label}`
  const outputSections = selection.strategyId === 'coding'
    ? ['clarification', 'approach', 'optimal_solution', 'complexity', 'edge_cases', 'code']
    : selection.strategyId === 'system_design'
      ? ['requirements', 'assumptions', 'api', 'data_model', 'architecture', 'scalability', 'bottlenecks', 'tradeoffs']
      : selection.strategyId === 'database'
        ? ['alternatives', 'consistency', 'indexing', 'transactions', 'scalability', 'tradeoffs']
        : selection.strategyId === 'behavioral' || selection.strategyId === 'leadership'
          ? ['situation', 'task_or_context', 'action', 'result', 'learning']
          : ['answer', 'example_or_tradeoffs']
  const strategyMetadata = {
    strategyId: selection.strategyId,
    confidence: selection.confidence,
    reasoningTags: selection.reasoningTags,
    outputSections,
  }
  const groundingBase = {
    cv: cvSummary,
    profile: cvSummary,
    transcript: transcriptLines?.map((line) => `${line.speaker}: ${line.original}`).join('\n'),
    session: [backgroundAnalysis, retrieval.context].filter(Boolean).join('\n\n'),
    mode: params.groundingMode || 'balanced',
  } as const

  const grounding = validateAnswerGrounding({
    answer: text,
    ...groundingBase,
  })
  const contextUsage = {
    totalTokens: assembled.estimatedTokens.total,
    maxBudget: assembled.tokenBudget.totalMax,
    usagePercent: assembled.usagePercent,
    breakdown: assembled.estimatedTokens,
  }

  const lines = (grounding.correctedAnswer || text).split('\n').map((l) => l.trim()).filter(Boolean)
  const shortContent = lines.slice(0, 3).join('\n')

  return {
    label,
    content: grounding.correctedAnswer || text,
    shortContent,
    confidence: 97,
    modelName: rawRes.modelName,
    isRealLLM: true,
    contextUsage,
    strategy: strategyMetadata,
    grounding,
    retrieval: { citations: retrieval.citations, diagnostics: retrieval.diagnostics },
    routing: rawRes.routing,
    failover: rawRes.failover,
  }
}

