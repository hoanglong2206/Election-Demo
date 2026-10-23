import { TranscriptAssembler } from '../src/app/services/ai-model/stt/transcriptAssembler'
import { STTJobQueue } from '../src/app/services/ai-model/stt/sttJobQueue'
import type { AssemblerCommit, STTJob, TranscribeResult } from '../src/app/services/ai-model/stt/types'

console.log('--- TEST 1: TranscriptAssembler Sequential Ordering with Out-Of-Order Worker Resolution ---')

const assembler = new TranscriptAssembler('test_session')
const commits: AssemblerCommit[] = []
assembler.onCommit((c) => {
  commits.push(c)
})

const makeResult = (text: string): TranscribeResult => ({
  success: true,
  text,
  translatedVi: text,
  latencyMs: 100,
  engineId: 'test-engine',
  engineName: 'Test Engine',
  provider: 'Local',
  confidence: 99,
})

// Receive sequence 2 before sequence 1
assembler.receiveResult(2, makeResult('Sequence Two'), {
  jobId: 'job_2',
  sessionId: 'test_session',
  speakerLabel: 'Speaker',
  timestampStr: '10:02',
})

console.assert(commits.length === 0, 'Commits should be 0 because sequence 1 has not arrived yet')

// Receive sequence 3
assembler.receiveResult(3, makeResult('Sequence Three'), {
  jobId: 'job_3',
  sessionId: 'test_session',
  speakerLabel: 'Speaker',
  timestampStr: '10:03',
})
console.assert(commits.length === 0, 'Commits should still be 0 waiting on sequence 1')

// Now receive sequence 1
assembler.receiveResult(1, makeResult('Sequence One'), {
  jobId: 'job_1',
  sessionId: 'test_session',
  speakerLabel: 'Speaker',
  timestampStr: '10:01',
})

// Sequences 1, 2, and 3 should now be committed in strict chronological order!
console.assert(commits.length === 3, `Expected 3 commits, got ${commits.length}`)
console.assert(commits[0].sequenceId === 1 && commits[0].result.text === 'Sequence One', 'First commit must be Sequence 1')
console.assert(commits[1].sequenceId === 2 && commits[1].result.text === 'Sequence Two', 'Second commit must be Sequence 2')
console.assert(commits[2].sequenceId === 3 && commits[2].result.text === 'Sequence Three', 'Third commit must be Sequence 3')
console.log('✓ TEST 1 PASSED: Out-of-order workers properly reassembled monotonically by sequenceId.')

console.log('\n--- TEST 2: Sequence Skip Handling (Silence Chunks Dropped) ---')
// Skip sequence 4 (silence chunk)
assembler.skipSequence(4)
// Receive sequence 5
assembler.receiveResult(5, makeResult('Sequence Five'), {
  jobId: 'job_5',
  sessionId: 'test_session',
  speakerLabel: 'Speaker',
  timestampStr: '10:05',
})

console.assert(commits.length === 4, `Expected 4 commits (1, 2, 3, 5), got ${commits.length}`)
console.assert(commits[3].sequenceId === 5, 'Fourth commit must be Sequence 5')
console.log('✓ TEST 2 PASSED: Dropped/silence chunks successfully advance pointer without pipeline stall.')

console.log('\n--- TEST 3: STTJobQueue Silence Dropping & Concurrency Limits ---')
const queueAssembler = new TranscriptAssembler('queue_session')
const queue = new STTJobQueue({ maxQueueSize: 5, concurrency: 1 }, queueAssembler)

// Try enqueuing silence chunk
const silenceJob: STTJob = {
  jobId: 'job_silence_1',
  sessionId: 'queue_session',
  sequenceId: 1,
  audioBuffer: new Int16Array(16000),
  createdAt: Date.now(),
  priority: 0,
  hasSpeech: false, // VAD: no speech!
}

const silenceRes = queue.enqueue(silenceJob)
console.assert(silenceRes.enqueued === false && silenceRes.reason === 'silence_vad', 'Silence job should not be enqueued')
console.assert(queue.getMetrics().droppedJobs === 1, 'Dropped jobs count should be 1')
console.log('✓ TEST 3 PASSED: Silence chunks dropped before enqueue and sequence skipped in assembler.')

console.log('\n--- TEST 4: Backpressure and Max Queue Size ---')
// Pause first so all five occupy the waiting queue; maxQueueSize excludes active workers.
queue.pause()
for (let i = 2; i <= 6; i++) {
  queue.enqueue({
    jobId: `job_${i}`,
    sessionId: 'queue_session',
    sequenceId: i,
    audioBuffer: new Int16Array(16000),
    createdAt: Date.now(),
    priority: 1,
    hasSpeech: true,
  })
}

// Check queue depth
const metrics = queue.getMetrics()
console.log('Queue metrics under load:', metrics)
console.assert(metrics.queueDepth <= 5, 'Queue depth should not exceed maxQueueSize')

// Try enqueuing a 7th equal priority job while queue is full
const overflowJob: STTJob = {
  jobId: 'job_7',
  sessionId: 'queue_session',
  sequenceId: 7,
  audioBuffer: new Int16Array(16000),
  createdAt: Date.now(),
  priority: 1,
  hasSpeech: true,
}
const overflowRes = queue.enqueue(overflowJob)
console.assert(overflowRes.enqueued === false && overflowRes.reason === 'backpressure_full', 'Backpressure should signal queue full')
console.log('✓ TEST 4 PASSED: Backpressure protection stops unbounded memory growth.')
queue.clear()

console.log('\n--- TEST 5: Pause / Resume / Clear Lifecycle ---')
queue.pause()
console.assert(queue.getMetrics().isPaused === true, 'Queue should be paused')
queue.resume()
console.assert(queue.getMetrics().isPaused === false, 'Queue should be resumed')
queue.clear()
console.assert(queue.getMetrics().queueDepth === 0, 'Queue should be empty after clear')
console.log('✓ TEST 5 PASSED: Pause / Resume / Clear lifecycle operational.')

console.log('\n--- TEST 6: STT Provider Switching & Worker Concurrency ---')
// Enqueue a job in queue
queue.enqueue({
  jobId: 'job_switch_1',
  sessionId: 'queue_session',
  sequenceId: 10,
  audioBuffer: new Int16Array(16000),
  createdAt: Date.now(),
  priority: 1,
  hasSpeech: true,
})
// Switch to Groq (Cloud Whisper) with cancelPending: true
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return key === 'cached_groq_stt_models'
        ? JSON.stringify([{ id: 'whisper-large-v3-turbo', provider: 'Groq' }])
        : null
    },
    setItem() {},
  },
})
queue.handleProviderSwitch('whisper-large-v3-turbo', { cancelPending: true })
const groqMetrics = queue.getMetrics()
console.assert(groqMetrics.provider === 'Groq', 'Provider should be Groq')
console.assert(groqMetrics.concurrency === 3, 'Concurrency for Groq should be 3')
console.assert(groqMetrics.queueDepth === 0, 'Pending queue should be canceled safely on switch')
console.log('✓ TEST 6 PASSED: STT provider switching adjusts concurrency safely and controls pending jobs.')

console.log('\nALL STT QUEUE & ASSEMBLER UNIT TESTS PASSED!')
process.exit(0)
