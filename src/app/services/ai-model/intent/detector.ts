import type { IntentDetectionResult } from './types'
import {
  detectHeuristicIntent,
  detectNormalizedIntent,
  detectIntentModality,
  inferTopic,
} from './heuristic'
import { intentMetrics } from './metrics'

export function detectIntent(
  rawText: string,
  options?: Parameters<typeof detectHeuristicIntent>[1] & { dedupeKey?: string },
): IntentDetectionResult {
  const startedAt = performance.now()
  const result = detectHeuristicIntent(rawText, options)
  const combinedText = `${result.rawText} ${result.normalizedText}`
  const modality = detectIntentModality(combinedText)
  const enriched: IntentDetectionResult = {
    ...result,
    normalizedIntent: detectNormalizedIntent(combinedText, result.intent),
    questionText: result.isQuestion ? result.normalizedText : '',
    triggerReason: result.triggerDecisionReason,
    topic: inferTopic(result.normalizedText),
    detectionTimestamp: Date.now(),
    isChallenge: modality.isChallenge,
    isFollowUp: modality.isFollowUp,
    isClarification: modality.isClarification,
  }
  if (enriched.isQuestion || enriched.shouldTriggerCopilot) intentMetrics.detectedQuestions += 1
  const count = Math.max(1, intentMetrics.detectedQuestions)
  intentMetrics.averageDetectionLatency =
    ((intentMetrics.averageDetectionLatency * (count - 1)) + (performance.now() - startedAt)) / count
  return enriched
}
