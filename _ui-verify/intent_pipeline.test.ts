import {
  detectIntent,
  detectIntentFromRecentLines,
  getAdaptiveDebounceMs,
  getIntentMetrics,
  resetIntentMetrics,
} from '../src/app/services/ai-model/copilot/questionDetector'

resetIntentMetrics()

const coding = detectIntent('Could we optimize this binary search implementation?', {
  mode: 'interview',
})
if (coding.normalizedIntent !== 'coding_problem') {
  throw new Error(`Expected coding_problem, received ${coding.normalizedIntent}`)
}

const implicit = detectIntent('It would be useful to understand how this scales under load', {
  mode: 'discussion',
})
if (implicit.normalizedIntent !== 'system_design_problem' && implicit.normalizedIntent !== 'implicit_question') {
  throw new Error(`Expected an implicit technical intent, received ${implicit.normalizedIntent}`)
}

const clarification = detectIntent('Ý bạn là dùng cache ở tầng nào?', { mode: 'discussion' })
if (clarification.normalizedIntent !== 'clarification_request') {
  throw new Error(`Expected clarification_request, received ${clarification.normalizedIntent}`)
}

const lines = [
  { id: 10, speaker: 'Interviewer', original: 'Can you explain', timestamp: '00:01' },
  { id: 11, speaker: 'Interviewer', original: 'how Redis expires keys?', timestamp: '00:02' },
]
const first = detectIntentFromRecentLines(lines, {
  mode: 'interview',
  dedupeKey: 'intent-test',
})
const duplicate = detectIntentFromRecentLines(lines, {
  mode: 'interview',
  dedupeKey: 'intent-test',
})
if (!first?.shouldTriggerCopilot || duplicate?.shouldTriggerCopilot) {
  throw new Error('Duplicate STT chunks must not trigger Copilot twice')
}

if (getAdaptiveDebounceMs('Can you explain') <= 500) {
  throw new Error('Incomplete speech should extend the debounce window')
}

const metrics = getIntentMetrics()
if (metrics.detectedQuestions < 1 || metrics.averageDetectionLatency < 0) {
  throw new Error('Intent metrics were not updated')
}

console.log('intent pipeline tests passed')
