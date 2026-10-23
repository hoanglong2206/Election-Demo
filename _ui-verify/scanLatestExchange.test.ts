// Tests for scanLatestExchange: stitching fragmented transcripts and preserving original language
// Run: bun run _ui-verify/scanLatestExchange.test.ts

import {
  stitchFragments,
  extractHeuristicLatestExchange,
  scanLatestExchangeWithAI,
} from '../src/app/services/ai-model/copilot/scanLatestExchange'

const checks: Record<string, boolean> = {}

// ── 1. stitchFragments test ───────────────────────────────────────────────────
const fragments1 = [
  'Could you explain',
  'how you optimize',
  'database queries in PostgreSQL?',
]
const stitched1 = stitchFragments(fragments1)
checks['stitchFragments joins clean parts with spaces'] =
  stitched1 === 'Could you explain how you optimize database queries in PostgreSQL?'

const fragments2 = ['about your', 'your experience with Docker']
const stitched2 = stitchFragments(fragments2)
checks['stitchFragments removes repeated word overlap'] =
  stitched2 === 'about your experience with Docker'

const fragments3 = ['Hello', ', how are you', '?']
const stitched3 = stitchFragments(fragments3)
checks['stitchFragments handles punctuation without extra spaces'] =
  stitched3 === 'Hello, how are you?'

// ── 2. extractHeuristicLatestExchange in Interview Mode ────────────────────────
const interviewLines = [
  { speaker: 'You', original: 'Nice to meet you.', timestamp: '10:01' },
  { speaker: 'Interviewer', original: 'Can you describe', translated: 'Bạn có thể mô tả', timestamp: '10:02' },
  { speaker: 'Interviewer', original: 'your architecture decisions', translated: 'các quyết định kiến trúc của bạn', timestamp: '10:03' },
  { speaker: 'Interviewer', original: 'in the payment service?', translated: 'trong dịch vụ thanh toán?', timestamp: '10:04' },
]

const heuristicInterview = extractHeuristicLatestExchange(interviewLines, 'interview')
checks['heuristic interview: takes original language (English), not translated'] =
  heuristicInterview?.original === 'Can you describe your architecture decisions in the payment service?'
checks['heuristic interview: identifies speaker'] =
  heuristicInterview?.speaker === 'Interviewer'
checks['heuristic interview: detects question'] =
  heuristicInterview?.isQuestion === true

// ── 3. extractHeuristicLatestExchange in Discussion Mode ───────────────────────
const discussionLines = [
  { speaker: 'Cuộc họp', original: 'Tôi nghĩ chúng ta nên', translated: 'Tôi nghĩ chúng ta nên', timestamp: '14:20' },
  { speaker: 'Cuộc họp', original: 'triển khai Redis cluster', translated: 'triển khai Redis cluster', timestamp: '14:21' },
  { speaker: 'Cuộc họp', original: 'để giảm tải database.', translated: 'để giảm tải database.', timestamp: '14:22' },
]

const heuristicDiscussion = extractHeuristicLatestExchange(discussionLines, 'discussion')
checks['heuristic discussion: takes original speech'] =
  heuristicDiscussion?.original === 'Tôi nghĩ chúng ta nên triển khai Redis cluster để giảm tải database.'
checks['heuristic discussion: identifies statement'] =
  heuristicDiscussion?.isQuestion === false

// ── 4. scanLatestExchangeWithAI with mock LLM ──────────────────────────────────
const store = new Map<string, string>()
const fakeStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
}
;(globalThis as any).localStorage = fakeStorage
;(globalThis as any).sessionStorage = fakeStorage

store.set(
  'cached_dynamic_ai_models',
  JSON.stringify([
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Groq LPU (Llama 3.3 70B)',
      provider: 'Groq',
      tier: 'Free',
    },
  ])
)
store.set('meeting_copilot_ai_model', 'llama-3.3-70b-versatile')
store.set('cfg_groq_key', 'gsk_mock_test_key')

let lastPrompt = ''
;(globalThis as any).fetch = async (_url: string, init: any) => {
  const body = JSON.parse(init.body)
  lastPrompt = body.messages.map((m: any) => m.content).join('\n')
  const aiMockResponse = `SPEAKER: Interviewer
IS_QUESTION: true
TEXT: Can you describe your architecture decisions in the payment service?`

  return new Response(JSON.stringify({ choices: [{ message: { content: aiMockResponse } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const aiScanned = await scanLatestExchangeWithAI(interviewLines, 'interview')
checks['ai scan: prompt requires original language and forbids translating'] =
  lastPrompt.includes('LẤY NGUYÊN VĂN BẰNG NGÔN NGỮ GỐC') &&
  lastPrompt.includes('TUYỆT ĐỐI KHÔNG DỊCH')
checks['ai scan: prompt instructs stitching fragmented lines'] =
  lastPrompt.includes('GHÉP NỐI ĐOẠN NGẮT QUÃNG')
checks['ai scan: extracts original text'] =
  aiScanned?.original === 'Can you describe your architecture decisions in the payment service?'
checks['ai scan: marked as isAiScanned'] =
  aiScanned?.isAiScanned === true

// ── 5. Question detection conflict resolution test (LLM says false, but text is a question) ──
;(globalThis as any).fetch = async (_url: string, _init: any) => {
  const aiMockResponse = `SPEAKER: Cuộc họp
IS_QUESTION: false
TEXT: How are you?`

  return new Response(JSON.stringify({ choices: [{ message: { content: aiMockResponse } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const noiseWithQuestionLines = [
  { speaker: 'Cuộc họp', original: '哇', timestamp: '48:02' },
  { speaker: 'Cuộc họp', original: '(laughing)', timestamp: '48:04' },
  { speaker: 'Cuộc họp', original: 'How are you?', timestamp: '48:06' },
]

const scannedBugCase = await scanLatestExchangeWithAI(noiseWithQuestionLines, 'discussion')
checks['ai scan: when LLM says IS_QUESTION: false but text is "How are you?", isQuestion is true'] =
  scannedBugCase?.isQuestion === true
checks['heuristic: cleans (laughing) audio tags'] =
  extractHeuristicLatestExchange(noiseWithQuestionLines, 'discussion')?.original === 'How are you?'

// Report results
let allPass = true
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) allPass = false
}

if (!allPass) {
  console.error('\nFAIL: Some checks failed.')
  process.exit(1)
} else {
  console.log('\nALL PASS: scanLatestExchange successfully stitches fragmented transcripts and keeps original language!')
  process.exit(0)
}
