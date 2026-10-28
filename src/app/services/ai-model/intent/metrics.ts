import type { IntentMetrics } from './types'
import { getGateMetrics, resetGateMetrics } from './intentGate'

export const intentMetrics: IntentMetrics = {
  detectedQuestions: 0,
  falseTriggers: 0,
  get gateCalls() {
    return getGateMetrics().gateCalls
  },
  get gateCancelled() {
    return getGateMetrics().gateCancelled
  },
  get wastedTokens() {
    return getGateMetrics().wastedTokens
  },
  averageDetectionLatency: 0,
  get classifierCalls() {
    return getGateMetrics().gateCalls
  },
  set classifierCalls(_val: number | undefined) {
    // backward compat
  },
}

export function getIntentMetrics(): IntentMetrics {
  return {
    detectedQuestions: intentMetrics.detectedQuestions,
    falseTriggers: intentMetrics.falseTriggers,
    gateCalls: getGateMetrics().gateCalls,
    gateCancelled: getGateMetrics().gateCancelled,
    wastedTokens: getGateMetrics().wastedTokens,
    averageDetectionLatency: intentMetrics.averageDetectionLatency,
    classifierCalls: getGateMetrics().gateCalls,
  }
}

export function resetIntentMetrics(): void {
  intentMetrics.detectedQuestions = 0
  intentMetrics.falseTriggers = 0
  intentMetrics.averageDetectionLatency = 0
  resetGateMetrics()
}

export function recordFalseTrigger(): void {
  intentMetrics.falseTriggers += 1
}
