import type { IntentDetectionResult } from '../intent/types'

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

export interface AnswerStrategyContext {
  question: string
  intent?: IntentDetectionResult | null
  technicalDomain?: string
  shortAnswer?: boolean
}

export interface AnswerStrategy {
  id: AnswerStrategyId
  label: string
  matches: (context: AnswerStrategyContext) => boolean
  buildPrompt: (context: AnswerStrategyContext) => string
}

export interface AnswerStrategySelection {
  strategyId: AnswerStrategyId
  confidence: number
  reasoningTags: string[]
}

export interface AnswerStrategyRouter {
  register(strategy: AnswerStrategy): void
  select(context: AnswerStrategyContext, override?: AnswerStrategyId): AnswerStrategySelection
  get(strategyId: AnswerStrategyId): AnswerStrategy
  list(): AnswerStrategy[]
}
