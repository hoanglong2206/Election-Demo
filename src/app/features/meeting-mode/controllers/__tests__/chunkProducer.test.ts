import { describe, it, expect, beforeEach } from 'bun:test'
import { ChunkProducer } from '../chunkProducer'
import { sttJobQueue } from '@/services/ai-model/stt'
import type { SpeechSegment } from '@/core/audio/types'

describe('ChunkProducer Controller', () => {
  let producer: ChunkProducer

  beforeEach(() => {
    producer = new ChunkProducer({
      sampleRate: 16000,
      silenceEndMs: 200,
      maxSegmentMs: 3000,
      vadThresholdRms: 0.01,
    })
    sttJobQueue.clear()
  })

  const mockContext = {
    sessionId: 'session_test_123',
    mode: 'interview' as const,
    sourceType: 'mic' as const,
    sttLang: 'vi',
  }

  const createFakeSegment = (durationMs = 1500, endSample = 24000): SpeechSegment => ({
    samples: new Int16Array(16000),
    blob: new Blob(['fake-audio'], { type: 'audio/wav' }),
    hasSpeech: true,
    continuation: false,
    durationMs,
    speechDurationMs: durationMs,
    startSample: 0,
    endSample,
    closeReason: 'silence',
    endOfSpeechTimestampMs: Date.now(),
  })

  it('initializes sequenceId at 1 and produces monotonic STT jobs', () => {
    expect(producer.getSequenceId()).toBe(1)

    const fakeSegment = createFakeSegment(1500, 24000)

    const job = producer.dispatchSegment(fakeSegment, mockContext)

    expect(job.sequenceId).toBe(1)
    expect(job.speakerLabel).toBe('You')
    expect(job.sessionId).toBe('session_test_123')
    expect(producer.getSequenceId()).toBe(2)
  })

  it('assigns Interviewer label when sourceType is system in interview mode', () => {
    const fakeSegment = createFakeSegment(1000, 16000)

    const job = producer.dispatchSegment(fakeSegment, {
      ...mockContext,
      sourceType: 'system',
    })

    expect(job.speakerLabel).toBe('Interviewer')
  })

  it('assigns Cuoc hop label when sourceType is system in discussion mode', () => {
    const fakeSegment = createFakeSegment(1000, 16000)

    const job = producer.dispatchSegment(fakeSegment, {
      ...mockContext,
      mode: 'discussion',
      sourceType: 'system',
    })

    expect(job.speakerLabel).toBe('Cuộc họp')
  })

  it('flushes pending speech segment when stopping so trailing words are not lost (Race Condition)', () => {
    // Generate active speech frames (1 second of speech > minSpeechMs)
    const speechFrames = new Int16Array(16000).fill(3000)
    producer.feedPcmFrames(speechFrames, 16000, mockContext)

    // Flush while still in speech
    const flushed = producer.flush(mockContext)

    expect(flushed).not.toBeNull()
    if (flushed) {
      expect(flushed.hasSpeech).toBe(true)
    }
  })

  it('resets sequence and context cleanly on resetAll', () => {
    producer.resetAll('new_session')
    expect(producer.getSequenceId()).toBe(1)
    expect(producer.getLastProcessedSample()).toBe(0)
  })
})
