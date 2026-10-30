export type AIUsageFeature =
  | 'copilot_interview'
  | 'copilot_discussion'
  | 'copilot'
  | 'visual_question'
  | 'stt'
  | 'exchange_scanner'
  | 'translate'
  | 'summary'
  | 'grounding'
  | 'general'
  | 'cv_jd_match'
  | 'llm_latency_test'
  | 'vision_test'
  | 'audio_signal_test'

export type CostCalculationStatus = 'calculated' | 'unknown' | 'free'

export interface UsageRecord {
  id: string
  timestamp: number
  sessionId?: string
  provider: string
  model: string
  feature: AIUsageFeature
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  audioDurationSeconds?: number
  estimatedCostUsd: number | null
  costStatus: CostCalculationStatus
  metadata?: Record<string, any>
}

export interface TrackUsageInput {
  sessionId?: string
  provider: string
  model: string
  feature: AIUsageFeature
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  audioDurationSeconds?: number
  metadata?: Record<string, any>
}

export interface ModelPricingRule {
  provider: string
  modelMatch: string
  inputPerMillionTokens: number
  outputPerMillionTokens: number
  cachedInputPerMillionTokens?: number
  perMinuteAudioUsd?: number
  currency: 'USD'
  source?: 'model' | 'user'
}

export interface UsageBreakdownItem {
  name: string
  cost: number
  estimatedCostUsd: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  audioDurationSeconds: number
  requests: number
  costStatus: CostCalculationStatus
  hasUnknownCost?: boolean
}

export interface DailyUsageItem {
  date: string // YYYY-MM-DD
  estimatedCostUsd: number
  tokens: number
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
  requests: number
  hasUnknownCosts?: boolean
}

export interface MonthlyUsageSummary {
  yearMonth: string // e.g. "2026-10"
  month: string // e.g. "10/2026"
  totalEstimatedCostUsd: number
  costStatus: CostCalculationStatus
  hasUnknownCosts: boolean
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalAudioDurationSeconds: number
  totalRequests: number
  byProvider: UsageBreakdownItem[]
  byModel: UsageBreakdownItem[]
  byFeature: UsageBreakdownItem[]
  breakdownByProvider: Record<string, UsageBreakdownItem>
  breakdownByModel: Record<string, UsageBreakdownItem>
  breakdownByFeature: Record<string, UsageBreakdownItem>
  dailyCosts: Record<string, number> // e.g. { "2026-10-15": 0.045 }
}

export interface BudgetSettings {
  monthlyBudgetLimitUsd?: number | null
  monthlyLimitUsd?: number
  warningThresholdPercent?: number // e.g. 80 for 80%
  alertTriggeredThisMonth?: boolean
}

export interface CostCalculationResult {
  costUsd: number | null
  estimatedCostUsd: number | null
  costStatus: CostCalculationStatus
  status: CostCalculationStatus
  matchedRule?: ModelPricingRule
}

export interface SessionUsageSummary {
  sessionId: string
  totalRecords: number
  totalCostUsd: number | null
  totalEstimatedCostUsd: number
  costStatus: CostCalculationStatus
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalAudioDurationSeconds: number
  requests: number
  records: UsageRecord[]
}
