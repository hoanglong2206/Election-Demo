import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { CopilotTriggerController } from '../copilotTriggerController'
import type { ScannedExchangeResult } from '@/services/ai-model/copilotResponseService'
import type { IntentDetectionResult } from '@/services/ai-model/copilot'

describe('CopilotTriggerController Controller', () => {
  let controller: CopilotTriggerController

  beforeEach(() => {
    controller = new CopilotTriggerController('auto')
  })

  const mockExchange: ScannedExchangeResult = {
    original: 'What is your architectural experience with Microservices?',
    speaker: 'Interviewer',
    timestamp: '00:15',
    isQuestion: true,
    isAiScanned: false,
    sourceLineCount: 1,
  }

  const mockIntent: IntentDetectionResult = {
    intent: 'QUESTION',
    isQuestion: true,
    normalizedText: 'What is your architectural experience with Microservices?',
    rawText: 'What is your architectural experience with Microservices?',
    speaker: 'Interviewer',
    confidence: 0.95,
    gateRequired: false,
    isAmbiguous: false,
    shouldTriggerCopilot: true,
    normalizedIntent: 'behavioral_question',
    questionText: 'What is your architectural experience with Microservices?',
    detectionTimestamp: Date.now(),
    triggerDecisionReason: 'test_trigger',
    isSplitFragment: false,
    mergedLineCount: 1,
    matchedPatterns: [],
  }

  it('rejects trigger in manual mode', () => {
    controller.setTriggerMode('manual')
    const cancelStream = mock(() => {})
    const onTrigger = mock(() => {})

    const scheduled = controller.scheduleTrigger({
      exchange: mockExchange,
      intent: mockIntent,
      isGenerating: false,
      cancelCurrentStream: cancelStream,
      onTrigger,
    })

    expect(scheduled).toBe(false)
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('suppresses small talk or non-triggering intents', () => {
    const nonTriggerIntent: IntentDetectionResult = {
      ...mockIntent,
      intent: 'SMALL_TALK',
      shouldTriggerCopilot: false,
      normalizedIntent: 'normal_conversation',
    }

    const scheduled = controller.scheduleTrigger({
      exchange: { ...mockExchange, original: 'Okay I see' },
      intent: nonTriggerIntent,
      isGenerating: false,
      cancelCurrentStream: mock(() => {}),
      onTrigger: mock(() => {}),
    })

    expect(scheduled).toBe(false)
  })

  it('suppresses duplicate signature when text has already been triggered', () => {
    controller.setLastSignature(mockExchange.original.trim())

    const scheduled = controller.scheduleTrigger({
      exchange: mockExchange,
      intent: mockIntent,
      isGenerating: false,
      cancelCurrentStream: mock(() => {}),
      onTrigger: mock(() => {}),
    })

    expect(scheduled).toBe(false)
  })

  it('schedules trigger and cancels old stream if previous generation is in-flight (Race Condition Handling)', async () => {
    const cancelStream = mock(() => {})
    const onTrigger = mock(async () => {})

    const scheduled = controller.scheduleTrigger({
      exchange: mockExchange,
      intent: mockIntent,
      closeReason: 'silence',
      isGenerating: true, // Generating in-flight
      cancelCurrentStream: cancelStream,
      onTrigger,
    })

    expect(scheduled).toBe(true)

    // Wait for debounce timer
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(cancelStream).toHaveBeenCalledTimes(1)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(controller.getLastSignature()).toBe(mockExchange.original.trim())
  })

  it('cancels pending trigger cleanly', async () => {
    const onTrigger = mock(() => {})

    controller.scheduleTrigger({
      exchange: mockExchange,
      intent: mockIntent,
      isGenerating: false,
      cancelCurrentStream: mock(() => {}),
      onTrigger,
    })

    controller.cancelPending()

    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(onTrigger).not.toHaveBeenCalled()
  })
})
