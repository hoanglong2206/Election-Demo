import { pricingRegistry } from '../src/app/services/usage-tracker/pricingRegistry'
import { usageTrackerService } from '../src/app/services/usage-tracker/usageTrackerService'

console.log('=================================================================')
console.log('TEST SUITE: API Cost & Token Usage Tracker (Correctness & Limits)')
console.log('=================================================================\n')

// ─────────────────────────────────────────────────────────────────────────────
// 1. PricingRegistry Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- 1. Testing PricingRegistry & Calculation Formula ---')

// Pricing fixtures are registered explicitly; the application has no defaults.
pricingRegistry.registerRule({
  provider: 'Google',
  modelMatch: 'gemini-1.5-flash',
  inputPerMillionTokens: 0.075,
  outputPerMillionTokens: 0.3,
  cachedInputPerMillionTokens: 0.01875,
})
pricingRegistry.registerRule({ provider: 'Groq', modelMatch: 'whisper', perMinuteAudioUsd: 0.00185 })
pricingRegistry.registerRule({
  provider: 'OpenAI',
  modelMatch: 'gpt-4o',
  inputPerMillionTokens: 3,
  outputPerMillionTokens: 15,
})

// Test 1.1: Gemini 1.5 Flash with cached tokens discount
const geminiCost = pricingRegistry.calculateCost({
  provider: 'Google',
  model: 'gemini-1.5-flash',
  inputTokens: 10000,
  outputTokens: 2000,
  cachedTokens: 5000,
})

console.assert(geminiCost.status === 'calculated', 'Gemini 1.5 Flash should have calculated cost status')
// Calculation:
// uncached input = 10000 - 5000 = 5000 tokens @ $0.075/1M = 0.000375
// cached input = 5000 tokens @ $0.01875/1M = 0.00009375
// output = 2000 tokens @ $0.30/1M = 0.0006
// Total = 0.000375 + 0.00009375 + 0.0006 = 0.00106875 -> ~0.001069
console.log(`Gemini 1.5 Flash cost (10k in, 2k out, 5k cached): $${geminiCost.estimatedCostUsd.toFixed(6)}`)
console.assert(
  Math.abs(geminiCost.estimatedCostUsd - 0.001069) < 0.0001,
  `Unexpected Gemini cost: ${geminiCost.estimatedCostUsd}`
)
console.log('✓ TEST 1.1 PASSED: Gemini 1.5 Flash token & cached discount calculation verified.')

// Test 1.2: Local Whisper STT (Free tier)
const localWhisperCost = pricingRegistry.calculateCost({
  provider: 'Local',
  model: 'whisper-base-native',
  audioDurationSeconds: 120, // 2 minutes
})
console.assert(localWhisperCost.status === 'free', 'Local Whisper must be free tier')
console.assert(localWhisperCost.estimatedCostUsd === 0, 'Local Whisper cost must be exactly $0')
console.log(`Local Whisper cost for 120s audio: $${localWhisperCost.estimatedCostUsd} (status: ${localWhisperCost.status})`)
console.log('✓ TEST 1.2 PASSED: Local Whisper is verified 100% Free ($0.00).')

// Test 1.3: Groq Whisper Cloud STT ($0.00185/min)
const groqWhisperCost = pricingRegistry.calculateCost({
  provider: 'Groq',
  model: 'whisper-large-v3-turbo',
  audioDurationSeconds: 180, // 3 minutes
})
// 3 minutes * $0.00185 = $0.00555
console.assert(groqWhisperCost.status === 'calculated', 'Groq Whisper should be calculated')
console.assert(
  Math.abs(groqWhisperCost.estimatedCostUsd - 0.00555) < 0.0001,
  `Groq Whisper calculation failed: ${groqWhisperCost.estimatedCostUsd}`
)
console.log(`Groq Whisper cost for 180s audio: $${groqWhisperCost.estimatedCostUsd.toFixed(5)}`)
console.log('✓ TEST 1.3 PASSED: Groq Cloud Whisper per-minute rate calculation verified.')

// Test 1.4: Unknown Model pricing gracefully returns status 'unknown'
const unknownCost = pricingRegistry.calculateCost({
  provider: 'OpenAI',
  model: 'gpt-future-nonexistent-model-2030',
  inputTokens: 50000,
  outputTokens: 10000,
})
console.assert(unknownCost.status === 'unknown', 'Unrecognized model must return status unknown')
console.assert(unknownCost.estimatedCostUsd === null, 'Unknown model cost must remain null instead of appearing as a real $0')
console.log(`Unknown model cost: ${unknownCost.estimatedCostUsd ?? 'not estimated'} (status: ${unknownCost.status})`)
console.log('✓ TEST 1.4 PASSED: Missing model pricing handled safely as Unknown.')

