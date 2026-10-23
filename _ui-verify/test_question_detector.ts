import {
  detectIntent,
  detectIntentFromRecentLines,
  isQuestionUtterance,
  triggerLogManager,
} from '../src/app/services/ai-model/copilot/questionDetector'

console.log('=== INTEGRATION TEST: QuestionDetector & Intent Pipeline ===\n')

let passedTests = 0

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Complete Questions Detection (English & Vietnamese)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: Complete Questions Detection ---')

const q1 = detectIntent('Can you explain the difference between optimistic and pessimistic locking?', {
  mode: 'interview',
  triggerMode: 'auto',
})
console.log('Q1 (English Tech Question):', {
  intent: q1.intent,
  confidence: q1.confidence,
  shouldTrigger: q1.shouldTriggerCopilot,
  reason: q1.triggerDecisionReason,
})
assert(q1.intent === 'QUESTION', 'Q1 must have intent QUESTION')
assert(q1.confidence >= 0.9, 'Q1 confidence should be >= 0.90')
assert(q1.shouldTriggerCopilot === true, 'Q1 should trigger Copilot in auto mode')

const q2 = detectIntent('Tại sao chúng ta lại nên sử dụng Redis cluster thay vì standalone trong môi trường production?', {
  mode: 'interview',
  triggerMode: 'auto',
})
console.log('Q2 (Vietnamese Tech Question):', {
  intent: q2.intent,
  confidence: q2.confidence,
  shouldTrigger: q2.shouldTriggerCopilot,
})
assert(q2.intent === 'QUESTION', 'Q2 must have intent QUESTION')
assert(q2.shouldTriggerCopilot === true, 'Q2 should trigger Copilot in auto mode')

const q3 = detectIntent('Walk me through your experience building microservices with Kubernetes.', {
  mode: 'interview',
  triggerMode: 'auto',
})
assert(q3.intent === 'QUESTION' && q3.shouldTriggerCopilot === true, 'Prompting question must be QUESTION')

console.log('✓ TEST 1 PASSED: Complete questions detected accurately with high confidence.\n')
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Split Whisper Chunks Merging
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 2: Split Whisper Chunks Merging ---')

// Example from User Prompt:
// "Can you explain..."
// "...how Redis handles expiration?"
const splitLines = [
  {
    speaker: 'Interviewer',
    original: 'Can you explain...',
    timestamp: '14:02',
  },
  {
    speaker: 'Interviewer',
    original: '...how Redis handles expiration?',
    timestamp: '14:03',
  },
]

const mergedRes = detectIntentFromRecentLines(splitLines, {
  mode: 'interview',
  triggerMode: 'auto',
})

console.log('Split chunks detection result:', {
  normalizedText: mergedRes?.normalizedText,
  isSplitFragment: mergedRes?.isSplitFragment,
  mergedLineCount: mergedRes?.mergedLineCount,
  intent: mergedRes?.intent,
  confidence: mergedRes?.confidence,
  shouldTrigger: mergedRes?.shouldTriggerCopilot,
})

assert(mergedRes !== null, 'mergedRes must not be null')
assert(mergedRes?.isSplitFragment === true, 'isSplitFragment must be true for multi-chunk sentence')
assert(mergedRes?.mergedLineCount === 2, 'mergedLineCount must equal 2')
assert(
  mergedRes?.normalizedText === 'Can you explain how Redis handles expiration?',
  `Normalized text must be cleanly stitched without trailing/leading ellipsis. Got: "${mergedRes?.normalizedText}"`
)
assert(mergedRes?.intent === 'QUESTION', 'Merged intent must be QUESTION')
assert(mergedRes?.shouldTriggerCopilot === true, 'Merged question must trigger Copilot')

console.log('✓ TEST 2 PASSED: Split Whisper chunks merged cleanly into a single cohesive question.\n')
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Small Talk Suppression (Zero API calls, Zero noise)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 3: Small Talk Suppression ---')

const smallTalkSamples = [
  'Okay',
  'I see.',
  'Right',
  'Thank you',
  'Thanks a lot!',
  'Got it.',
  'Vâng, cảm ơn bạn.',
  'Dạ được rồi ạ',
  'Ừm, hiểu rồi.',
  'Okay, thank you.',
  'Right, I see.',
]

for (const sample of smallTalkSamples) {
  const stRes = detectIntent(sample, { mode: 'interview', triggerMode: 'auto' })
  assert(stRes.intent === 'SMALL_TALK', `Sample "${sample}" must be classified as SMALL_TALK, got ${stRes.intent}`)
  assert(stRes.shouldTriggerCopilot === false, `Sample "${sample}" must NOT trigger Copilot`)
  assert(stRes.confidence >= 0.85, `Sample "${sample}" confidence must be >= 0.85`)
}

