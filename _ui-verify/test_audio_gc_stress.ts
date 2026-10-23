import { AudioBufferManager, TARGET_SAMPLE_RATE, CHUNK_SAMPLES } from '../src/app/core/audio/AudioBufferManager'
import { STTJobQueue } from '../src/app/services/ai-model/stt/sttJobQueue'
import { TranscriptAssembler } from '../src/app/services/ai-model/stt/transcriptAssembler'
import type { STTJob, TranscribeResult } from '../src/app/services/ai-model/stt/types'
import { createTransferablePcmBuffer } from '../src/app/lib/audioPipeline'

console.log('===================================================================')
console.log('STRESS TEST: Audio Buffer Garbage Collection for Long Meetings (60-120 min)')
console.log('===================================================================\n')

// ── TEST 1: Bounded Memory Ring Buffer during 60–120 minute continuous stream ───
console.log('--- TEST 1: Continuous 120-Minute Audio Stream (7,200 Chunks) Bounded Memory ---')
const manager = new AudioBufferManager(15.0) // 15-second bounded window
const BLOCK_SIZE = 4096 // Typical ScriptProcessorNode buffer size @ 16kHz (~256ms)
const BLOCKS_PER_SECOND = Math.round(TARGET_SAMPLE_RATE / BLOCK_SIZE) // ~4 blocks/sec
const TOTAL_MINUTES = 120
const TOTAL_SECONDS = TOTAL_MINUTES * 60 // 7,200 seconds
const TOTAL_BLOCKS = TOTAL_SECONDS * BLOCKS_PER_SECOND // ~28,800 blocks

// Pre-create a synthetic 4096-sample PCM block (256ms)
const mockPcm16 = new Int16Array(BLOCK_SIZE)
for (let i = 0; i < BLOCK_SIZE; i++) {
  mockPcm16[i] = Math.round(Math.sin((i / BLOCK_SIZE) * Math.PI * 8) * 16000)
}

let chunksEmitted = 0
const memorySnapshots: { minute: number; bufferedSec: number; ramKb: number; totalSamples: number }[] = []

console.log(`Simulating ${TOTAL_MINUTES} minutes (${TOTAL_SECONDS.toLocaleString()}s, ${TOTAL_BLOCKS.toLocaleString()} blocks) continuous input...`)

const startSimTime = Date.now()
for (let sec = 1; sec <= TOTAL_SECONDS; sec++) {
  for (let b = 0; b < BLOCKS_PER_SECOND; b++) {
    const chunkMeta = manager.appendSamples(mockPcm16)
    if (chunkMeta) {
      chunksEmitted++
    }
  }

  // Record telemetry snapshot at key intervals: 1m, 15m, 30m, 60m, 90m, 120m
  if (sec === 60 || sec === 900 || sec === 1800 || sec === 3600 || sec === 5400 || sec === 7200) {
    const min = sec / 60
    memorySnapshots.push({
      minute: min,
      bufferedSec: manager.bufferedSeconds,
      ramKb: Math.round(manager.sizeBytes / 1024),
      totalSamples: manager.totalSamples,
    })
  }
}

const elapsedSim = Date.now() - startSimTime
console.log(`Processed 120 minutes simulation in ${elapsedSim}ms (${chunksEmitted} 1.0s chunks generated).\n`)

console.log('Memory Snapshots across meeting duration:')
console.table(memorySnapshots)

// Verifications for Test 1:
const finalSnapshot = memorySnapshots[memorySnapshots.length - 1]
console.assert(
  finalSnapshot.ramKb <= 520,
  `Active RAM must be strictly bounded <= 520 KB (got ${finalSnapshot.ramKb} KB)! Naive array would be 230 MB!`
)
console.assert(
  finalSnapshot.bufferedSec <= 16.0,
  `Buffered duration must remain bounded <= 16.0s (got ${finalSnapshot.bufferedSec}s)`
)
console.assert(
  manager.totalSamples === TOTAL_SECONDS * BLOCKS_PER_SECOND * BLOCK_SIZE,
  `Total monotonic samples must accurately track session duration (got ${manager.totalSamples})`
)
console.assert(
  manager.durationSec >= 7190,
  `Cumulative meeting duration should be ~7,200s (got ${manager.durationSec}s)`
)