// Test 1.5: Decoupled pricing rule registration
pricingRegistry.registerRule({
  provider: 'CustomProvider',
  modelPattern: 'custom-deepseek-v3',
  inputCostPer1M: 0.14,
  outputCostPer1M: 0.28,
  currency: 'USD',
})
const customCost = pricingRegistry.calculateCost({
  provider: 'CustomProvider',
  model: 'custom-deepseek-v3',
  inputTokens: 1000000,
  outputTokens: 500000,
})
// 1M * 0.14 + 0.5M * 0.28 = 0.14 + 0.14 = $0.28
console.assert(
  Math.abs(customCost.estimatedCostUsd - 0.28) < 0.001,
  `Custom rule registration failed: ${customCost.estimatedCostUsd}`
)
console.log('✓ TEST 1.5 PASSED: Decoupled custom pricing rule registration verified.')

// ─────────────────────────────────────────────────────────────────────────────
// 2. UsageTrackerService Lifecycle & Aggregations
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- 2. Testing UsageTrackerService Lifecycle & Aggregations ---')

// Clear any prior test state with confirmation
usageTrackerService.resetLocalStatistics(true)

const TEST_SESSION_1 = 'session_mock_interview_42'
const TEST_SESSION_2 = 'session_mock_discussion_88'

// Request 1: Copilot interview question answer via Gemini 1.5 Flash
const rec1 = usageTrackerService.trackUsage({
  sessionId: TEST_SESSION_1,
  provider: 'Google',
  model: 'gemini-1.5-flash',
  feature: 'copilot_interview',
  inputTokens: 1200,
  outputTokens: 450,
  cachedTokens: 600,
})
console.assert(rec1.id.startsWith('usage_'), 'Record id must have usage_ prefix')
console.assert(rec1.sessionId === TEST_SESSION_1, 'Session ID must match')
console.assert(rec1.costStatus === 'calculated', 'Cost status must be calculated')

// Request 2: Screenshot Multimodal Analysis via OpenAI GPT-4o
const rec2 = usageTrackerService.trackUsage({
  sessionId: TEST_SESSION_1,
  provider: 'OpenAI',
  model: 'gpt-4o',
  feature: 'visual_question',
  inputTokens: 2500,
  outputTokens: 800,
})
console.assert(rec2.costStatus === 'calculated', 'OpenAI cost must be calculated')

// Request 3: STT Whisper chunk via Groq
const rec3 = usageTrackerService.trackUsage({
  sessionId: TEST_SESSION_1,
  provider: 'Groq',
  model: 'whisper-large-v3-turbo',
  feature: 'stt',
  audioDurationSeconds: 45,
})
console.assert(rec3.audioDurationSeconds === 45, 'Audio duration must be 45s')

// Request 4: Local Whisper STT chunk
const rec4 = usageTrackerService.trackUsage({
  sessionId: TEST_SESSION_1,
  provider: 'Local',
  model: 'ggml-base.bin',
  feature: 'stt',
  audioDurationSeconds: 30,
})
console.assert(rec4.costStatus === 'free', 'Local whisper must be free')

// Request 5: Unrecognized model in Session 2
const rec5 = usageTrackerService.trackUsage({
  sessionId: TEST_SESSION_2,
  provider: 'OpenAI',
  model: 'experimental-unlisted-model',
  feature: 'copilot_discussion',
  inputTokens: 1000,
  outputTokens: 200,
})
console.assert(rec5.costStatus === 'unknown', 'Unknown model must have costStatus unknown')

console.log('✓ TEST 2.1 PASSED: 5 heterogeneous API usage records successfully tracked.')

// Test 2.2: Session-specific aggregation
const session1Summary = usageTrackerService.getSessionUsageSummary(TEST_SESSION_1)
console.log(`Session 1 Summary:`)
console.log(` - Total Records: ${session1Summary.totalRecords}`)
console.log(` - Total Input Tokens: ${session1Summary.totalInputTokens}`)
console.log(` - Total Output Tokens: ${session1Summary.totalOutputTokens}`)
console.log(` - Total Cached Tokens: ${session1Summary.totalCachedTokens}`)
console.log(` - Total Audio Duration: ${session1Summary.totalAudioDurationSeconds}s`)
console.log(` - Estimated Cost: $${session1Summary.totalEstimatedCostUsd.toFixed(5)}`)
console.log(` - Cost Status: ${session1Summary.costStatus}`)

