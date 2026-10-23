// Verifies the AI response-language setting is actually wired into every prompt,
// and that bilingual mode asks for ENGLISH only (Vietnamese comes from the
// per-response "Dịch" button).
//
// Run:  bun run _ui-verify/language.test.ts

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
      badgeColor: 'amber',
      contextWindow: '128k',
      pingMs: 120,
      description: 't',
      recommendedFor: 't',
    },
  ])
)
store.set('meeting_copilot_ai_model', 'llama-3.3-70b-versatile')
store.set('cfg_groq_key', 'gsk_test_key')

let lastPrompt = ''
const delimited = `@@@
LABEL: Option one
CONFIDENCE: 95
CONTENT: First suggestion content.
@@@
LABEL: Option two
CONFIDENCE: 91
CONTENT: Second suggestion content.
@@@
LABEL: Option three
CONFIDENCE: 88
CONTENT: Third suggestion content.`

;(globalThis as any).fetch = async (_url: string, init: any) => {
  const body = JSON.parse(init.body)
  lastPrompt = body.messages.map((m: any) => m.content).join('\n')
  return new Response(JSON.stringify({ choices: [{ message: { content: delimited } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const { generateDiscussionOptions } = await import(
  '../src/app/services/ai-model/copilot/discussion'
)
const { summarizeMeetingTranscripts } = await import(
  '../src/app/services/ai-model/summary/summarizer'
)
const { translateToVietnamese } = await import(
  '../src/app/services/ai-model/copilot/translate'
)

const checks: Record<string, boolean> = {}

async function promptFor(language: 'en' | 'vi' | 'bilingual') {
  lastPrompt = ''
  await generateDiscussionOptions({
    latestLine: 'So that means like the message has been',
    isQuestion: false,
    meetingSummary: 'Summary about a realtime chat platform.',
    transcriptLines: [{ speaker: 'Cuoc hop', original: 'we build a chat app' }],
    language,
  })
  return lastPrompt
}

// ── 1. English mode ──────────────────────────────────────────────────────────
const pEn = await promptFor('en')
checks['en: asks for English only'] = pEn.includes('viết TOÀN BỘ nội dung bằng TIẾNG ANH')
checks['en: forbids Vietnamese'] = pEn.includes('Không dùng tiếng Việt')
checks['en: no bilingual translate instruction'] = !pEn.includes('bấm nút "Dịch"')

// ── 2. Vietnamese mode ───────────────────────────────────────────────────────
const pVi = await promptFor('vi')
checks['vi: asks for Vietnamese'] = pVi.includes('viết TOÀN BỘ nội dung bằng TIẾNG VIỆT')
checks['vi: no English-only rule'] = !pVi.includes('Không dùng tiếng Việt')
checks['vi: no bilingual translate instruction'] = !pVi.includes('bấm nút "Dịch"')

// ── 3. Bilingual mode ────────────────────────────────────────────────────────
const pBi = await promptFor('bilingual')
checks['bilingual: generates English'] = pBi.includes('viết TOÀN BỘ nội dung bằng TIẾNG ANH')
checks['bilingual: mentions the Dich button'] = pBi.includes('bấm nút "Dịch"')
checks['bilingual: forbids Vietnamese in the answer'] =
  pBi.includes('TUYỆT ĐỐI KHÔNG viết tiếng Việt')

// ── 4. Summary headings follow the language ──────────────────────────────────
lastPrompt = ''
await summarizeMeetingTranscripts(
  [
    {
      id: 1,
      speaker: 'Cuoc hop',
      original: 'we build a chat app',
      translated: 'chung toi xay app chat',
      timestamp: '15:03',
    },
  ],
  'discussion',
  'en'
)
checks['summary en: English headings'] =
  lastPrompt.includes('Core summary:') && lastPrompt.includes('Key points:')
checks['summary en: asks for English'] = lastPrompt.includes('TIẾNG ANH')

lastPrompt = ''
await summarizeMeetingTranscripts(
  [
    {
      id: 1,
      speaker: 'Cuoc hop',
      original: 'we build a chat app',
      translated: 'chung toi xay app chat',
      timestamp: '15:03',
    },
  ],
  'discussion',
  'vi'
)
checks['summary vi: Vietnamese headings'] =
  lastPrompt.includes('Tóm lược cốt lõi:') && lastPrompt.includes('Các luận điểm chính:')

// ── 5. translateToVietnamese ────────────────────────────────────────────────
lastPrompt = ''
const translated = await translateToVietnamese('First suggestion content.')
checks['translate: returns LLM text'] = translated === delimited
checks['translate: prompt asks for Vietnamese'] = lastPrompt.includes('sang TIẾNG VIỆT')
checks['translate: empty input -> null'] = (await translateToVietnamese('   ')) === null

// Without any API key the translator must fail cleanly (no mock translation).
store.delete('cfg_groq_key')
store.delete('cached_dynamic_ai_models')
store.delete('meeting_copilot_ai_model')
lastPrompt = ''
const noKey = await translateToVietnamese('First suggestion content.')
checks['translate: no key -> null'] = noKey === null
checks['translate: no call made without key'] = lastPrompt === ''

let allPass = true
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) allPass = false
}

console.log(
  allPass
    ? '\nPASS: response language setting is wired into every prompt'
    : '\nFAIL: language wiring regression'
)
process.exit(allPass ? 0 : 1)
