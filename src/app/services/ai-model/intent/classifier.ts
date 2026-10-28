import type { IntentClassifier, IntentDetectionResult, TriggerMode } from './types'
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  BUDGET_USAGE_LIMIT_PERCENT,
  recordGateCall,
} from './intentGate'
import { isCandidateSpeaker } from './triggerLog'
import { detectLanguage } from './heuristic'

export let configuredIntentClassifier: IntentClassifier | undefined

export function configureIntentClassifier(classifier?: IntentClassifier): void {
  configuredIntentClassifier = classifier
}

export async function classifyIntent(
  result: IntentDetectionResult,
  classifierOrOptions?:
    | IntentClassifier
    | {
        budgetPercent?: number
        speaker?: string
        triggerMode?: TriggerMode
        minWords?: number
        wordCount?: number
      },
  maybeOptions?: {
    budgetPercent?: number
    speaker?: string
    triggerMode?: TriggerMode
    minWords?: number
    wordCount?: number
  }
): Promise<IntentDetectionResult> {
  const isCustomClassifier =
    classifierOrOptions && typeof (classifierOrOptions as any).classify === 'function'
  const activeClassifier = isCustomClassifier
    ? (classifierOrOptions as IntentClassifier)
    : configuredIntentClassifier
  const options = isCustomClassifier ? maybeOptions : (classifierOrOptions as any)

  if (activeClassifier) {
    recordGateCall()
    const classified = await activeClassifier.classify({
      text: result.normalizedText,
      language: detectLanguage(result.normalizedText),
      heuristicIntent: result.normalizedIntent || 'normal_conversation',
    })
    return {
      ...result,
      normalizedIntent: classified.intent,
      questionText: classified.questionText ?? result.questionText,
      triggerReason: classified.triggerReason ?? result.triggerReason,
      topic: classified.topic ?? result.topic,
      confidence: Math.max(0, Math.min(1, classified.confidence)),
      isQuestion: classified.intent !== 'normal_conversation',
      shouldTriggerCopilot: result.shouldTriggerCopilot || classified.confidence >= CONFIDENCE_HIGH,
      gateRequired: false,
      isAmbiguous: false,
    }
  }

  // ── 3-Tier Confidence Strategy (Deterministic Zero-Network Classification) ──
  // Tier 1: High Confidence >= 0.65 -> runs as current (no speculative gating required)
  if (result.confidence >= CONFIDENCE_HIGH) {
    return {
      ...result,
      gateRequired: false,
      isAmbiguous: false,
    }
  }

  // Tier 3: Low Confidence < 0.35 -> ignored / skipped
  if (result.confidence < CONFIDENCE_LOW) {
    return {
      ...result,
      gateRequired: false,
      isAmbiguous: false,
      shouldTriggerCopilot: false,
      triggerDecisionReason: `Skipped: Low confidence (${(result.confidence * 100).toFixed(0)}% < ${(CONFIDENCE_LOW * 100).toFixed(0)}%)`,
    }
  }

  // Tier 2: Ambiguous Range [0.35, 0.65)
  // Check qualifying conditions:
  // - triggerMode === 'auto'
  // - speaker is not the candidate
  // - minimum word count met
  // - budget remaining (< 80% usage)
  const triggerMode = options?.triggerMode || 'auto'
  const isCandidate = isCandidateSpeaker(options?.speaker || result.speaker)
  const wordCount = options?.wordCount ?? result.normalizedText.trim().split(/\s+/).filter(Boolean).length
  const minWords = options?.minWords ?? 3
  const budgetPercent = options?.budgetPercent ?? 0

  const meetsAmbiguousConditions =
    triggerMode === 'auto' &&
    !isCandidate &&
    wordCount >= minWords &&
    budgetPercent < BUDGET_USAGE_LIMIT_PERCENT

  return {
    ...result,
    gateRequired: true,
    isAmbiguous: true,
    shouldTriggerCopilot: meetsAmbiguousConditions,
    triggerDecisionReason: meetsAmbiguousConditions
      ? `Speculative Trigger: Ambiguous confidence (${(result.confidence * 100).toFixed(0)}%) with Intent Gate`
      : `Skipped: Ambiguous confidence (${(result.confidence * 100).toFixed(0)}%) condition not met (triggerMode=${triggerMode}, candidate=${isCandidate}, words=${wordCount}, budget=${budgetPercent}%)`,
  }
}
