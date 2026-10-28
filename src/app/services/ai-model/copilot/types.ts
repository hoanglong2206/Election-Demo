import type { LLMProvider } from '../types'
export type AnswerStrategyId =
  | 'behavioral'
  | 'leadership'
  | 'coding'
  | 'system_design'
  | 'database'
  | 'debugging'
  | 'architecture'
  | 'conceptual'
  | 'general'
export type NormalizedIntent =
  | 'direct_question'
  | 'implicit_question'
  | 'coding_problem'
  | 'system_design_problem'
  | 'behavioral_question'
  | 'clarification_request'
  | 'follow_up_question'
  | 'challenge_or_objection'
  | 'normal_conversation'

export type ClaimClassification = 'SUPPORTED' | 'INFERRED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'GENERAL_KNOWLEDGE'
export type ClaimType = 'personal_experience' | 'metric' | 'general_technical' | 'opinion_approach'
export type GroundingRisk = 'low' | 'medium' | 'high'

export interface GroundingEvidence {
  id: string
  source: 'cv' | 'profile' | 'jd' | 'transcript' | 'session'
  excerpt: string
  isCandidateSource: boolean
}

export interface GroundingClaim {
  id: string
  text: string
  classification: ClaimClassification
  confidence: number
  evidenceRefs: string[]
  priority: 'high' | 'normal'
  claimType?: ClaimType
  reason?: string
}

export interface GroundingResult {
  claims: GroundingClaim[]
  evidence: GroundingEvidence[]
  confidence: number
  overallRisk: GroundingRisk
  correctedAnswer: string
  originalAnswer?: string
  hasDiscrepancies?: boolean
  warning?: string
  degraded?: boolean
}
export type DocumentSourceType =
  | 'cv'
  | 'job_description'
  | 'project'
  | 'portfolio_note'
  | 'company_research'
  | 'interview_note'

export interface RetrievalCitation {
  citationId: string
  chunkId: string
  documentId: string
  sourceType: DocumentSourceType
  section?: string
  source?: string
  text: string
  score: number
}

export interface RetrievalDiagnostics {
  query: string
  topResults: Array<{ chunkId: string; score: number; sourceType: DocumentSourceType }>
  selectedTokenCount: number
}
import type { RoutingDecision } from '../model-router'
export type { ResponseLanguage } from '../language'

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

export interface UniversalLLMResult {
  text: string
  provider: LLMProvider
  modelId: string
  modelName: string
  usage?: {
    inputTokens: number
    outputTokens: number
    cachedTokens?: number
    uncachedTokens?: number
    cacheHitRate?: number
    estimatedCostUsd?: number | null
  }
  benchmark?: {
    ttftMs: number
    generationMs: number
    outputTokens?: number
    mainTtftMs?: number
    ipcLagMs?: number
    deltasPerSec?: number
  }
  routing?: RoutingDecision
  failover?: {
    switched: boolean
    fromProvider?: string
    toProvider?: string
    reason?: string
  }
  truncated?: boolean
}
