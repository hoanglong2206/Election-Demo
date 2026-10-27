// Regression test for the "trao đổi gần nhất" logic.
//
// Fixed issues:
//  - Interview mode used to fall back to the LAST speaker, which is usually the
//    candidate -> the box labelled "Câu hỏi gần nhất (…)" showed the candidate's
//    own answer.
//  - The box showed the Vietnamese translation; it must show the ORIGINAL
//    transcript wording.
//  - It returned several sentences; it must return only the LATEST sentence.
//  - No way to tell a stale AI scan apart from the current transcript.
//
// Run:  bun run _ui-verify/exchange.test.ts

import {
  extractHeuristicLatestExchange,
  isCandidateSpeaker,
  stitchFragments,
  takeLastSentence,
} from '../src/app/services/ai-model/copilot/scanLatestExchange'

const checks: Record<string, boolean> = {}

// ── 1. Interview: candidate spoke last, must return the interviewer's question
const interviewLines = [
  { speaker: 'Interviewer', original: 'Can you explain', translated: 'Bạn có thể giải thích', timestamp: '10:00' },
  { speaker: 'Interviewer', original: 'how CAP theorem', translated: 'định lý CAP', timestamp: '10:01' },
  { speaker: 'Interviewer', original: 'applies to your system?', translated: 'áp dụng vào hệ thống của bạn không?', timestamp: '10:02' },
  { speaker: 'You', original: 'Yes, in our fintech project', translated: 'Vâng, trong dự án fintech của chúng tôi', timestamp: '10:05' },
]

const iv = extractHeuristicLatestExchange(interviewLines, 'interview')
checks['interview: picks the interviewer, not the candidate'] = iv?.speaker === 'Interviewer'
checks['interview: stitches the whole turn'] =
  iv?.original === 'Can you explain how CAP theorem applies to your system?'
checks['interview: keeps the last timestamp of the turn'] = iv?.timestamp === '10:02'
checks['interview: shows ORIGINAL text, not the translation'] =
  iv?.original === 'Can you explain how CAP theorem applies to your system?'
checks['interview: has no translated field'] =
  !Object.prototype.hasOwnProperty.call(iv ?? {}, 'translated')
checks['interview: detects a question'] = iv?.isQuestion === true
checks['interview: records sourceLineCount'] = iv?.sourceLineCount === interviewLines.length

// ── 2. Interview: only the candidate has spoken -> fall back to the last line
const onlyCandidate = [
  { speaker: 'You', original: 'My name is An', translated: 'Tôi tên là An', timestamp: '09:00' },
  { speaker: 'You', original: 'and I build backends', translated: 'và tôi làm backend', timestamp: '09:01' },
]
const oc = extractHeuristicLatestExchange(onlyCandidate, 'interview')
checks['interview: falls back to last line when no interviewer'] =
  oc?.speaker === 'You' && oc?.original === 'My name is An and I build backends'

// ── 3. Discussion: last speaker's contiguous run only
const discussion = [
  { speaker: 'Cuộc họp', original: 'We should use Redis', translated: 'Chúng ta nên dùng Redis', timestamp: '11:00' },
  { speaker: 'You', original: 'I disagree', translated: 'Tôi không đồng ý', timestamp: '11:01' },
  { speaker: 'Cuộc họp', original: 'Actually', translated: 'Thực ra', timestamp: '11:02' },
  { speaker: 'Cuộc họp', original: 'the cache layer is the bottleneck', translated: 'tầng cache mới là điểm nghẽn', timestamp: '11:03' },
]
const disc = extractHeuristicLatestExchange(discussion, 'discussion')
checks['discussion: only the trailing speaker run'] =
  disc?.original === 'Actually the cache layer is the bottleneck'
checks['discussion: does not include the other speaker'] =
  !disc?.original.includes('I disagree')
checks['discussion: speaker is the last speaker'] = disc?.speaker === 'Cuộc họp'

