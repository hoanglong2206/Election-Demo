import { describe, it, expect } from 'bun:test'
import { AudioBufferManager } from '../src/app/core/audio/AudioBufferManager'
import { TranscriptAssembler } from '../src/app/services/ai-model/stt/transcriptAssembler'
import { STTJobQueue } from '../src/app/services/ai-model/stt/sttJobQueue'
import type { STTJob, TranscribeResult } from '../src/app/services/ai-model/stt/types'
import { profileContextService } from '../src/app/services/profile-preset/profileContextService'
import { whisperPromptBuilder } from '../src/app/services/ai-model/stt/whisperPromptBuilder'
import { jdKeywordExtractor } from '../src/app/services/ai-model/stt/jdKeywordExtractor'
import { tieredContextManager } from '../src/app/services/ai-model/copilot/contextManager'
import { screenCaptureService } from '../src/app/services/screen-capture/screenCaptureService'

describe('Meeting Mode Functional & Stability Audit', () => {


  // ── 1. Profile Snapshot, JD Context & Whisper Initial Prompt ───────────────
  describe('Profile Snapshot & Whisper Initial Prompt', () => {
    it('initializes Meeting with active Profile Snapshot and correct context', () => {
      const snapshot = profileContextService.getActiveSnapshot()
      expect(snapshot).toBeDefined()
      expect(snapshot.presetId).toBeDefined()
      expect(typeof snapshot.name).toBe('string')
      expect(Array.isArray(snapshot.keywords)).toBe(true)

      const prompt = whisperPromptBuilder.buildPrompt(snapshot.keywords, {
        contextType: 'interview',
      })
      expect(typeof prompt).toBe('string')
      if (snapshot.keywords.length > 0) {
        expect(prompt.length).toBeGreaterThan(0)
      }
    })

    it('extracts technical keywords from JD when keywords array is empty', () => {
      const sampleJD = 'Tuyển Senior Fullstack Developer kinh nghiệm React, TypeScript, Docker, Kubernetes, Golang và PostgreSQL.'
      const extracted = jdKeywordExtractor.extractKeywords(sampleJD)
      expect(extracted).toContain('React')
      expect(extracted).toContain('TypeScript')
      expect(extracted).toContain('Docker')
      expect(extracted).toContain('Kubernetes')
      expect(extracted).toContain('Go')
      expect(extracted).toContain('PostgreSQL')

      const prompt = whisperPromptBuilder.buildPrompt(extracted, {
        contextType: 'interview',
      })
      expect(prompt).toContain('React')
      expect(prompt).toContain('Docker')
    })
  })

  // ── 2. AudioBufferManager & 60-120 Minute Long-Running Session Memory ───────
  describe('AudioBufferManager Bounded Ring Buffer & Long Session Stability', () => {
    it('maintains bounded capacity and auto-prunes sliding window (15s max / 480KB)', () => {
      const manager = new AudioBufferManager(15.0) // 15 seconds max
      const samplesPerChunk = 16000 // 1.0 second @ 16kHz
      const testChunk = new Int16Array(samplesPerChunk)
      for (let i = 0; i < samplesPerChunk; i++) {
        testChunk[i] = Math.sin((i / 16000) * 440 * 2 * Math.PI) * 10000
      }

      // Feed 30 seconds of audio into the 15-second buffer
      for (let sec = 0; sec < 30; sec++) {
        manager.appendSamples(testChunk)
      }

      expect(manager.totalSamples).toBe(30 * 16000)
      // Retained samples must be bounded to <= 15s (plus at most 1 buffer boundary)
      expect(manager.bufferedSeconds).toBeLessThanOrEqual(16.0)
      expect(manager.sizeBytes).toBeLessThanOrEqual(520 * 1024) // max ~500KB
      expect(manager.estimatedMemoryMb).toBeLessThan(1.0) // well under 1MB
    })

    it('simulates 120-minute meeting session without linear memory or activeChunks growth', () => {
      const manager = new AudioBufferManager(15.0)
      const samplesPerBlock = 2048 // standard AudioWorklet chunk
      const testBlock = new Int16Array(samplesPerBlock)
      for (let i = 0; i < samplesPerBlock; i++) {
        testBlock[i] = (i % 200) * 100
      }

      // Simulate 7,200 seconds (120 minutes) = 7200 * 16000 / 2048 = 56,250 blocks
      // We simulate 3,000 blocks to verify O(1) stability
      for (let b = 0; b < 3000; b++) {
        manager.appendSamples(testBlock)
      }

      const stats = manager.getLifecycleStats()
      // activeChunks map MUST be bounded (capped at 50 max)
      expect(stats.recordingChunks).toBeLessThanOrEqual(50)
      expect(stats.bufferedSeconds).toBeLessThanOrEqual(16.0)
      expect(stats.estimatedMemoryMb).toBeLessThan(1.0)
    })

    it('correctly calculates VAD energy for silence vs loud speech', () => {
      const manager = new AudioBufferManager(15.0)
      manager.setVadEnergyThreshold(0.008) // approx -42 dBFS

      // 1. Silence chunk (zeros or very low noise)
      const silence = new Int16Array(16000 * 2) // 2 seconds
      for (let i = 0; i < silence.length; i++) {
        silence[i] = Math.floor((Math.random() - 0.5) * 20) // near 0
      }
      manager.appendSamples(silence)

      const silenceSegment = manager.getAudioSegmentSince(0, 1.2)
      expect(silenceSegment).not.toBeNull()
      expect(silenceSegment!.hasAudio).toBe(false)

      // 2. Clear and append speech chunk (high amplitude 440Hz sine wave)
      manager.clear()
      const speech = new Int16Array(16000 * 2)
      for (let i = 0; i < speech.length; i++) {
        speech[i] = Math.sin((i / 16000) * 440 * 2 * Math.PI) * 15000
      }
      manager.appendSamples(speech)

      const speechSegment = manager.getAudioSegmentSince(0, 1.2)
      expect(speechSegment).not.toBeNull()
      expect(speechSegment!.hasAudio).toBe(true)
    })

    it('clears all buffers, totalSamples, and indices cleanly', () => {
      const manager = new AudioBufferManager(15.0)
      manager.appendSamples(new Int16Array(16000 * 5))
      expect(manager.totalSamples).toBe(80000)
      expect(manager.hasBuffer).toBe(true)

      manager.clear()
      expect(manager.totalSamples).toBe(0)
      expect(manager.bufferedSeconds).toBe(0)
      expect(manager.sizeBytes).toBe(0)
      expect(manager.hasBuffer).toBe(false)
      expect(manager.getLifecycleStats().recordingChunks).toBe(0)
    })
  })

  // ── 3. TranscriptAssembler Monotonic Ordering & Session Isolation ──────────
  describe('TranscriptAssembler Monotonic Ordering & Session Isolation', () => {
    it('commits results strictly in sequential order (1, 2, 3) even if workers complete out-of-order', () => {
      const assembler = new TranscriptAssembler('session_test_1')
      const committed: Array<{ seq: number; text: string }> = []
      assembler.onCommit((commit) => {
        committed.push({ seq: commit.sequenceId, text: commit.result.text })
      })

      const dummyJobMeta = (seq: number) => ({
        jobId: `job_${seq}`,
        sessionId: 'session_test_1',
        speakerLabel: 'Interviewer',
        timestampStr: '00:01',
        sourceType: 'mic' as const,
      })

      const makeResult = (text: string): TranscribeResult => ({
        success: true,
        text,
        translatedVi: text,
        latencyMs: 100,
        engineId: 'local',
        engineName: 'Local Whisper',
        provider: 'Local',
        confidence: 0.95,
      })

      // Worker 2 finishes FIRST (out of order!)
      assembler.receiveResult(2, makeResult('thứ hai'), dummyJobMeta(2))
      // No commits yet because sequence 1 is missing!
      expect(committed.length).toBe(0)

      // Worker 3 finishes SECOND
      assembler.receiveResult(3, makeResult('thứ ba'), dummyJobMeta(3))
      expect(committed.length).toBe(0)

      // Worker 1 finishes LAST
      assembler.receiveResult(1, makeResult('thứ nhất'), dummyJobMeta(1))

      // Now all 3 must be committed strictly in order: 1 -> 2 -> 3
      expect(committed.length).toBe(3)
      expect(committed[0].seq).toBe(1)
      expect(committed[0].text).toBe('thứ nhất')
      expect(committed[1].seq).toBe(2)
      expect(committed[1].text).toBe('thứ hai')
      expect(committed[2].seq).toBe(3)
      expect(committed[2].text).toBe('thứ ba')

      assembler.destroy()
    })

    it('isolates sessions and rejects delayed results from prior sessions', () => {
      const assembler = new TranscriptAssembler('session_old')
      const committed: string[] = []
      assembler.onCommit((c) => committed.push(c.result.text))

      // Session is reset to a new session
      assembler.setSessionId('session_new', 1)

      const makeResult = (text: string): TranscribeResult => ({
        success: true,
        text,
        translatedVi: text,
        latencyMs: 100,
        engineId: 'local',
        engineName: 'Local Whisper',
        provider: 'Local',
        confidence: 0.95,
      })

      // A delayed result from 'session_old' resolves now with sequence 1
      assembler.receiveResult(1, makeResult('old delayed sentence'), {
        jobId: 'job_old_1',
        sessionId: 'session_old',
        speakerLabel: 'Speaker',
        timestampStr: '00:01',
        sourceType: 'mic',
      })

      // Must be dropped! Not committed into session_new
      expect(committed.length).toBe(0)

      // Result from 'session_new' arrives
      assembler.receiveResult(1, makeResult('new session sentence'), {
        jobId: 'job_new_1',
        sessionId: 'session_new',
        speakerLabel: 'Speaker',
        timestampStr: '00:01',
        sourceType: 'mic',
      })

      expect(committed.length).toBe(1)
      expect(committed[0]).toBe('new session sentence')

      assembler.destroy()
    })

    it('advances expectedSequenceId when silence or backpressure chunks are skipped', () => {
      const assembler = new TranscriptAssembler('session_test_skip')
      const committed: number[] = []
      assembler.onCommit((c) => committed.push(c.sequenceId))

      const makeResult = (text: string): TranscribeResult => ({
        success: true,
        text,
        translatedVi: text,
        latencyMs: 50,
        engineId: 'local',
        engineName: 'Local Whisper',
        provider: 'Local',
        confidence: 0.9,
      })

      // Sequence 1 is silence, skipped
      assembler.skipSequence(1, 'session_test_skip')

      // Sequence 2 has speech and completes
      assembler.receiveResult(2, makeResult('Hello after silence'), {
        jobId: 'job_2',
        sessionId: 'session_test_skip',
        speakerLabel: 'Speaker',
        timestampStr: '00:02',
        sourceType: 'mic',
      })

      // Sequence 2 commits immediately without getting stuck waiting for sequence 1!
      expect(committed.length).toBe(1)
      expect(committed[0]).toBe(2)

      assembler.destroy()
    })
  })

  // ── 4. STT Job Queue Backpressure, VAD Dropping & Concurrency ──────────────
  describe('STTJobQueue Concurrency & Backpressure Controller', () => {
    it('drops silence chunks immediately at enqueue time and releases buffer', () => {
      const queue = new STTJobQueue({ maxQueueSize: 5, concurrency: 1 })
      const silenceJob: STTJob = {
        jobId: 'job_silence_1',
        sessionId: 'session_test_vad',
        sequenceId: 1,
        audioBuffer: new Blob([new Uint8Array(100)]),
        hasSpeech: false, // Silence chunk flagged by VAD
        createdAt: Date.now(),
        priority: 0,
        engineId: 'local',
        language: 'vi',
        sourceType: 'mic',
        speakerLabel: 'Speaker',
        timestampStr: '00:00',
      }

      const res = queue.enqueue(silenceJob)
      expect(res.enqueued).toBe(false)
      expect(res.reason).toBe('silence_vad')
      expect(silenceJob.status).toBe('released')
      expect(silenceJob.audioBuffer).toBeNull()
      expect(queue.getMetrics().droppedJobs).toBe(1)
      expect(queue.getMetrics().enqueuedJobs).toBe(0)
      expect(queue.getMetrics().succeededJobs).toBe(0)
      expect(queue.getMetrics().failedJobs).toBe(0)
      queue.clear()
    })

    it('enforces backpressure when queue capacity is reached', () => {
      const queue = new STTJobQueue({ maxQueueSize: 3, concurrency: 1 })
      queue.pause() // Pause so queue builds up

      for (let i = 1; i <= 3; i++) {
        const job: STTJob = {
          jobId: `job_${i}`,
          sessionId: 'session_bp',
          sequenceId: i,
          audioBuffer: new Blob([new Uint8Array(50)]),
          hasSpeech: true,
          createdAt: Date.now(),
          priority: 1,
          engineId: 'local',
          language: 'vi',
          sourceType: 'mic',
          speakerLabel: 'Speaker',
          timestampStr: '00:00',
        }
        const res = queue.enqueue(job)
        expect(res.enqueued).toBe(true)
      }

      expect(queue.getMetrics().enqueuedJobs).toBe(3)
      expect(queue.getMetrics().queueDepth).toBe(3)

      // 4th job exceeds maxQueueSize = 3
      const overflowJob: STTJob = {
        jobId: 'job_overflow',
        sessionId: 'session_bp',
        sequenceId: 4,
        audioBuffer: new Blob([new Uint8Array(50)]),
        hasSpeech: true,
        createdAt: Date.now(),
        priority: 1,
        engineId: 'local',
        language: 'vi',
        sourceType: 'mic',
        speakerLabel: 'Speaker',
        timestampStr: '00:00',
      }

      const overflowRes = queue.enqueue(overflowJob)
      expect(overflowRes.enqueued).toBe(false)
      expect(overflowRes.reason).toBe('backpressure_full')
      expect(overflowJob.status).toBe('released')
      expect(overflowJob.audioBuffer).toBeNull()

      queue.clear()
    })
  })

  // ── 5. Tiered Context Manager & Token Bound ─────────────────────────────────
  describe('TieredContextManager Multi-tier Token Budgeting', () => {
    it('strictly enforces totalMax token budget (4600 tokens) regardless of conversation length', () => {
      tieredContextManager.setSessionId('session_tiered_test')
      tieredContextManager.setPermanentContext({
        cvSummary: 'Software Engineer with 8 years of experience in distributed systems, Go, Kubernetes, and high-throughput Kafka pipelines.',
        jobDescription: 'Seeking Lead Backend Engineer to design scalable cloud-native architectures.',
        role: 'Lead Backend Engineer',
        companyName: 'Tech Corp',
      })

      // Generate 150 simulated conversation lines (~10,000 words)
      const fakeLines = []
      for (let i = 1; i <= 150; i++) {
        fakeLines.push({
          speaker: i % 2 === 0 ? 'Interviewer' : 'You',
          original: `This is utterance #${i} discussing distributed consensus, Raft protocol, split-brain mitigation, and quorum writes in detail.`,
          timestamp: `01:${String(i).padStart(2, '0')}`,
        })
      }
      tieredContextManager.setTranscriptLines(fakeLines)

      const usage = tieredContextManager.getUsageEstimate(
        'Can you explain how you handle network partitions during leader election?',
        'interview'
      )

      expect(usage.maxBudget).toBe(4600)
      expect(usage.totalTokens).toBeLessThanOrEqual(4600)
      expect(usage.usagePercent).toBeLessThanOrEqual(100)

      tieredContextManager.clearSessionMemory()
    })
  })

  // ── 6. Screen Capture Service Memory Safety ────────────────────────────────
  describe('ScreenCaptureService Memory Safety', () => {
    it('safely handles memory release of dataUrl or blob strings without throwing', () => {
      expect(() => {
        screenCaptureService.releaseMemory(undefined)
        screenCaptureService.releaseMemory('')
        screenCaptureService.releaseMemory('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...')
        screenCaptureService.cleanMemory({ dataUrl: 'data:image/jpeg;base64,...' })
      }).not.toThrow()
    })
  })

  // ── 7. Session History Persistence & Export Schema 2.0 Compliance ──────────
  describe('Meeting Session Persistence & History Integrity', () => {
    it('persists complete MeetingSession aggregate including transcripts, suggestions, screenshots, and metrics', async () => {
      const { saveSessionToHistory, getSavedSessions } = await import(
        '../src/app/services/sessionHistory'
      )

      const sessionId = `test_audit_session_${Date.now()}`
      const testSession = {
        id: sessionId,
        title: 'Phỏng vấn Kỹ thuật Frontend Senior',
        companyName: 'VNG',
        targetRole: 'Senior Frontend Engineer',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now(),
        durationMinutes: 60,
        durationSeconds: 3600,
        date: '20/10/2026, 10:00',
        mode: 'interview' as const,
        aiModel: 'GPT-4o (OpenAI)',
        audioSource: 'Default Microphone',
        contextApplied: true,
        candidateName: 'Ứng viên (Theo hồ sơ CV đã nạp)',
        transcripts: [
          {
            id: 1,
            speaker: 'Interviewer',
            timestamp: '00:15',
            original: 'Can you describe the Virtual DOM reconciliation algorithm in React?',
            translated: 'Bạn có thể mô tả thuật toán đối soát Virtual DOM trong React không?',
            isQuestion: true,
          },
          {
            id: 2,
            speaker: 'You',
            timestamp: '00:45',
            original: 'React uses a heuristic O(n) diffing algorithm comparing element types and keys.',
            translated: 'React dùng thuật toán so khớp suy nghiệm O(n) so sánh loại phần tử và key.',
            isQuestion: false,
          },
        ],
        suggestions: [
          {
            id: 101,
            type: 'answer' as const,
            label: 'Câu trả lời đề xuất',
            content: 'Nêu bật Fiber architecture, double buffering, và reconciliation heuristic O(n).',
            confidence: 0.95,
            timestamp: '00:20',
          },
        ],
        screenshotQuestions: [
          {
            id: 'vq_101',
            timestamp: '05:30',
            imageMetadata: {
              fileName: 'screenshot.png',
            },
            contentType: 'coding_question',
            analysisResult: {
              questionSummary: 'Two Sum LeetCode Problem with O(n) HashMap solution.',
              questionType: 'coding_question',
              suggestedAnswer: 'Use single-pass hash map to achieve O(n) time and O(n) space.',
            },
          },
        ],
        metrics: {
          totalInteractions: 4,
          questionCount: 2,
          aiResponseCount: 1,
          screenshotCount: 1,
          totalTokens: 1250,
          inputTokens: 1000,
          outputTokens: 250,
          estimatedCostUsd: 0.005,
          costStatus: 'calculated' as const,
        },
        exportSchemaVersion: '2.0',
      }

      saveSessionToHistory(testSession)

      const history = getSavedSessions()
      const found = history.find((s) => s.id === sessionId)
      expect(found).toBeDefined()
      expect(found!.title).toBe('Phỏng vấn Kỹ thuật Frontend Senior')
      expect(found!.transcripts.length).toBe(2)
      expect(found!.suggestions.length).toBe(1)
      expect(found!.screenshotQuestions?.length).toBe(1)
      expect(found!.metrics?.totalTokens).toBe(1250)
      expect(found!.exportSchemaVersion).toBe('2.0')
    })
  })
})
