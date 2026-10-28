import type { RoutingDecision } from '../model-router'
export type { ResponseLanguage } from '../language'
export type { AnswerStrategyId } from '../strategy'
export type { NormalizedIntent } from '../intent'
export type {
  ClaimClassification,
  ClaimType,
  GroundingRisk,
  GroundingEvidence,
  GroundingClaim,
  GroundingResult,
} from '../grounding'
export type { DocumentSourceType, RetrievalCitation, RetrievalDiagnostics } from '../context'
export type { UniversalLLMResult } from '../llm'

import type { AnswerStrategyId } from '../strategy'
import type { GroundingResult } from '../grounding'
import type { RetrievalCitation, RetrievalDiagnostics } from '../context'

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
  retrieval?: {
    citations: RetrievalCitation[]
    diagnostics: RetrievalDiagnostics
  }
  usage?: {
    inputTokens: number
    outputTokens: number
    cachedTokens?: number
    uncachedTokens?: number
    cacheHitRate?: number
    estimatedCostUsd?: number | null
  }
  routing?: RoutingDecision
  failover?: {
    switched: boolean
    fromProvider?: string
    toProvider?: string
    reason?: string
  }
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
