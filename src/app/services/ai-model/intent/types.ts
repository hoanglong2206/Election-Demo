import type { AppMode } from '@/types/electron.d'
import type { TriggerMode } from '../../settings/schema'

export type { TriggerMode } from '../../settings/schema'

export type CopilotIntent =
  | 'QUESTION'
  | 'DISCUSSION_POINT'
  | 'COMMAND'
  | 'SMALL_TALK'
  | 'UNKNOWN'

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

export interface IntentClassifier {
  classify(input: {
    text: string
    language: 'en' | 'vi' | 'mixed'
    heuristicIntent: NormalizedIntent
  }): Promise<{
    intent: NormalizedIntent
    confidence: number
    topic?: string
    questionText?: string
    triggerReason?: string
  }>
}

export interface IntentDetectionResult {
  intent: CopilotIntent
  normalizedIntent?: NormalizedIntent
  questionText?: string
  triggerReason?: string
  topic?: string
  detectionTimestamp?: number
  confidence: number // 0.0 - 1.0
  normalizedText: string
  rawText: string
  speaker: string
  isQuestion: boolean
  shouldTriggerCopilot: boolean
  triggerDecisionReason: string
  isSplitFragment: boolean
  mergedLineCount: number
  matchedPatterns: string[]
  timestamp?: string
  gateRequired?: boolean
  isAmbiguous?: boolean
}

export interface QuestionDetectorConfig {
  mode?: AppMode
  triggerMode?: TriggerMode
  confidenceThreshold?: number
  debounceMs?: number
  maxLookbackLines?: number
  classifier?: IntentClassifier
  dedupeKey?: string
}

export interface IntentMetrics {
  detectedQuestions: number
  falseTriggers: number
  gateCalls: number
  gateCancelled: number
  wastedTokens: number
  averageDetectionLatency: number
  classifierCalls?: number
}

export interface TriggerLogEntry {
  id: string
  timestamp: number
  timeStr: string
  text: string
  speaker: string
  intent: CopilotIntent
  confidence: number
  decision: 'triggered' | 'skipped'
  reason: string
  mode: AppMode
  triggerMode: TriggerMode
}
