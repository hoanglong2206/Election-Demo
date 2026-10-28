import { describe, it, expect } from 'bun:test'
import { transitionAudioState, canTransitionAudio, type AudioState } from '../audioStateMachine'
import { transitionCopilotState, canTransitionCopilot, type CopilotState } from '../copilotStateMachine'
import { transitionCaptureState, canTransitionCapture, type CaptureState } from '../captureStateMachine'

describe('Meeting Mode State Machines', () => {
  describe('AudioStateMachine', () => {
    it('follows valid lifecycle: idle -> starting -> listening -> switching -> listening -> stopping -> idle', () => {
      let state: AudioState = 'idle'

      state = transitionAudioState(state, { type: 'START' })
      expect(state).toBe('starting')

      state = transitionAudioState(state, { type: 'CAPTURE_READY' })
      expect(state).toBe('listening')

      state = transitionAudioState(state, { type: 'SWITCH_SOURCE' })
      expect(state).toBe('switching')

      state = transitionAudioState(state, { type: 'SWITCH_COMPLETED' })
      expect(state).toBe('listening')

      state = transitionAudioState(state, { type: 'STOP' })
      expect(state).toBe('stopping')

      state = transitionAudioState(state, { type: 'STOPPED' })
      expect(state).toBe('idle')
    })

    it('blocks invalid transitions (e.g. idle -> listening directly)', () => {
      expect(canTransitionAudio('idle', 'listening')).toBe(false)
      const state = transitionAudioState('idle', { type: 'CAPTURE_READY' })
      expect(state).toBe('idle')
    })
  })

  describe('CopilotStateMachine', () => {
    it('follows valid streaming flow: idle -> detecting -> generating -> streaming -> done', () => {
      let state: CopilotState = 'idle'

      state = transitionCopilotState(state, { type: 'DETECT_QUESTION' })
      expect(state).toBe('detecting')

      state = transitionCopilotState(state, { type: 'START_GENERATION' })
      expect(state).toBe('generating')

      state = transitionCopilotState(state, { type: 'FIRST_TOKEN' })
      expect(state).toBe('streaming')

      state = transitionCopilotState(state, { type: 'FINISH_STREAM' })
      expect(state).toBe('done')
    })

    it('transitions to interrupted on new question arriving during generation/streaming', () => {
      let state: CopilotState = 'streaming'
      expect(canTransitionCopilot(state, 'interrupted')).toBe(true)
      state = transitionCopilotState(state, { type: 'INTERRUPT' })
      expect(state).toBe('interrupted')

      // can immediately restart generation for new question
      state = transitionCopilotState(state, { type: 'START_GENERATION' })
      expect(state).toBe('generating')
    })
  })

  describe('CaptureStateMachine', () => {
    it('follows flow: idle -> picking -> capturing -> cropping -> processing -> done -> idle', () => {
      let state: CaptureState = 'idle'
      expect(canTransitionCapture(state, 'picking')).toBe(true)

      state = transitionCaptureState(state, { type: 'OPEN_PICKER' })
      expect(state).toBe('picking')

      state = transitionCaptureState(state, { type: 'START_CAPTURE' })
      expect(state).toBe('capturing')

      state = transitionCaptureState(state, { type: 'CAPTURE_SUCCESS' })
      expect(state).toBe('cropping')

      state = transitionCaptureState(state, { type: 'CONFIRM_CROP' })
      expect(state).toBe('processing')

      state = transitionCaptureState(state, { type: 'ANALYSIS_COMPLETE' })
      expect(state).toBe('done')

      state = transitionCaptureState(state, { type: 'RESET' })
      expect(state).toBe('idle')
    })

    it('handles retake transition back to capturing', () => {
      let state: CaptureState = 'cropping'
      state = transitionCaptureState(state, { type: 'RETAKE' })
      expect(state).toBe('capturing')
    })

    it('handles picker cancellation cleanly (Bug 1 fix): idle -> picking -> CANCEL -> idle', () => {
      let state: CaptureState = 'idle'
      state = transitionCaptureState(state, { type: 'OPEN_PICKER' })
      expect(state).toBe('picking')
      state = transitionCaptureState(state, { type: 'CANCEL' })
      expect(state).toBe('idle')
    })
  })
})
