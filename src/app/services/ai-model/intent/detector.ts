import type { IntentDetectionResult } from './types'
import { detectHeuristicIntent, detectNormalizedIntent, inferTopic } from './heuristic'
import { intentMetrics } from './metrics'

export function detectIntent(
  rawText: string,
  options?: Parameters<typeof detectHeuristicIntent>[1] & { dedupeKey?: string },
): IntentDetectionResult {
  const startedAt = performance.now()
  const result = detectHeuristicIntent(rawText, options)
  const enriched: IntentDetectionResult = {
    ...result,
    normalizedIntent: detectNormalizedIntent(`${result.rawText} ${result.normalizedText}`, result.intent),
    questionText: result.isQuestion ? result.normalizedText : '',
    triggerReason: result.triggerDecisionReason,
    topic: inferTopic(result.normalizedText),
    detectionTimestamp: Date.now(),
  }
  if (enriched.isQuestion || enriched.shouldTriggerCopilot) intentMetrics.detectedQuestions += 1
  const count = Math.max(1, intentMetrics.detectedQuestions)
  intentMetrics.averageDetectionLatency =
    ((intentMetrics.averageDetectionLatency * (count - 1)) + (performance.now() - startedAt)) / count
  return enriched
}
