import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { CopilotTriggerController } from '../controllers/copilotTriggerController'
import { ChunkProducer } from '../controllers/chunkProducer'
import { transitionAudioState, type AudioState } from '../machines/audioStateMachine'
import { transitionCopilotState, type CopilotState } from '../machines/copilotStateMachine'
import { sttJobQueue } from '@/services/ai-model/stt'
import type { IntentDetectionResult } from '@/services/ai-model/intent/types'

describe('MeetingMode Required Race Condition Tests', () => {
  beforeEach(() => {
    sttJobQueue.clear()
  })

  it('Race Ca 1: Câu hỏi mới đến khi đang sinh -> Hủy đúng lượt cũ và KHÔNG rơi câu mới', async () => {
    const controller = new CopilotTriggerController('auto')
    const cancelOldStream = mock(() => {})
    const executeNewQuestion = mock(async () => {})

    const newQuestionExchange = {
      original: 'How do you handle distributed transactions and Saga pattern?',
      speaker: 'Interviewer',
      timestamp: '00:15',
      isQuestion: true,
      isAiScanned: false,
      sourceLineCount: 2,
    }

    const intent: IntentDetectionResult = {
      intent: 'QUESTION',
      isQuestion: true,
      rawText: newQuestionExchange.original,
      speaker: 'Interviewer',
      normalizedText: newQuestionExchange.original,
      confidence: 0.98,
      gateRequired: false,
      isAmbiguous: false,
      shouldTriggerCopilot: true,
      normalizedIntent: 'system_design_problem',
      questionText: newQuestionExchange.original,
      detectionTimestamp: Date.now(),
      triggerDecisionReason: 'test_trigger',
      isSplitFragment: false,
      mergedLineCount: 1,
      matchedPatterns: [],
    }

    // New question arrives while previous generation is active (isGenerating: true)
    const scheduled = controller.scheduleTrigger({
      exchange: newQuestionExchange,
      intent,
      closeReason: 'silence',
      isGenerating: true,
      cancelCurrentStream: cancelOldStream,
      onTrigger: executeNewQuestion,
    })

    expect(scheduled).toBe(true)

    // Wait for adaptive debounce timer to fire
    await new Promise((resolve) => setTimeout(resolve, 600))

    // Verified: Old stream cancelled, new question triggered without drop
    expect(cancelOldStream).toHaveBeenCalledTimes(1)
    expect(executeNewQuestion).toHaveBeenCalledTimes(1)
    expect(executeNewQuestion).toHaveBeenCalledWith(newQuestionExchange)
  })

  it('Race Ca 2: Dừng nghe khi chunk còn trong hàng đợi -> Flush dứt điểm không rơi từ cuối', () => {
    const producer = new ChunkProducer({
      sampleRate: 16000,
      silenceEndMs: 200,
      maxSegmentMs: 3000,
      vadThresholdRms: 0.01,
    })

    const context = {
      sessionId: 'session_race_2',
      mode: 'interview' as const,
      sourceType: 'mic' as const,
      sttLang: 'vi',
    }

    // Audio stream in progress
    const speechFrames = new Int16Array(8000).fill(3000)
    producer.feedPcmFrames(speechFrames, 8000, context)

    // Stopping event occurs: call flush immediately
    const flushed = producer.flush(context)

    expect(flushed).not.toBeNull()
    if (flushed) {
      expect(flushed.hasSpeech).toBe(true)
      expect(flushed.closeReason).toBe('flush')
    }
  })

  it('Race Ca 3: Đổi nguồn mic / loopback giữa chừng -> chuyển trạng thái an toàn và reset buffer', () => {
    let state: AudioState = 'listening'

    // 1. Initiate switch
    state = transitionAudioState(state, { type: 'SWITCH_SOURCE' })
    expect(state).toBe('switching')

    // 2. Producer is flushed and reset during switching
    const producer = new ChunkProducer()
    producer.reset()
    expect(producer.getLastProcessedSample()).toBe(0)

    // 3. Capture restarts on new device
    state = transitionAudioState(state, { type: 'SWITCH_COMPLETED' })
    expect(state).toBe('listening')
  })

  it('Race Ca 4: Bấm Tạo lại (regenerate) trong lúc đang stream -> ngắt stream cũ trước khi kích hoạt mới', () => {
    let copilotState = 'streaming' as CopilotState
    const cancelStream = mock(() => {
      copilotState = transitionCopilotState(copilotState, { type: 'INTERRUPT' })
    })

    // User triggers regenerate while in 'streaming' state
    cancelStream()
    expect(cancelStream).toHaveBeenCalledTimes(1)
    expect(copilotState as string).toBe('interrupted')

    // Now restart generation cleanly
    copilotState = transitionCopilotState(copilotState, { type: 'START_GENERATION' })
    expect(copilotState).toBe('generating')
  })

  it('Race Ca 5: Unmount khi timer đang chạy -> Hủy sạch timer không leak', async () => {
    const controller = new CopilotTriggerController('auto')
    const onTrigger = mock(() => {})

    controller.scheduleTrigger({
      exchange: {
        original: 'Question before unmount',
        speaker: 'Interviewer',
        timestamp: '00:01',
        isQuestion: true,
        isAiScanned: false,
        sourceLineCount: 1,
      },
      intent: {
        intent: 'QUESTION',
        isQuestion: true,
        rawText: 'Question before unmount',
        speaker: 'Interviewer',
        normalizedText: 'Question before unmount',
        confidence: 0.9,
        gateRequired: false,
        isAmbiguous: false,
        shouldTriggerCopilot: true,
        normalizedIntent: 'direct_question',
        questionText: 'Question before unmount',
        detectionTimestamp: Date.now(),
        triggerDecisionReason: 'test_trigger',
        isSplitFragment: false,
        mergedLineCount: 1,
        matchedPatterns: [],
      },
      isGenerating: false,
      cancelCurrentStream: mock(() => {}),
      onTrigger,
    })

    // Simulate unmount hook cleanup
    controller.cancelPending()

    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(onTrigger).not.toHaveBeenCalled()
  })
})
