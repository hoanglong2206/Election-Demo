import { describe, expect, it, beforeEach } from 'bun:test'
import {
  multiTurnIntentTracker,
  MAX_INHERITANCE_TURNS,
} from '../multiTurnTracker'
import { detectIntentFromRecentLines } from '../detectFromLines'
import { detectIntent } from '../detector'
import { selectAnswerStrategy, strategies } from '../../strategy/answerStrategyRouter'

describe('Multi-Turn Conversational Intent Tracking (Plan 3)', () => {
  beforeEach(() => {
    multiTurnIntentTracker.reset()
  })

  describe('MultiTurnIntentTracker state machine', () => {
    it('anchors on explicit system design question and carries over to follow-ups', () => {
      // Turn 1: Explicit System Design question
      const turn1 = detectIntent('Hãy thiết kế hệ thống chat phân tán phục vụ 10 triệu người dùng đồng thời.')
      const processed1 = multiTurnIntentTracker.recordTurn(turn1, 'Interviewer')

      expect(processed1.activeDomain).toBe('system_design')
      expect(processed1.isContextInherited).toBe(false)
      expect(multiTurnIntentTracker.getState().activeDomain).toBe('system_design')

      // Turn 2: Candidate responds (no new anchor)
      const turn2 = detectIntent('Em sẽ dùng WebSocket cluster kết nối qua Redis Pub/Sub.')
      multiTurnIntentTracker.recordTurn(turn2, 'Candidate')

      // Turn 3: Interviewer follow-up with pronoun / connective
      const turn3 = detectIntent('Thế còn độ trễ và vấn đề cache invalidation thì xử lý thế nào?')
      const processed3 = multiTurnIntentTracker.recordTurn(turn3, 'Interviewer')

      expect(processed3.isContextInherited).toBe(true)
      expect(processed3.parentIntent).toBe('system_design_problem')
      expect(processed3.activeDomain).toBe('system_design')
      expect(processed3.topic).toBe('system_design')
      expect(processed3.inheritedFromTurn).toBeGreaterThan(0)
    })

    it('anchors on coding problem and carries over to short complexity follow-ups', () => {
      // Turn 1: Explicit Coding question
      const turn1 = detectIntent('Hãy viết một thuật toán để tìm longest palindromic substring.')
      const processed1 = multiTurnIntentTracker.recordTurn(turn1, 'Interviewer')

      expect(processed1.activeDomain).toBe('coding')
      expect(processed1.isContextInherited).toBe(false)

      // Turn 2: Interviewer short follow-up asking for complexity / edge cases
      const turn2 = detectIntent('Còn cách nào tối ưu thời gian chạy về O(N) không?')
      const processed2 = multiTurnIntentTracker.recordTurn(turn2, 'Interviewer')

      expect(processed2.isContextInherited).toBe(true)
      expect(processed2.parentIntent).toBe('coding_problem')
      expect(processed2.activeDomain).toBe('coding')
    })

    it('anchors on STAR behavioral prompt and carries over to follow-up questions', () => {
      // Turn 1: Behavioral STAR question
      const turn1 = detectIntent('Hãy kể về một lần bạn xảy ra bất đồng ý kiến kỹ thuật gay gắt với Tech Lead.')
      const processed1 = multiTurnIntentTracker.recordTurn(turn1, 'Interviewer')

      expect(processed1.activeDomain).toBe('behavioral')
      expect(processed1.isContextInherited).toBe(false)

      // Turn 2: Follow-up question without direct STAR keywords
      const turn2 = detectIntent('Lúc đó bạn cảm thấy thế nào và bài học rút ra là gì?')
      const processed2 = multiTurnIntentTracker.recordTurn(turn2, 'Interviewer')

      expect(processed2.isContextInherited).toBe(true)
      expect(processed2.parentIntent).toBe('behavioral_question')
      expect(processed2.activeDomain).toBe('behavioral')
    })

    it('switches domain immediately when an explicit new domain anchor appears', () => {
      // Turn 1: System Design
      const turn1 = detectIntent('Hãy thiết kế hệ thống phân tán với Kafka.')
      multiTurnIntentTracker.recordTurn(turn1)
      expect(multiTurnIntentTracker.getState().activeDomain).toBe('system_design')

      // Turn 2: Explicit switch to Coding
      const turn2 = detectIntent('Bây giờ chúng ta chuyển sang phần coding: Hãy viết hàm đảo ngược một linked list.')
      const processed2 = multiTurnIntentTracker.recordTurn(turn2)

      expect(processed2.activeDomain).toBe('coding')
      expect(processed2.isContextInherited).toBe(false)
      expect(multiTurnIntentTracker.getState().activeDomain).toBe('coding')
    })

    it('resets domain context when topic shift cue is spoken', () => {
      const turn1 = detectIntent('Hãy thiết kế hệ thống sharding database.')
      multiTurnIntentTracker.recordTurn(turn1)
      expect(multiTurnIntentTracker.getState().activeDomain).toBe('system_design')

      const turn2 = detectIntent("Let's move to the next topic now.")
      multiTurnIntentTracker.recordTurn(turn2)

      expect(multiTurnIntentTracker.getState().activeDomain).toBeUndefined()
    })

    it('decays domain context after MAX_INHERITANCE_TURNS non-domain turns', () => {
      const turn1 = detectIntent('Hãy giải bài toán LeetCode tìm median của 2 sorted arrays.')
      multiTurnIntentTracker.recordTurn(turn1)
      expect(multiTurnIntentTracker.getState().activeDomain).toBe('coding')

      // 4 unrelated conversational turns
      for (let i = 0; i < MAX_INHERITANCE_TURNS; i++) {
        multiTurnIntentTracker.recordTurn(detectIntent(`Trò chuyện thông thường lần thứ ${i + 1}`))
      }

      expect(multiTurnIntentTracker.getState().activeDomain).toBeUndefined()
    })
  })

  describe('detectIntentFromRecentLines history resolution', () => {
    it('inherits system design domain from prior interviewer line in transcript slice', () => {
      const lines = [
        { id: 1, speaker: 'Người phỏng vấn', original: 'Hãy giải thích cách thiết kế hệ thống phân tán chịu tải cao với Kafka và Redis.' },
        { id: 2, speaker: 'Ứng viên', original: 'Em sẽ sử dụng Kafka làm message queue để buffer request và Redis để cache kết quả.' },
        { id: 3, speaker: 'Người phỏng vấn', original: 'Thế còn vấn đề thundering herd và cache stampede thì giải quyết thế nào?' },
      ]

      const result = detectIntentFromRecentLines(lines, { mode: 'interview' })
      expect(result).not.toBeNull()
      expect(result?.isContextInherited).toBe(true)
      expect(result?.parentIntent).toBe('system_design_problem')
      expect(result?.activeDomain).toBe('system_design')
    })

    it('inherits coding domain for short pronoun follow-up question', () => {
      const lines = [
        { id: 1, speaker: 'Interviewer', original: 'Given an array of integers, find two numbers that sum up to target using an optimal algorithm.' },
        { id: 2, speaker: 'Candidate', original: 'We can use a hash map to achieve O(N) time complexity.' },
        { id: 3, speaker: 'Interviewer', original: 'What about edge cases with duplicates or empty arrays?' },
      ]

      const result = detectIntentFromRecentLines(lines, { mode: 'interview' })
      expect(result).not.toBeNull()
      expect(result?.isContextInherited).toBe(true)
      expect(result?.parentIntent).toBe('coding_problem')
      expect(result?.activeDomain).toBe('coding')
    })
  })

  describe('AnswerStrategyRouter multi-turn integration', () => {
    it('selects system_design strategy for follow-up question with inherited context', () => {
      const inheritedIntent = {
        ...detectIntent('Thế còn độ trễ thì xử lý thế nào?'),
        normalizedIntent: 'follow_up_question' as const,
        parentIntent: 'system_design_problem' as const,
        activeDomain: 'system_design' as const,
        isContextInherited: true,
      }

      const selection = selectAnswerStrategy({
        question: 'Thế còn độ trễ thì xử lý thế nào?',
        intent: inheritedIntent,
      })

      expect(selection.strategyId).toBe('system_design')
      expect(selection.reasoningTags).toContain('system_design')
      expect(selection.reasoningTags).toContain('inherited_context')
      expect(selection.reasoningTags).toContain('parentIntent:system_design_problem')

      // Verify specialized prompt build contains follow-up guidance
      const strategy = strategies.find((s) => s.id === 'system_design')
      const prompt = strategy?.buildPrompt({
        question: 'Thế còn độ trễ thì xử lý thế nào?',
        intent: inheritedIntent,
      })
      expect(prompt).toContain('Duy trì kiến trúc tổng thể đã đưa ra trước đó')
    })

    it('selects coding strategy for follow-up question with inherited coding context', () => {
      const inheritedIntent = {
        ...detectIntent('Có cách nào tối ưu hơn không?'),
        normalizedIntent: 'follow_up_question' as const,
        parentIntent: 'coding_problem' as const,
        activeDomain: 'coding' as const,
        isContextInherited: true,
      }

      const selection = selectAnswerStrategy({
        question: 'Có cách nào tối ưu hơn không?',
        intent: inheritedIntent,
      })

      expect(selection.strategyId).toBe('coding')
      expect(selection.reasoningTags).toContain('coding')
      expect(selection.reasoningTags).toContain('inherited_context')

      const strategy = strategies.find((s) => s.id === 'coding')
      const prompt = strategy?.buildPrompt({
        question: 'Có cách nào tối ưu hơn không?',
        intent: inheritedIntent,
      })
      expect(prompt).toContain('Duy trì thuật toán đã chọn')
    })

    it('selects behavioral strategy for follow-up question with inherited STAR context', () => {
      const inheritedIntent = {
        ...detectIntent('Thế kết quả cuối cùng ra sao?'),
        normalizedIntent: 'follow_up_question' as const,
        parentIntent: 'behavioral_question' as const,
        activeDomain: 'behavioral' as const,
        isContextInherited: true,
      }

      const selection = selectAnswerStrategy({
        question: 'Thế kết quả cuối cùng ra sao?',
        intent: inheritedIntent,
      })

      expect(selection.strategyId).toBe('behavioral')
      expect(selection.reasoningTags).toContain('behavioral')
      expect(selection.reasoningTags).toContain('inherited_context')

      const strategy = strategies.find((s) => s.id === 'behavioral')
      const prompt = strategy?.buildPrompt({
        question: 'Thế kết quả cuối cùng ra sao?',
        intent: inheritedIntent,
      })
      expect(prompt).toContain('Tiếp tục câu chuyện STAR đã thảo luận')
    })
  })
})