console.log(`✓ TEST 3 PASSED: All ${smallTalkSamples.length} small talk utterances classified as SMALL_TALK with Copilot trigger suppressed.\n`)
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Interview Mode vs Discussion Mode Intent Differentiation
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 4: Mode Differentiation (Discussion Point) ---')

const discussionUtterance = 'Theo tôi thì vấn đề nghẽn cổ chai nằm ở tầng database replication chứ không phải ở API gateway.'

// In Interview Mode: Discussion points should NOT trigger candidate answer suggestions
const interviewRes = detectIntent(discussionUtterance, {
  mode: 'interview',
  triggerMode: 'auto',
})
console.log('Interview Mode on Discussion Point:', {
  intent: interviewRes.intent,
  shouldTrigger: interviewRes.shouldTriggerCopilot,
  reason: interviewRes.triggerDecisionReason,
})
assert(interviewRes.intent === 'DISCUSSION_POINT', 'Intent must be DISCUSSION_POINT')
assert(interviewRes.shouldTriggerCopilot === false, 'Discussion point in Interview Mode should NOT trigger Copilot')

// In Discussion Mode: Discussion points SHOULD trigger suggestions
const discussionRes = detectIntent(discussionUtterance, {
  mode: 'discussion',
  triggerMode: 'auto',
})
console.log('Discussion Mode on Discussion Point:', {
  intent: discussionRes.intent,
  shouldTrigger: discussionRes.shouldTriggerCopilot,
  reason: discussionRes.triggerDecisionReason,
})
assert(discussionRes.intent === 'DISCUSSION_POINT', 'Intent must be DISCUSSION_POINT')
assert(discussionRes.shouldTriggerCopilot === true, 'Discussion point in Discussion Mode MUST trigger Copilot')

console.log('✓ TEST 4 PASSED: Mode-specific intent triggering verified.\n')
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Trigger Modes (Manual / Semi-Auto / Auto)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 5: Trigger Modes Configuration ---')

const questionText = 'What is your strategy for horizontal scaling?'

// Manual Mode: shouldTriggerCopilot must be false even for high-confidence questions
const manualRes = detectIntent(questionText, {
  mode: 'interview',
  triggerMode: 'manual',
})
assert(manualRes.shouldTriggerCopilot === false, 'Manual mode must never auto-trigger Copilot')
assert(manualRes.intent === 'QUESTION', 'Intent must still be detected as QUESTION')

// Semi-Auto Mode: Question is detected, UI will render action button without calling LLM directly
const semiRes = detectIntent(questionText, {
  mode: 'interview',
  triggerMode: 'semi-auto',
})
assert(semiRes.isQuestion === true, 'Semi-auto mode must mark isQuestion = true')

// Auto Mode: shouldTriggerCopilot is true
const autoRes = detectIntent(questionText, {
  mode: 'interview',
  triggerMode: 'auto',
})
assert(autoRes.shouldTriggerCopilot === true, 'Auto mode must auto-trigger Copilot')

console.log('✓ TEST 5 PASSED: Manual, Semi-Auto, and Auto modes operate according to spec.\n')
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: False Trigger Log Recording
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 6: False Trigger Log Telemetry ---')

const logs = triggerLogManager.getLogs()
console.log(`Total logged trigger decisions in ring buffer: ${logs.length}`)
assert(logs.length > 0, 'TriggerLogManager must retain decision history')

const smallTalkLog = logs.find((l) => l.intent === 'SMALL_TALK')
assert(smallTalkLog !== undefined, 'Log must contain small talk skip decision')
assert(smallTalkLog?.decision === 'skipped', 'Small talk decision must be recorded as skipped')

const questionLog = logs.find((l) => l.intent === 'QUESTION' && l.decision === 'triggered')
assert(questionLog !== undefined, 'Log must contain triggered question entry')

console.log('Sample logged decision:', {
  timeStr: questionLog?.timeStr,
  text: questionLog?.text,
  intent: questionLog?.intent,
  decision: questionLog?.decision,
  reason: questionLog?.reason,
})

console.log('✓ TEST 6 PASSED: Trigger decisions reliably recorded in ring buffer for inspection & rule tuning.\n')
passedTests++

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: Backward Compatibility of isQuestionUtterance
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 7: Backward Compatibility ---')
assert(isQuestionUtterance('How does garbage collection work?') === true, 'GC question must return true')
assert(isQuestionUtterance('Okay, thank you.') === false, 'Small talk must return false')
assert(isQuestionUtterance('Vâng cảm ơn bạn') === false, 'VN small talk must return false')
assert(isQuestionUtterance('Bạn có câu hỏi gì không?') === true, 'VN question must return true')

console.log('✓ TEST 7 PASSED: 100% backward compatibility maintained for isQuestionUtterance.\n')
passedTests++

console.log(`ALL ${passedTests} QUESTION DETECTOR & INTENT PIPELINE INTEGRATION TESTS PASSED!`)
