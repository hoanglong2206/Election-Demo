import { isQuestionUtterance } from '../src/app/services/ai-model/copilot/questionDetector'

const testCases: { text: string; expected: boolean; reason: string }[] = [
  // English questions with ?
  { text: 'How are you?', expected: true, reason: 'Standard EN question with ?' },
  { text: 'What is your name?', expected: true, reason: 'Standard EN question with ?' },
  { text: '-그러니까 มียังอะไร วิน วิน 哇 (laughing) How are you?', expected: true, reason: 'User bug: noise + laughing + How are you?' },

  // English questions WITHOUT ? (STT frequently drops ?)
  { text: 'How are you', expected: true, reason: 'How are you without ?' },
  { text: 'How are you.', expected: true, reason: 'How are you with period' },
  { text: '(laughing) How are you', expected: true, reason: 'Audio tag + How are you without ?' },
  { text: 'So, how are you', expected: true, reason: 'Filler prefix + How are you' },
  { text: 'Well what do you think', expected: true, reason: 'Filler prefix + what do you think' },
  { text: 'Can you explain the architecture', expected: true, reason: 'Can you without ?' },
  { text: 'Could you explain how this works', expected: true, reason: 'Could you without ?' },
  { text: 'Should we deploy Redis cluster', expected: true, reason: 'Should we without ?' },
  { text: 'Are you ready for the demo', expected: true, reason: 'Are you without ?' },
  { text: 'Is there any latency issue', expected: true, reason: 'Is there without ?' },
  { text: 'Do you have any questions', expected: true, reason: 'Do you without ?' },
  { text: 'Any thoughts on this approach', expected: true, reason: 'Any thoughts without ?' },
  { text: 'What about caching', expected: true, reason: 'What about without ?' },
  { text: 'Tell me about your background', expected: true, reason: 'Interview prompt prompt' },

  // Vietnamese questions with/without ?
  { text: 'Bạn có khỏe không?', expected: true, reason: 'VN question with ?' },
  { text: 'Bạn có khỏe không', expected: true, reason: 'VN question without ?' },
  { text: 'Bạn có khỏe không.', expected: true, reason: 'VN question with period' },
  { text: 'Anh thấy giải pháp này thế nào', expected: true, reason: 'thế nào without ?' },
  { text: 'Dự án này đã xong chưa?', expected: true, reason: 'chưa with ?' },
  { text: 'Dự án này đã xong chưa', expected: true, reason: 'chưa at sentence end without ?' },
  { text: 'Làm sao để tối ưu truy vấn này', expected: true, reason: 'Làm sao without ?' },
  { text: 'Tại sao hệ thống lại bị crash', expected: true, reason: 'Tại sao without ?' },
  { text: 'Có vấn đề gì không bạn', expected: true, reason: 'có...không without ?' },
  { text: 'Em làm thế này được không', expected: true, reason: 'được không without ?' },
  { text: 'Mình dùng Kafka được không anh', expected: true, reason: 'được không at end' },

  // Declarative Statements (MUST be FALSE)
  { text: 'Hệ thống chưa chạy xong.', expected: false, reason: 'chưa in middle of statement' },
  { text: 'Tôi nghĩ chúng ta nên dùng Redis cluster.', expected: false, reason: 'VN statement' },
  { text: 'Dự án đã hoàn thành đúng hạn.', expected: false, reason: 'VN statement' },
  { text: 'Chúng tôi đã thử giải pháp này tuần trước.', expected: false, reason: 'VN statement' },
  { text: 'Về cơ bản kiến trúc gồm 3 tầng.', expected: false, reason: 'VN statement' },
  { text: 'I think we should migrate the database tonight.', expected: false, reason: 'EN statement' },
  { text: 'The server response time is 150 milliseconds.', expected: false, reason: 'EN statement' },
]

console.log('Testing CURRENT isQuestionUtterance implementation:\n')
let passed = 0
for (const tc of testCases) {
  const actual = isQuestionUtterance(tc.text)
  const ok = actual === tc.expected
  if (ok) passed++
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}: "${tc.text}" -> actual: ${actual}, expected: ${tc.expected} (${tc.reason})`)
}
console.log(`\nResult: ${passed}/${testCases.length} passed`)
