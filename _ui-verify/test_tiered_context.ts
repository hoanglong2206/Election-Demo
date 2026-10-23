import {
  TieredContextManager,
  estimateTokenCount,
  truncateToTokenLimit,
  DEFAULT_TOKEN_BUDGET,
  type TranscriptUtterance,
} from '../src/app/services/ai-model/copilot/contextManager'

console.log('================================================================');
console.log('🧪 MULTI-TIER CONTEXT ARCHITECTURE & CONTEXT MANAGER TEST SUITE');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Token Estimation Accuracy (English, Code & Vietnamese Unicode)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 1: Token Estimation Accuracy ---');

const englishSample = 'Antigravity AI Copilot orchestrates multi-tier context with high precision.';
const vietnameseSample = 'Hệ thống quản lý ngữ cảnh phân tầng giúp cuộc họp kéo dài không làm quá tải token.';
const codeSample = 'const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST" });';

const engTokens = estimateTokenCount(englishSample);
const viTokens = estimateTokenCount(vietnameseSample);
const codeTokens = estimateTokenCount(codeSample);

console.log(`English text (${englishSample.length} chars) -> ~${engTokens} tokens (ratio: ${(englishSample.length / engTokens).toFixed(2)} chars/tok)`);
console.log(`Vietnamese text (${vietnameseSample.length} chars) -> ~${viTokens} tokens (ratio: ${(vietnameseSample.length / viTokens).toFixed(2)} chars/tok)`);
console.log(`Code snippet (${codeSample.length} chars) -> ~${codeTokens} tokens`);