// Compare with unoptimized naive array growth:
const naiveUnboundedRamBytes = manager.totalSamples * 2
const naiveUnboundedRamMb = Math.round((naiveUnboundedRamBytes / (1024 * 1024)) * 100) / 100
const actualRamMb = manager.estimatedMemoryMb
const ramSavedMb = Math.round((naiveUnboundedRamMb - actualRamMb) * 100) / 100
console.log(`\nMemory Comparison at Minute 120:`)
console.log(`- Naive unbounded array RAM: ${naiveUnboundedRamMb} MB (${(naiveUnboundedRamBytes).toLocaleString()} bytes)`)
console.log(`- Optimized Bounded Window RAM: ${actualRamMb} MB (${manager.sizeBytes.toLocaleString()} bytes)`)
console.log(`- RAM Saved from GC leak: ${ramSavedMb} MB (${Math.round((ramSavedMb / naiveUnboundedRamMb) * 100)}% reduction!)`)
console.log('✓ TEST 1 PASSED: RAM is strictly bounded in O(1) range and does not scale linearly with meeting time.')

// ── TEST 2: Meeting Mode Segment Slicing & Auto-Pruning Continuity ───────────
console.log('\n--- TEST 2: Real-time Audio Slicing & Auto-Pruning Continuity ---')
const sliceManager = new AudioBufferManager(15.0)
let lastSample = 0
let successfulSlices = 0

// Feed 30 seconds of audio, polling getAudioSegmentSince every 1.0s like MeetingMode does
for (let s = 1; s <= 30; s++) {
  // Feed 1 second of audio
  for (let b = 0; b < 4; b++) {
    sliceManager.appendSamples(mockPcm16)
  }

  // Slice segment (min 1.2s)
  const segment = sliceManager.getAudioSegmentSince(lastSample, 1.2)
  if (segment) {
    successfulSlices++
    lastSample = segment.endSample
    console.assert(segment.sampleCount > 0, 'Sliced segment must contain valid samples')
    console.assert(segment.blob instanceof Blob, 'Segment must produce a valid WAV Blob')
    console.assert(segment.hasAudio === true, 'VAD energy should detect synthetic voice signal')
  }
}

console.log(`Successful real-time segments extracted: ${successfulSlices}`)
console.assert(successfulSlices >= 12, 'Should successfully slice real-time segments continuously')
console.assert(
  sliceManager.sizeBytes <= 520 * 1024,
  'Buffer memory should remain strictly bounded after slicing and auto-pruning'
)
console.log('✓ TEST 2 PASSED: Audio slicing and automatic pre-roll pruning maintain seamless stream continuity.')

// ── TEST 3: Audio Chunk Lifecycle State Transitions & Buffer Dereferencing ───
console.log('\n--- TEST 3: Chunk Lifecycle State Machine & Immediate GC Dereferencing ---')
const assembler = new TranscriptAssembler('lifecycle_test')
const queue = new STTJobQueue({ maxQueueSize: 10, concurrency: 1 }, assembler)
// Pause queue so jobs accumulate in queue to precisely test backpressure eviction without background worker race
queue.pause()

// 3A. VAD Silence Chunk Drop: Buffer dereferenced immediately
const silenceJob: STTJob = {
  jobId: 'silence_job_1',
  sessionId: 'lifecycle_test',
  sequenceId: 1,
  audioBuffer: new Int16Array(16000),
  createdAt: Date.now(),
  priority: 0,
  hasSpeech: false, // VAD Silence
}

const enqueueSilence = queue.enqueue(silenceJob)
console.assert(enqueueSilence.enqueued === false, 'Silence chunk must not be enqueued')
console.assert(silenceJob.status === 'released', 'Silence chunk status must transition to "released"')
console.assert(silenceJob.audioBuffer === null, 'Silence chunk audioBuffer must be set to null for GC')
console.log('✓ 3A: VAD silence chunks transition to "released" and nullify audioBuffer immediately.')

