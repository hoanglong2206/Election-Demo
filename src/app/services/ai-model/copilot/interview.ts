import type { CopilotInterviewResult } from './types'
import { callUniversalLLM, callUniversalLLMStream } from '../llm'
import { looksLikeJson, stripCodeFences } from './parseOptions'
import {
  languageInstruction,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '../language'
import { tieredContextManager, TieredContextManager } from '../context'
import {
  answerStrategyRouter,
  selectAnswerStrategy,
  type AnswerStrategyId,
} from '../strategy'
import {
  type IntentDetectionResult,
  recordFalseTrigger,
} from '../intent'
import { validateAnswerGrounding, type GroundingMode } from '../grounding'
import {
  createInterviewDocuments,
  localRagIndex,
  type LocalRagOptions,
} from '../context'
import { buildStaticSystemPrefix, buildDynamicUserPrompt } from './promptTemplate'
import { isFullContextNeeded } from '../context'
import { usageTrackerService } from '../../usage-tracker'
import {
  IntentGateStreamParser,
  stripGateTag,
  inferStrategyFromGateIntent,
  isDistinctStrategyMismatch,
  recordGateCall,
  recordGateCancelled,
  recordGatePassed,
  type GateDecision,
} from '../intent'

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
  onGateDecision?: (decision: GateDecision) => void
}

export interface GenerateInterviewAnswerParams {
  question: string
  fullTurnText?: string
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
  fullContext?: boolean
  hasReRouted?: boolean
}

/**
 * Backward compatible prompt generator (delegates to static prefix + dynamic user prompt).
 */
