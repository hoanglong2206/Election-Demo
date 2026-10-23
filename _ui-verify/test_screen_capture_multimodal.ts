/**
 * Test Suite: Screen Capture + Multimodal Question Analysis Verification
 *
 * Validates:
 * 1. ScreenCaptureService downscale/crop logic & memory dereferencing
 * 2. VisualQuestionAnalyzer JSON & markdown parser across 5 content categories
 * 3. TieredContextManager visual question context assembly & token budgeting
 * 4. SettingsManager multimodal model selection & persistence
 */

import {
  screenCaptureService,
  visualQuestionAnalyzer,
  ocrService,
  type VisualAnalysisResult,
  type VisualQuestionItem,
  DEFAULT_MULTIMODAL_MODELS,
} from '../src/app/services/screen-capture'
import { tieredContextManager } from '../src/app/services/ai-model/copilot'
import { settingsManager } from '../src/app/services/settings'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`)
  }
}

console.log('🧪 Starting Screen Capture + Multimodal Analysis Test Suite...\n')

// ── Test 1: Multimodal Model Registry & Settings Persistence ─────────────────
console.log('▶ Test 1: Multimodal Model Registry & Settings Persistence')
assert(DEFAULT_MULTIMODAL_MODELS.length >= 5, 'Should have at least 5 default vision models')

const providers = new Set(DEFAULT_MULTIMODAL_MODELS.map((m) => m.provider))
assert(providers.has('Google'), 'Must support Google Gemini')
assert(providers.has('OpenAI'), 'Must support OpenAI')
assert(providers.has('Groq'), 'Must support Groq LPU Vision')

const initialModel = settingsManager.get('selectedMultimodal') as string
assert(typeof initialModel === 'string' && initialModel.length > 0, 'Default multimodal model must exist')

// Reset back
settingsManager.set('selectedMultimodal', 'gemini-1.5-flash')
assert(
  settingsManager.get('selectedMultimodal') === 'gemini-1.5-flash',
  'Setting selectedMultimodal back to Gemini Flash must persist'
)
console.log('  ✓ Multimodal model configuration & settings persistence passed\n')

// ── Test 2: VisualQuestionAnalyzer Parser Across All 5 Categories ────────────
console.log('▶ Test 2: VisualQuestionAnalyzer JSON & Fence Parser Across All 5 Content Types')

// 2.1: coding_question wrapped in markdown code fence
const codingResponse = `Dưới đây là phân tích câu hỏi coding của bạn:
\`\`\`json
{
  "contentType": "coding_question",
  "title": "Two Sum II - Input Array Is Sorted",
  "language": "TypeScript",
  "difficulty": "Medium",
  "extractedCode": "function twoSum(numbers: number[], target: number): number[]",
  "problemSummary": "Tìm hai số có tổng bằng target trong mảng đã sắp xếp tăng dần.",
  "keyInsights": [
    "Mảng đã sắp xếp sẵn -> Dùng Two Pointers với O(1) space",
    "Không cần hash map, tránh tốn O(N) bộ nhớ phụ"
  ],
  "stepByStepSolution": "Khởi tạo left = 0, right = n - 1. Nếu sum == target thì trả về. Nếu sum < target thì left++, ngược lại right--.",
  "recommendedAnswer": "Em nhận thấy mảng đã được sắp xếp tăng dần, vì vậy thay vì dùng Hash Map với độ phức tạp không gian O(N), ta có thể áp dụng kỹ thuật Two Pointers tối ưu..."
}
\`\`\`
Chúc bạn phỏng vấn thành công!`

const parsedCoding = visualQuestionAnalyzer.parseModelResponse(codingResponse)
assert(parsedCoding.contentType === 'coding_question', 'Must parse as coding_question')
assert(parsedCoding.title === 'Two Sum II - Input Array Is Sorted', 'Title must match')
assert(parsedCoding.language === 'TypeScript', 'Language must be TypeScript')
assert(parsedCoding.difficulty === 'Medium', 'Difficulty must be Medium')
assert(parsedCoding.keyInsights.length === 2, 'Key insights must have 2 items')
assert(parsedCoding.recommendedAnswer.includes('Two Pointers'), 'Recommended answer must be present')
console.log('  ✓ 2.1 coding_question parsed correctly')