// ── 4. Only ONE sentence is kept, not the whole passage
const multiSentence = [
  {
    speaker: 'Cuộc họp',
    original: 'Today we are building chat hub messaging system from scratch.',
    translated: '',
    timestamp: '17:54',
  },
  {
    speaker: 'Cuộc họp',
    original: 'It will be a complete real time chat platform.',
    translated: '',
    timestamp: '17:55',
  },
  {
    speaker: 'Cuộc họp',
    original: 'We start with the WebSocket layer.',
    translated: '',
    timestamp: '17:56',
  },
]
const ms = extractHeuristicLatestExchange(multiSentence, 'discussion')
checks['multi-sentence turn -> only the LAST sentence'] =
  ms?.original === 'We start with the WebSocket layer.'
checks['multi-sentence turn -> drops earlier sentences'] =
  !ms?.original.includes('Today we are building')

// ── 5. takeLastSentence edge cases
checks['takeLastSentence: splits on ? and .'] =
  takeLastSentence('First sentence. Second sentence?') === 'Second sentence?'
checks['takeLastSentence: keeps a single sentence intact'] =
  takeLastSentence('Only one sentence here.') === 'Only one sentence here.'
checks['takeLastSentence: does not split at Prof.'] =
  takeLastSentence('It will be a complete platform with Prof. Fresh tons of')
    === 'It will be a complete platform with Prof. Fresh tons of'
checks['takeLastSentence: does not split at e.g.'] =
  takeLastSentence('We support many DBs, e.g. Postgres and MySQL.') ===
  'We support many DBs, e.g. Postgres and MySQL.'
checks['takeLastSentence: empty input'] = takeLastSentence('   ') === ''

// ── 6. Empty / degenerate input
checks['empty input -> null'] = extractHeuristicLatestExchange([], 'discussion') === null
const blank = extractHeuristicLatestExchange(
  [{ speaker: 'You', original: '   ', translated: '  ', timestamp: '1' }],
  'discussion'
)
checks['blank content -> null'] = blank === null

// ── 7. Speaker classification
checks['isCandidateSpeaker: You'] = isCandidateSpeaker('You') === true
checks['isCandidateSpeaker: Interviewer'] = isCandidateSpeaker('Interviewer') === false
checks['isCandidateSpeaker: Cuộc họp'] = isCandidateSpeaker('Cuộc họp') === false

// ── 8. Fragment stitching drops STT overlap
checks['stitch: removes word overlap'] =
  stitchFragments(['I worked on a chat', 'a chat platform']) === 'I worked on a chat platform'
checks['stitch: joins plain fragments'] =
  stitchFragments(['hello there', 'how are you']) === 'hello there how are you'

// ── 9. scanLatestExchangeWithAI returns assembler result with 0 LLM calls
const { scanLatestExchangeWithAI } = await import('../src/app/services/ai-model/copilot/scanLatestExchange')
const aiScanned = await scanLatestExchangeWithAI(interviewLines, 'interview')
checks['scanLatestExchangeWithAI: returns assembled result'] = aiScanned?.original === 'Can you explain how CAP theorem applies to your system?'
checks['scanLatestExchangeWithAI: does not mark as AI scanned'] = aiScanned?.isAiScanned === false
checks['scanLatestExchangeWithAI: includes fullTurnText'] = aiScanned?.fullTurnText === 'Can you explain how CAP theorem applies to your system?'

// ── 10. Valid word repetition preservation
checks['stitch: preserves valid word repetitions'] =
  stitchFragments(['I think that', 'that is true']) === 'I think that that is true'

let allPass = true
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) allPass = false
}

console.log('\n--- sample (interview) ---')
console.log(JSON.stringify(iv, null, 2))
console.log('--- sample (multi-sentence turn) ---')
console.log(JSON.stringify(ms, null, 2))

console.log(allPass ? '\nPASS: latest-exchange logic is correct' : '\nFAIL: exchange logic regression')
process.exit(allPass ? 0 : 1)