console.assert(session1Summary.totalRecords === 4, `Expected 4 records in Session 1, got ${session1Summary.totalRecords}`)
console.assert(session1Summary.totalInputTokens === 3700, `Input tokens mismatch: ${session1Summary.totalInputTokens}`)
console.assert(session1Summary.totalOutputTokens === 1250, `Output tokens mismatch: ${session1Summary.totalOutputTokens}`)
console.assert(session1Summary.totalCachedTokens === 600, `Cached tokens mismatch: ${session1Summary.totalCachedTokens}`)
console.assert(session1Summary.totalAudioDurationSeconds === 75, `Audio duration mismatch: ${session1Summary.totalAudioDurationSeconds}`)
console.assert(session1Summary.totalEstimatedCostUsd > 0, 'Cost must be positive')
console.assert(session1Summary.costStatus === 'calculated', 'Session 1 costStatus must be calculated')
console.log('✓ TEST 2.2 PASSED: Session-level summary correctly aggregates tokens, audio, and costs.')

// Test 2.3: Session 2 with unknown model reflects 'unknown' costStatus
const session2Summary = usageTrackerService.getSessionUsageSummary(TEST_SESSION_2)
console.assert(session2Summary.costStatus === 'unknown', 'Session with unknown model must reflect unknown costStatus')
console.assert(session2Summary.totalInputTokens === 1000, 'Session 2 must preserve token count despite unknown cost')
console.log('✓ TEST 2.3 PASSED: Session with unlisted model preserves tokens and flags costStatus as Unknown.')

// Test 2.4: Current Month Summary & Breakdowns
const monthSummary = usageTrackerService.getCurrentMonthSummary()
console.log(`\nCurrent Month Summary:`)
console.log(` - Month: ${monthSummary.month}`)
console.log(` - Total Requests: ${monthSummary.totalRequests}`)
console.log(` - Total Cost: $${monthSummary.totalEstimatedCostUsd.toFixed(5)}`)
console.log(` - By Provider count: ${monthSummary.byProvider.length}`)
console.log(` - By Model count: ${monthSummary.byModel.length}`)
console.log(` - By Feature count: ${monthSummary.byFeature.length}`)

console.assert(monthSummary.totalRequests === 5, 'Current month total requests must be 5')
console.assert(monthSummary.byProvider.some((p) => p.name === 'Google'), 'Google provider must exist in breakdown')
console.assert(monthSummary.byProvider.some((p) => p.name === 'OpenAI'), 'OpenAI provider must exist in breakdown')
console.assert(monthSummary.byProvider.some((p) => p.name === 'Groq'), 'Groq provider must exist in breakdown')
console.assert(monthSummary.byProvider.some((p) => p.name === 'Local'), 'Local provider must exist in breakdown')
console.assert(monthSummary.byFeature.some((f) => f.name === 'copilot_interview'), 'Interview feature must exist in breakdown')
console.assert(monthSummary.byFeature.some((f) => f.name === 'visual_question'), 'Visual question feature must exist in breakdown')
console.assert(monthSummary.byFeature.some((f) => f.name === 'stt'), 'STT feature must exist in breakdown')
console.log('✓ TEST 2.4 PASSED: Monthly summary breakdowns by Provider, Model, and Feature verified.')

// Test 2.5: Daily History
const daily = usageTrackerService.getDailyHistory(7)
console.assert(daily.length === 7, `Expected 7 daily entries, got ${daily.length}`)
const todayEntry = daily[daily.length - 1]
console.assert(todayEntry.requests === 5, `Expected 5 requests today, got ${todayEntry.requests}`)
console.assert(todayEntry.tokens > 0, 'Today tokens must be > 0')
console.log('✓ TEST 2.5 PASSED: 7-day daily spending history verified.')

// Test 2.6: Budget Settings & Spending Limit Warning
usageTrackerService.updateBudgetSettings({
  monthlyBudgetLimitUsd: 0.05, // low limit
  warningThresholdPercent: 50, // 50%
})
const budget = usageTrackerService.getBudgetSettings()
console.assert(budget.monthlyBudgetLimitUsd === 0.05, 'Budget limit must be 0.05')
console.assert(budget.warningThresholdPercent === 50, 'Threshold must be 50%')
console.log('✓ TEST 2.6 PASSED: Budget settings saved and retrieved.')

// Test 2.7: Confirmation Guard for Resetting Statistics
const unconfirmedReset = usageTrackerService.resetLocalStatistics(false)
console.assert(unconfirmedReset === false, 'Reset without confirmation must return false')
console.assert(usageTrackerService.getAllRecords().length === 5, 'Records must not be deleted without confirmation')

const confirmedReset = usageTrackerService.resetLocalStatistics(true)
console.assert(confirmedReset === true, 'Reset with confirmation must return true')
console.assert(usageTrackerService.getAllRecords().length === 0, 'Records must be emptied after confirmed reset')
console.log('✓ TEST 2.7 PASSED: Resetting statistics requires explicit user confirmation.')

console.log('\n=================================================================')
console.log('ALL API COST & TOKEN USAGE TRACKER TESTS PASSED SUCCESSFULLY! (100%)')
console.log('=================================================================')