export function buildInterviewPrompt(params: {
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
 * Leverages byte-identical static prefix caching across turns to minimize token costs.
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

  const useFullContext = params.fullContext ?? isFullContextNeeded(question)
  const candidateContext = cm.getCandidateContext(useFullContext)
  const perm = cm.getPermanentContext()

  // 1. Static Prefix: 100% byte-invariant across turns for prompt caching
  const systemPrompt = buildStaticSystemPrefix({
    candidateContext,
    role: perm.role,
    companyName: perm.companyName,
    customInstructions: perm.customInstructions,
  })

  // 2. Assemble dynamic context (rolling session summary + short-term utterances)
  const assembled = cm.assembleContext(question, 'interview', {
    fullContext: useFullContext,
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

  // 3. Dynamic User Prompt: Strategy directive + top-k RAG + rolling summary + recent turns + question
  const dynamicPrompt = buildDynamicUserPrompt({
    question,
    fullTurnText: params.fullTurnText,
    strategyDirective: `${strategy.label}\n${strategy.buildPrompt({ question, intent: params.intent })}`,
    retrievalContext: retrieval.context,
    sessionMemoryBlock: assembled.sessionMemoryBlock,
    recentTranscriptBlock: assembled.shortTermBlock,
    lang,
  })

  recordGateCall()

  const gateParser = new IntentGateStreamParser({
    isAmbiguous: params.intent?.isAmbiguous,
    initialConfidence: params.intent?.confidence,
  })

  let accumulated = ''
  let activeCancelStream: (() => void) | null = null
  let isAbortedByGate = false
  let gateResolved = false
  let hasReRouted = params.hasReRouted ?? false

  const cancelStream = await callUniversalLLMStream(
    dynamicPrompt,
    {
      onFirstToken: (ttftMs) => {
        callbacks.onFirstToken?.(ttftMs)
      },
      onDelta: (delta) => {
        if (isAbortedByGate) return
        accumulated += delta

        const parseResult = gateParser.processDelta(delta)

        if (parseResult.status === 'buffering') {
          // Buffering line 1 for intent gate resolution; do not emit to UI
          return
        }

        if (parseResult.status === 'abort') {
          isAbortedByGate = true
          recordGateCancelled(parseResult.wastedChars)
          recordFalseTrigger()
          if (activeCancelStream) {
            activeCancelStream()
          }
          callbacks.onError(
            new Error(`Stream aborted by Intent Gate: ${parseResult.reason || 'not an interview question'}`),
            ''
          )
          return
        }

        if (parseResult.status === 'pass') {
          if (!gateResolved) {
            gateResolved = true
            recordGatePassed()
            if (parseResult.decision) {
              callbacks.onGateDecision?.(parseResult.decision)

              // Requirement 6: Strategy re-routing (max 1 restart if distinct mismatch)
              if (!hasReRouted) {
                const gateIntent = parseResult.decision.intent
                if (isDistinctStrategyMismatch(selection.strategyId, gateIntent)) {
                  const newStrategyId = inferStrategyFromGateIntent(gateIntent)
                  if (newStrategyId && newStrategyId !== selection.strategyId) {
                    console.log(
                      `[IntentGate] Strategy mismatch detected (${selection.strategyId} vs ${gateIntent}). Re-routing to ${newStrategyId} (max 1 restart)`
                    )
                    hasReRouted = true
                    if (activeCancelStream) {
                      activeCancelStream()
                    }
                    void generateInterviewAnswerStream(
                      {
                        ...params,
                        strategyOverride: newStrategyId,
                        hasReRouted: true,
                      },
                      callbacks
                    ).then((restartedCancel) => {
                      activeCancelStream = restartedCancel
                    })
                    return
                  }
                }
              }
            }
          }

          if (parseResult.contentDelta) {
            callbacks.onDelta(parseResult.contentDelta)
          }
        }
      },
      onDone: (rawRes) => {
        if (isAbortedByGate) return

        const cleanAccumulated = stripGateTag(accumulated)
        const text = stripCodeFences(cleanAccumulated || stripGateTag(rawRes.text))
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
          usage: rawRes.usage,
        })
      },
      onError: (err, partialText) => {
        if (isAbortedByGate) return
        callbacks.onError(err, stripGateTag(accumulated || partialText))
      },
    },
    {
      maxTokens: 600,
      temperature: 0.3,
      systemPrompt,
      sessionId,
      feature: 'copilot_interview',
      signal: params.signal,
    }
  )

  activeCancelStream = cancelStream
  return () => {
    if (activeCancelStream) {
      activeCancelStream()
    }
  }
}

/**
 * Generates an interview answer personalized to candidate CV and question.
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

  const useFullContext = params.fullContext ?? isFullContextNeeded(question)
  const candidateContext = cm.getCandidateContext(useFullContext)
  const perm = cm.getPermanentContext()

  // 1. Static Prefix: 100% byte-invariant across turns for prompt caching
  const systemPrompt = buildStaticSystemPrefix({
    candidateContext,
    role: perm.role,
    companyName: perm.companyName,
    customInstructions: perm.customInstructions,
  })

  // 2. Assemble dynamic context (rolling session summary + short-term utterances)
  const assembled = cm.assembleContext(question, 'interview', {
    fullContext: useFullContext,
  })

  const selection = selectAnswerStrategy(
    { question, intent: params.intent },
    params.strategyOverride
  )
  const strategy = answerStrategyRouter.get(selection.strategyId)

  // 3. Dynamic User Prompt: Strategy directive + top-k RAG + rolling summary + recent turns + question
  const dynamicPrompt = buildDynamicUserPrompt({
    question,
    fullTurnText: params.fullTurnText,
    strategyDirective: `${strategy.label}\n${strategy.buildPrompt({ question, intent: params.intent })}`,
    retrievalContext: retrieval.context,
    sessionMemoryBlock: assembled.sessionMemoryBlock,
    recentTranscriptBlock: assembled.shortTermBlock,
    lang,
  })

  const rawRes = await callUniversalLLM(dynamicPrompt, {
    maxTokens: 600,
    temperature: 0.3,
    systemPrompt,
    sessionId,
    feature: 'copilot_interview',
  })
  if (!rawRes) return null

  const text = stripCodeFences(stripGateTag(rawRes.text))
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

  const lines = (grounding.correctedAnswer || text).split('\n').map((l: string) => l.trim()).filter(Boolean)
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
    usage: rawRes.usage,
  }
}

export interface PrewarmCopilotCacheParams {
  cvSummary: string
  jobDescription?: string
  backgroundAnalysis?: string
  role?: string
  companyName?: string
  customInstructions?: string
  sessionId?: string
  contextManager?: TieredContextManager
}

export interface PrewarmResult {
  warmed: boolean
  modelName?: string
  provider?: string
  ttftMs?: number
  skippedReason?: string
}

/**
 * Pre-warms the provider's prompt cache before the first real interview question.
 * Sends a lightweight 1-token request containing the identical byte-invariant static candidate prefix.
 * Respects budget limits (aborts if budget guard is tripped).
 */
export async function prewarmCopilotCache(
  params: PrewarmCopilotCacheParams
): Promise<PrewarmResult> {
  const { cvSummary, jobDescription, backgroundAnalysis, role, companyName, customInstructions, sessionId } = params
  if (!cvSummary || !cvSummary.trim()) {
    return { warmed: false, skippedReason: 'no_cv' }
  }

  // Budget guard check: do not prewarm if monthly limit reached
  if (usageTrackerService.isBudgetExceeded()) {
    return { warmed: false, skippedReason: 'budget_exceeded' }
  }

  const cm = params.contextManager || tieredContextManager
  cm.setPermanentContext({
    cvSummary,
    jobDescription,
    backgroundAnalysis,
    role,
    companyName,
    customInstructions,
  })

  const candidateContext = cm.getCandidateContext(false)
  const systemPrompt = buildStaticSystemPrefix({
    candidateContext,
    role,
    companyName,
    customInstructions,
  })

  try {
    const started = performance.now()
    const result = await callUniversalLLM('ping', {
      systemPrompt,
      maxTokens: 1,
      temperature: 0,
      sessionId,
      feature: 'copilot_interview',
    })

    const ttftMs = Math.round(performance.now() - started)
    return {
      warmed: !!result,
      modelName: result?.modelName,
      provider: result?.provider,
      ttftMs,
    }
  } catch (err) {
    console.warn('[prewarmCopilotCache] Pre-warm failed silently (will proceed without cache warmup):', err)
    return { warmed: false, skippedReason: 'llm_error' }
  }
}