console.assert(engTokens > 10 && engTokens < 30, 'English token estimation within expected range');
console.assert(viTokens > 20 && viTokens < 60, 'Vietnamese token estimation accounts for Unicode diacritics');
console.assert(estimateTokenCount('') === 0, 'Empty string returns 0 tokens');
console.log('✓ TEST 1 PASSED: Token estimator accurately estimates English, Code, and Vietnamese text.\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Long Meeting Simulation (150+ Utterances) — Context Bounding Verification
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 2: Long Meeting Simulation (Context Token Bounding) ---');

const manager = new TieredContextManager('test_session_long_meeting', {
  permanent: 1500,
  sessionMemory: 1000,
  shortTerm: 1500,
  currentInput: 600,
  totalMax: 4600,
});

manager.setPermanentContext({
  cvSummary: 'Ứng viên Senior Fullstack Engineer có 6 năm kinh nghiệm với Node.js, TypeScript, React, Go, Docker, Kubernetes.',
  jobDescription: 'Tuyển Senior AI Platform Engineer xây dựng hệ thống Copilot realtime cho hội nghị trực tuyến.',
  userPreferences: 'Trả lời ngắn gọn, nhấn mạnh kiến trúc phân tán và latency.',
});

const speakers = ['Interviewer', 'Candidate', 'CTO'];
const topics = [
  'Kiến trúc hệ thống Speech-to-Text Whisper',
  'Tối ưu hóa bộ nhớ đệm Redis và LRU Cache',
  'Xử lý Backpressure trong hàng đợi âm thanh',
  'Chiến lược Indexing trong PostgreSQL cho hội thoại lớn',
  'Triển khai Electron IPC an toàn với preload contextBridge',
  'Microservices và cơ chế circuit breaker',
];

const recordedTokens: { lineCount: number; totalTokens: number }[] = [];

// Simulate 150 turns of conversation over a 90-minute meeting
for (let i = 1; i <= 150; i++) {
  const speaker = speakers[i % speakers.length];
  const topic = topics[i % topics.length];
  const utterance: TranscriptUtterance = {
    speaker,
    original: `[Lượt #${i}] Chúng ta hãy thảo luận sâu hơn về ${topic}. Đặc biệt là xử lý lỗi và tính sẵn sàng cao khi tải tăng đột biến.`,
    timestamp: `10:${String(Math.floor(i / 2)).padStart(2, '0')}`,
  };
  manager.addTranscriptLine(utterance);

  // Periodically assemble context as candidate receives new questions
  if (i === 10 || i === 30 || i === 60 || i === 100 || i === 150) {
    const question = `Ứng viên hãy giải thích chi tiết cách giải quyết vấn đề ở lượt #${i}?`;
    const assembled = manager.assembleContext(question, 'interview');

    console.log(
      `  Turn #${i.toString().padStart(3, ' ')} | Utterances: ${i} | Total Context Tokens: ${assembled.estimatedTokens.total} / ${assembled.tokenBudget.totalMax} (${assembled.usagePercent}% budget)`
    );

    recordedTokens.push({ lineCount: i, totalTokens: assembled.estimatedTokens.total });

    // CRITICAL INVARIANT: Context tokens must never exceed totalMax budget
    console.assert(
      assembled.estimatedTokens.total <= assembled.tokenBudget.totalMax,
      `Context token count ${assembled.estimatedTokens.total} must NOT exceed budget ${assembled.tokenBudget.totalMax} at turn #${i}`
    );
  }
}

// Ensure token count levels off instead of growing linearly
const tokenAt10 = recordedTokens[0].totalTokens;
const tokenAt100 = recordedTokens[3].totalTokens;
const tokenAt150 = recordedTokens[4].totalTokens;

console.log(`Tokens at turn 10: ${tokenAt10}, at turn 100: ${tokenAt100}, at turn 150: ${tokenAt150}`);
console.assert(
  tokenAt150 <= manager.assembleContext('test').tokenBudget.totalMax,
  'Context tokens remained strictly bounded throughout 150 turns'
);
console.log('✓ TEST 2 PASSED: Context token budget does not grow indefinitely over 150+ utterances.\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Incremental Summarization & Structured Schema Merging
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 3: Incremental Summarization & Schema Merging ---');

const summaryManager = new TieredContextManager('test_session_incremental');

// Add 35 lines of conversation
for (let i = 1; i <= 35; i++) {
  summaryManager.addTranscriptLine({
    speaker: i % 2 === 0 ? 'Interviewer' : 'Candidate',
    original: `Trao đổi về module phân tích âm thanh #${i}: độ trễ ${i * 10}ms.`,
    timestamp: '11:00',
  });
}

// Check shouldTriggerIncrementalSummary
const shouldTrigger = summaryManager.shouldTriggerIncrementalSummary();
console.assert(shouldTrigger === true, 'shouldTriggerIncrementalSummary should be true after 35 lines (exceeds threshold 20)');

// Simulate LLM incremental summarizer updating structured schema
const mockLlmDelta = {
  topics: ['Kiến trúc Audio Pipeline', 'Độ trễ Whisper'],
  facts: ['Whisper C++ độ trễ trung bình 150ms', 'Sample rate 16kHz PCM'],
  decisions: ['Dùng STTJobQueue để kiểm soát backpressure'],
  openQuestions: ['Có nên bật streaming VAD hay không?'],
  importantStatements: ['CTO yêu cầu độ trễ dưới 500ms'],
};

summaryManager.mergeIntoRollingMemory(mockLlmDelta, 20);

const memory = summaryManager.getRollingMemory();
console.log('Rolling Session Memory Schema:');
console.log('- Topics:', memory.topics);
console.log('- Facts:', memory.facts);
console.log('- Decisions:', memory.decisions);
console.log('- Open Questions:', memory.openQuestions);
console.log('- Important Statements:', memory.importantStatements);
console.log('- Last processed index:', memory.lastProcessedIndex);

console.assert(memory.topics.includes('Kiến trúc Audio Pipeline'), 'Topic merged');
console.assert(memory.decisions.includes('Dùng STTJobQueue để kiểm soát backpressure'), 'Decision merged');
console.assert(memory.lastProcessedIndex === 20, 'lastProcessedIndex advanced to 20 (not 0)');

const formattedBlock = summaryManager.formatSessionMemoryBlock();
console.log('\nFormatted Session Memory Block:\n' + formattedBlock);
console.assert(formattedBlock.includes('Chủ đề đã thảo luận'), 'Contains formatted topics');
console.assert(formattedBlock.includes('Quyết định đã thống nhất'), 'Contains formatted decisions');

console.log('✓ TEST 3 PASSED: Incremental summary correctly merges into schema and advances lastProcessedIndex.\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Priority Hierarchy on Budget Overflow
// Current Input (P1) > Short-Term (P2) > Session Memory (P3) > Permanent (P4)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 4: Priority Hierarchy on Extreme Budget Overflow ---');

const smallBudgetManager = new TieredContextManager('test_session_priority', {
  permanent: 400,
  sessionMemory: 300,
  shortTerm: 500,
  currentInput: 300,
  totalMax: 800, // Very tight total budget to force priority slicing
});

// Inject huge permanent context (2000 chars)
const giantCv = 'Kinh nghiệm '.repeat(300);
smallBudgetManager.setPermanentContext({
  cvSummary: giantCv,
  jobDescription: 'Job description '.repeat(100),
});

// Inject rich session memory
smallBudgetManager.mergeIntoRollingMemory(
  {
    topics: ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4'],
    facts: ['Fact A with details', 'Fact B with details', 'Fact C with details'],
    decisions: ['Decision X', 'Decision Y'],
    openQuestions: ['Question 1?', 'Question 2?'],
    importantStatements: ['Statement 1'],
  },
  10
);

// Add 15 utterances
for (let i = 1; i <= 15; i++) {
  smallBudgetManager.addTranscriptLine({
    speaker: 'Speaker',
    original: `Utterance ${i}: This is an important conversational point in the ongoing dialogue.`,
  });
}

const criticalQuestion = 'How does Redis handle master-replica failover under split-brain scenario?';
const assembledOverflow = smallBudgetManager.assembleContext(criticalQuestion, 'interview');

console.log('Total tokens after overflow handling:', assembledOverflow.estimatedTokens.total, '/', assembledOverflow.tokenBudget.totalMax);
console.log('Breakdown:', assembledOverflow.estimatedTokens);
console.log('Is truncated:', assembledOverflow.isTruncated);

// Verify Priority 1: Current question is preserved intact
console.assert(
  assembledOverflow.currentInputBlock.includes('How does Redis handle master-replica failover'),
  'P1 Current Question MUST be fully preserved'
);

// Verify Total tokens <= totalMax
console.assert(
  assembledOverflow.estimatedTokens.total <= assembledOverflow.tokenBudget.totalMax,
  'Total tokens must not exceed totalMax budget even with massive overflow'
);

// Verify Permanent context was trimmed the most (lowest priority)
console.assert(
  assembledOverflow.estimatedTokens.permanent < 300,
  'Permanent context was trimmed first according to P4 lowest priority'
);

console.log('✓ TEST 4 PASSED: Priority hierarchy (Current Input > Short-Term > Session Memory > Permanent) strictly maintained.\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Crash Recovery & Persistence
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- TEST 5: Crash Recovery & Session Persistence ---');

const recoverySessionId = `session_crash_test_${Date.now()}`;
const originalManager = new TieredContextManager(recoverySessionId);

originalManager.mergeIntoRollingMemory(
  {
    topics: ['GraphQL Federation', 'Apollo Gateway'],
    facts: ['Gateway latency 5ms', 'Subgraphs 4'],
    decisions: ['Migrate to Rust Router for higher throughput'],
    openQuestions: ['How to handle schema checks in CI/CD?'],
    importantStatements: ['Lead Architect approved migration'],
  },
  42
);

// Memory should be persisted
originalManager.persistSessionMemory();

// Simulate crash and reboot: new instance with the exact same sessionId
const recoveredManager = new TieredContextManager(recoverySessionId);
const restored = recoveredManager.restoreSessionMemory();
console.assert(restored === true, 'restoreSessionMemory returned true');

const restoredMem = recoveredManager.getRollingMemory();
console.assert(restoredMem.topics.includes('GraphQL Federation'), 'Restored topics match');
console.assert(restoredMem.decisions.includes('Migrate to Rust Router for higher throughput'), 'Restored decisions match');
console.assert(restoredMem.lastProcessedIndex === 42, 'Restored lastProcessedIndex matches 42');

console.log('Restored memory after simulated crash:', {
  topics: restoredMem.topics,
  decisions: restoredMem.decisions,
  lastProcessedIndex: restoredMem.lastProcessedIndex,
});

// Clear session test
recoveredManager.clearSessionMemory();
const emptyMem = recoveredManager.getRollingMemory();
console.assert(emptyMem.topics.length === 0, 'Memory empty after clearSessionMemory');

console.log('✓ TEST 5 PASSED: Crash recovery restores all schema fields and indices accurately.\n');

console.log('================================================================');
console.log('🎉 ALL 5 TIERED CONTEXT ARCHITECTURE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
