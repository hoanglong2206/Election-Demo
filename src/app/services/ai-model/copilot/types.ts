import type { LLMProvider } from '../types'
import type { AnswerStrategyId } from './answerStrategyRouter'
import type { GroundingResult } from './answerGrounding'

export interface ContextUsageInfo {
  totalTokens: number
  maxBudget: number
  usagePercent: number
  breakdown: {
    permanent: number
    sessionMemory: number
    shortTerm: number
    currentInput: number
  }
}

export interface CopilotInterviewResult {
  label: string
  content: string
  shortContent: string
  confidence: number
  modelName?: string
  isRealLLM?: boolean
  contextUsage?: ContextUsageInfo
  strategy?: {
    strategyId: AnswerStrategyId
    confidence: number
    reasoningTags: string[]
    outputSections: string[]
  }
  grounding?: GroundingResult
}

export interface CopilotDiscussionOption {
  id: number
  type: 'answer' | 'option'
  label: string
  content: string
  confidence: number
  modelName?: string
  isRealLLM?: boolean
  contextUsage?: ContextUsageInfo
}

export interface UniversalLLMResult {
  text: string
  provider: LLMProvider
  modelId: string
  modelName: string
  usage?: {
    inputTokens: number
    outputTokens: number
    cachedTokens?: number
    estimatedCostUsd?: number | null
  }
}