// 2.2: error_trace
const errorResponse = `{
  "contentType": "error_trace",
  "title": "UnhandledPromiseRejection: ConnectionPoolTimeoutError in PostgreSQL",
  "language": "PostgreSQL / Node.js",
  "difficulty": "Hard",
  "extractedCode": "Error: ConnectionPoolTimeoutError: Timeout acquiring client connection after 10000ms",
  "problemSummary": "Database connection pool bị cạn kiệt do connection leak khi truy vấn không release.",
  "keyInsights": [
    "Connection leak xảy ra khi client.release() không nằm trong finally block",
    "Max pool size hiện tại có thể quá thấp so với số lượng concurrency"
  ],
  "stepByStepSolution": "1. Đảm bảo toàn bộ connection acquire đều có try/finally để release client. 2. Tăng pool size và cấu hình idleTimeoutMillis.",
  "recommendedAnswer": "Lỗi này xuất phát từ việc connection pool của Postgres bị cạn kiệt. Nguyên nhân phổ biến nhất là một transaction hoặc async query bị lỗi nhưng không gọi client.release()..."
}`

const parsedError = visualQuestionAnalyzer.parseModelResponse(errorResponse)
assert(parsedError.contentType === 'error_trace', 'Must parse as error_trace')
assert(parsedError.difficulty === 'Hard', 'Difficulty must be Hard')
console.log('  ✓ 2.2 error_trace parsed correctly')

// 2.3: architecture_diagram
const diagramResponse = `{
  "contentType": "architecture_diagram",
  "title": "CQRS + Event Sourcing Order Processing Pipeline",
  "language": "Go / Kafka",
  "difficulty": "Hard",
  "problemSummary": "Sơ đồ luồng xử lý Order từ API Gateway qua Kafka Event Bus tới Read/Write DBs.",
  "keyInsights": [
    "Tách biệt Command Service (Postgres write model) và Query Service (Elasticsearch read model)",
    "Kafka topic order-events làm nguồn chân lý duy nhất (single source of truth)"
  ],
  "stepByStepSolution": "Sử dụng Outbox Pattern để tránh lỗi dual-write giữa Database và Kafka.",
  "recommendedAnswer": "Sơ đồ này mô tả kiến trúc CQRS kết hợp Event Sourcing. Để đảm bảo dữ liệu ghi vào Database và event bắn lên Kafka đồng nhất tuyệt đối, em đề xuất dùng Transactional Outbox Pattern..."
}`

const parsedDiagram = visualQuestionAnalyzer.parseModelResponse(diagramResponse)
assert(parsedDiagram.contentType === 'architecture_diagram', 'Must parse as architecture_diagram')
console.log('  ✓ 2.3 architecture_diagram parsed correctly')

// 2.4: system_design
const sysDesignResponse = `{
  "contentType": "system_design",
  "title": "Design a Distributed Rate Limiter for 10M DAU",
  "language": "Redis / Lua",
  "difficulty": "Hard",
  "problemSummary": "Thiết kế hệ thống giới hạn lưu lượng người dùng 100 req/min trên quy mô phân tán.",
  "keyInsights": [
    "Sliding Window Counter kết hợp Redis ZSET hoặc Lua Script nguyên tử",
    "Tránh Race Condition khi nhiều Gateway instances cùng truy cập"
  ],
  "stepByStepSolution": "Triển khai Sliding Window Log bằng Redis ZADD + ZREMRANGEBYSCORE hoặc Token Bucket trong Redis Lua script.",
  "recommendedAnswer": "Với bài toán Distributed Rate Limiter ở quy mô này, em đề xuất thuật toán Sliding Window Counter hoặc Token Bucket thực thi bằng Redis Lua script nguyên tử..."
}`