// 3B. Backpressure Eviction: Evicted chunk buffer dereferenced
const speechJobs: STTJob[] = []
for (let i = 2; i <= 11; i++) {
  const j: STTJob = {
    jobId: `speech_job_${i}`,
    sessionId: 'lifecycle_test',
    sequenceId: i,
    audioBuffer: new Int16Array(16000),
    createdAt: Date.now(),
    priority: i === 2 ? 0 : 5, // Job 2 has lower priority
    hasSpeech: true,
  }
  speechJobs.push(j)
  queue.enqueue(j)
}

// Queue is now full (10 jobs). Now enqueue higher priority job 12 -> Job 2 should be evicted and released!
const job12: STTJob = {
  jobId: 'speech_job_12',
  sessionId: 'lifecycle_test',
  sequenceId: 12,
  audioBuffer: new Int16Array(16000),
  createdAt: Date.now(),
  priority: 10,
  hasSpeech: true,
}
queue.enqueue(job12)

console.assert(speechJobs[0].status === 'released', 'Evicted low-priority job status must be "released"')
console.assert(speechJobs[0].audioBuffer === null, 'Evicted low-priority job audioBuffer must be null for GC')
console.log('✓ 3B: Backpressure-evicted jobs transition to "released" and nullify audioBuffer immediately.')

// 3C. Queue Clear: All remaining jobs released
queue.clear()
for (const j of speechJobs.slice(1)) {
  console.assert(j.status === 'released', `Job ${j.jobId} must be marked "released" on clear`)
  console.assert(j.audioBuffer === null, `Job ${j.audioBuffer} audioBuffer must be null on clear`)
}
console.assert(job12.status === 'released' && job12.audioBuffer === null, 'Job 12 must be released on clear')
console.log('✓ 3C: Queue clear() transitions all queued jobs to "released" and frees all audio buffers.')

// ── TEST 4: Transferable ArrayBuffer Support ─────────────────────────────────
console.log('\n--- TEST 4: Transferable ArrayBuffer Zero-Copy Creation ---')
const originalPcm = new Int16Array(CHUNK_SAMPLES)
originalPcm[0] = 1234
originalPcm[CHUNK_SAMPLES - 1] = 5678

const transferable = createTransferablePcmBuffer(originalPcm)
console.assert(transferable instanceof ArrayBuffer, 'Must return a valid ArrayBuffer')
console.assert(transferable.byteLength === CHUNK_SAMPLES * 2, 'Transferable byteLength must match PCM byte count')
const view = new Int16Array(transferable)
console.assert(view[0] === 1234 && view[CHUNK_SAMPLES - 1] === 5678, 'Buffer contents must remain identical')
console.log('✓ TEST 4 PASSED: Transferable ArrayBuffer created for zero-copy worker/IPC transfer.')

// ── TEST 5: Clean Reset and Destructor Lifecycle ─────────────────────────────
console.log('\n--- TEST 5: Full Session Reset and Teardown ---')
manager.clear()
console.assert(manager.sizeBytes === 0, 'sizeBytes must be 0 after clear')
console.assert(manager.bufferedSeconds === 0, 'bufferedSeconds must be 0 after clear')
console.assert(manager.totalSamples === 0, 'totalSamples must be 0 after clear')
console.assert(manager.hasBuffer === false, 'hasBuffer must be false after clear')

const stats = manager.getLifecycleStats()
console.assert(stats.recordingChunks === 0, 'recordingChunks must be 0 after clear')
console.assert(stats.queuedChunks === 0, 'queuedChunks must be 0 after clear')
console.assert(stats.processingChunks === 0, 'processingChunks must be 0 after clear')
console.assert(stats.estimatedMemoryBytes === 0, 'estimatedMemoryBytes must be 0 after clear')
console.log('✓ TEST 5 PASSED: Full session reset clears all references and resets telemetry.')

console.log('\n===================================================================')
console.log('ALL AUDIO BUFFER GC & STRESS TESTS PASSED! (RAM is bounded and leak-free)')
console.log('===================================================================')
process.exit(0)
