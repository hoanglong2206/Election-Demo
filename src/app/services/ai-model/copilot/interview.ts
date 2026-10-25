import type { CopilotInterviewResult } from './types'
import { callUniversalLLM } from './universalLlm'
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

/**
 * Generates an interview answer personalized to the candidate CV and question.
 * Uses 4-Tier Context Architecture to keep prompt bounded and cost-efficient.
 */
export async function generateInterviewAnswer(params: {
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
}): Promise<CopilotInterviewResult | null> {
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
    params.strategyOverride,
  )
  const strategy = answerStrategyRouter.get(selection.strategyId)

  const prompt = `Bạn là AI Cố vấn phỏng vấn xuất sắc (Interview Copilot).
Ứng viên đang tham gia phỏng vấn tuyển dụng.

${assembled.fullPromptContext}

${retrieval.context ? `Evidence citations available for grounding:\n${retrieval.context}` : ''}

${languageInstruction(lang)}

Yêu cầu phản hồi:
1. Đưa ra câu trả lời phỏng vấn xuất sắc, tự tin, TRẢ LỜI ĐÚNG trọng tâm câu hỏi vừa nêu ở TẦNG 4.
2. Phải nối tiếp mạch hội thoại trong TẦNG 2 & TẦNG 3 ở trên — nếu người phỏng vấn đang hỏi tiếp về một chủ đề đã trao đổi, hãy trả lời nhất quán với những gì đã nói trước đó.
3. Framework được chọn: ${strategy.label}.
   ${strategy.buildPrompt({ question, intent: params.intent })}
4. Nếu câu hỏi liên quan đến kiến thức/kinh nghiệm có trong CV (TẦNG 1), chỉ lồng ghép dự án, số liệu và kinh nghiệm thực tế có trong CV/transcript.
5. Không bịa ra công nghệ, dự án hay số liệu không có trong CV/transcript.
6. Mặc định giữ câu trả lời ngắn cho teleprompter; ưu tiên 3-6 ý chính và mở rộng chỉ khi cần.

Trả về chính xác theo định dạng sau:
[FULL_ANSWER]
(Nội dung câu trả lời hoàn chỉnh, chi tiết, chuyên nghiệp)
[SHORT_ANSWER]
(Bản rút gọn súc tích 2-3 gạch đầu dòng các ý chính cần nói)`

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 750,
    temperature: 0.3,
    sessionId,
    feature: 'copilot_interview',
  })
  if (!rawRes) return null

  const text = stripCodeFences(rawRes.text)
  if (!text) return null

  // Label intentionally carries no provider/model annotation — that is already
  // surfaced by the pane header badge and the footer.
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
    session: backgroundAnalysis,
    mode: params.groundingMode || 'balanced',
  } as const

  // Model ignored the [FULL_ANSWER]/[SHORT_ANSWER] contract — still surface its
  // real output rather than dropping it, unless it is a raw JSON blob (which is
  // never meant to be shown to the user).
  if (!text.includes('[FULL_ANSWER]')) {
    if (looksLikeJson(text)) {
      console.warn('[interview] LLM returned unparseable JSON — refusing to render it raw')
      return null
    }
    const grounding = validateAnswerGrounding({
      answer: text,
      ...groundingBase,
      session: [groundingBase.session, retrieval.context].filter(Boolean).join('\n\n'),
    })
    const contextUsage = {
      totalTokens: assembled.estimatedTokens.total,
      maxBudget: assembled.tokenBudget.totalMax,
      usagePercent: assembled.usagePercent,
      breakdown: assembled.estimatedTokens,
    }

    return {
      label,
      content: grounding.correctedAnswer,
      shortContent: grounding.correctedAnswer
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n'),
      confidence: 95,
      modelName: rawRes.modelName,
      isRealLLM: true,
      contextUsage,
      strategy: strategyMetadata,
      grounding,
      retrieval: { citations: retrieval.citations, diagnostics: retrieval.diagnostics },
    }
  }

  const parts = text.split('[SHORT_ANSWER]')
  const full = parts[0].replace('[FULL_ANSWER]', '').trim()
  const short = parts[1] ? parts[1].trim() : full.split('\n').slice(0, 3).join('\n')
  const grounding = validateAnswerGrounding({
    answer: full,
    ...groundingBase,
    session: [groundingBase.session, retrieval.context].filter(Boolean).join('\n\n'),
  })

  return {
    label,
    content: grounding.correctedAnswer,
    shortContent: grounding.correctedAnswer || short,
    confidence: 97,
    modelName: rawRes.modelName,
    isRealLLM: true,
    contextUsage: {
      totalTokens: assembled.estimatedTokens.total,
      maxBudget: assembled.tokenBudget.totalMax,
      usagePercent: assembled.usagePercent,
      breakdown: assembled.estimatedTokens,
    },
    strategy: strategyMetadata,
    grounding,
    retrieval: { citations: retrieval.citations, diagnostics: retrieval.diagnostics },
  }
}