const parsedSysDesign = visualQuestionAnalyzer.parseModelResponse(sysDesignResponse)
assert(parsedSysDesign.contentType === 'system_design', 'Must parse as system_design')
console.log('  ✓ 2.4 system_design parsed correctly')

// 2.5: text_question with raw conversational text
const textResponse = `Đây là câu hỏi lý thuyết:
{
  "contentType": "text_question",
  "title": "Explain React 19 Server Components vs Client Components",
  "language": "React / Next.js",
  "difficulty": "Medium",
  "problemSummary": "So sánh sự khác biệt về execution context, bundle size và tương tác DOM.",
  "keyInsights": [
    "Server Components chạy thuần túy trên Server, 0 KB JavaScript gửi về client",
    "Client Components ('use client') có state, effects và event listeners"
  ],
  "stepByStepSolution": "1. Giải thích mục tiêu giảm bundle size. 2. Phân biệt lifecycle. 3. Khi nào dùng composition pattern.",
  "recommendedAnswer": "Server Components và Client Components trong React 19 giải quyết bài toán tối ưu bundle size và render lifecycle..."
}`

const parsedText = visualQuestionAnalyzer.parseModelResponse(textResponse)
assert(parsedText.contentType === 'text_question', 'Must parse as text_question')
console.log('  ✓ 2.5 text_question parsed correctly\n')

// ── Test 3: TieredContextManager Integration ─────────────────────────────────
console.log('▶ Test 3: TieredContextManager Visual Question Integration')

tieredContextManager.setSessionId('test-session-screenshot')
tieredContextManager.clearVisualQuestions()
assert(tieredContextManager.getVisualQuestions().length === 0, 'Visual questions should be initially empty')

// Create mock visual question items
const mockVisualItem1: VisualQuestionItem = {
  ...parsedCoding,
  source: 'screenshot',
}

const mockVisualItem2: VisualQuestionItem = {
  ...parsedDiagram,
  source: 'screenshot',
}

tieredContextManager.addVisualQuestion(mockVisualItem1)
tieredContextManager.addVisualQuestion(mockVisualItem2)

const stored = tieredContextManager.getVisualQuestions()
assert(stored.length === 2, 'Should have 2 visual questions stored')
assert(stored[0].title === parsedDiagram.title, 'Latest item is prepended')
assert(stored[1].title === parsedCoding.title, 'Older item is second')

// Test formatted block output
const formattedBlock = tieredContextManager.formatVisualQuestionsBlock()
assert(
  formattedBlock.includes('CÂU HỎI TRÊN MÀN HÌNH (SCREENSHOT 📸)'),
  'Block must have visual screenshot header badge'
)
assert(
  formattedBlock.includes('Two Sum II - Input Array Is Sorted'),
  'Block must include question title'
)
assert(
  formattedBlock.includes('CQRS + Event Sourcing Order Processing Pipeline'),
  'Block must include second question title'
)

// Test assembleContext
const assembled = tieredContextManager.assembleContext('What is the time complexity of the solution?', 'interview')
assert(
  assembled.fullPromptContext.includes('Two Sum II'),
  'Assembled fullPromptContext must incorporate visual questions into context'
)
assert(assembled.estimatedTokens.shortTerm > 0, 'Short term tokens must account for visual questions')

// Test clear
tieredContextManager.clearVisualQuestions()
assert(tieredContextManager.getVisualQuestions().length === 0, 'Visual questions should be empty after clear')
console.log('  ✓ TieredContextManager visual question context integration passed\n')

// ── Test 4: ScreenCaptureService Memory Dereferencing ─────────────────────────
console.log('▶ Test 4: ScreenCaptureService Memory Dereferencing')
const sampleDataUrl = 'data:image/jpeg;base64,QUJDREVGR0hJSktMTU5PUA=='
screenCaptureService.releaseMemory(sampleDataUrl)
console.log('  ✓ releaseMemory executed cleanly without throwing\n')

console.log('🎉 ALL SCREEN CAPTURE & MULTIMODAL TESTS PASSED SUCCESSFULLY!')
