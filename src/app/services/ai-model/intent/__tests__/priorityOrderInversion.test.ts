import { describe, expect, it } from 'bun:test'
import { detectIntent } from '../detector'
import { detectNormalizedIntent, detectIntentModality } from '../heuristic'
import { selectAnswerStrategy } from '../../strategy/answerStrategyRouter'

describe('Plan 2: Priority Order Inversion - Intent Hierarchy Tests', () => {
  describe('Domain-First Hierarchy for System Design Questions', () => {
    it('classifies System Design question with challenge connective ("nhưng") as system_design_problem', () => {
      const text = 'Chúng tôi dùng microservices nhưng gặp nghẽn database ở 100k TPS, làm sao scale?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('system_design_problem')
      expect(res.isChallenge).toBe(true)
      expect(res.isQuestion).toBe(true)
      expect(res.topic).toBe('system_design')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('system_design')
    })

    it('classifies System Design question with English challenge connective ("but") as system_design_problem', () => {
      const text = 'We use Kafka for event streaming, but brokers crash under peak load. How would you design failover?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('system_design_problem')
      expect(res.isChallenge).toBe(true)
      expect(res.isQuestion).toBe(true)
      expect(res.topic).toBe('system_design')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('system_design')
    })

    it('classifies System Design question with follow-up words ("thế còn", "what if") as system_design_problem', () => {
      const text = 'Thế còn caching với Redis thì giải quyết cache stampede và invalidation thế nào?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('system_design_problem')
      expect(res.isFollowUp).toBe(true)
      expect(res.topic).toBe('system_design')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('system_design')
    })

    it('classifies System Design question with clarification request ("could you clarify") as system_design_problem', () => {
      const text = 'Could you clarify how your load balancer distributes traffic across multiple availability zones?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('system_design_problem')
      expect(res.isClarification).toBe(true)

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('system_design')
    })
  })

  describe('Domain-First Hierarchy for Coding & Algorithm Questions', () => {
    it('classifies Coding question with follow-up words ("thế còn") as coding_problem', () => {
      const text = 'Thế còn thuật toán Dijkstra thì độ phức tạp thời gian và bộ nhớ ra sao?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('coding_problem')
      expect(res.isFollowUp).toBe(true)
      expect(res.topic).toBe('coding')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('coding')
    })

    it('classifies Coding question with challenge connective ("nhưng") as coding_problem', () => {
      const text = 'Cách giải bằng hash map này chạy nhanh nhưng tốn bộ nhớ O(N), có thuật toán nào O(1) space không?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('coding_problem')
      expect(res.isChallenge).toBe(true)
      expect(res.topic).toBe('coding')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('coding')
    })

    it('classifies LeetCode binary search variation as coding_problem', () => {
      const text = 'What if the array is rotated at an unknown pivot, how would binary search adapt?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('coding_problem')
      expect(res.isFollowUp).toBe(true)
      expect(res.topic).toBe('coding')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('coding')
    })
  })

  describe('Behavioral / STAR Question Priority', () => {
    it('classifies explicit STAR prompt with challenge words as behavioral_question', () => {
      const text = 'Tell me about a time you faced a difficult conflict with your tech lead, but resolved it successfully?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('behavioral_question')
      expect(res.isChallenge).toBe(true)
      expect(res.topic).toBe('behavioral')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('behavioral')
    })

    it('classifies Vietnamese STAR prompt as behavioral_question', () => {
      const text = 'Hãy kể về một lần em phải xử lý xung đột trong nhóm khi bất đồng quan điểm công nghệ?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('behavioral_question')
      expect(res.topic).toBe('behavioral')

      const strategy = selectAnswerStrategy({ question: text, intent: res })
      expect(strategy.strategyId).toBe('behavioral')
    })
  })

  describe('Pure Modality Questions (Without Specific Technical Domain)', () => {
    it('classifies pure challenge/objection without domain terms as challenge_or_objection', () => {
      const text = 'Nhưng tại sao em lại tự tin giải pháp đó là lựa chọn tối ưu hơn cách truyền thống?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('challenge_or_objection')
      expect(res.isChallenge).toBe(true)
    })

    it('classifies pure follow-up question without domain terms as follow_up_question', () => {
      const text = 'Thế còn về chi phí vận hành và nhân sự triển khai thì sao?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('follow_up_question')
      expect(res.isFollowUp).toBe(true)
    })

    it('classifies pure clarification request without domain terms as clarification_request', () => {
      const text = 'Ý bạn là gì khi nói phương án đó chưa đủ tin cậy?'
      const res = detectIntent(text, { mode: 'interview', speaker: 'Interviewer' })

      expect(res.normalizedIntent).toBe('clarification_request')
      expect(res.isClarification).toBe(true)
    })
  })

  describe('Utility Helper Functions', () => {
    it('detectIntentModality correctly detects all boolean modality flags simultaneously', () => {
      const text = 'What if we also disagree, could you clarify?'
      const modality = detectIntentModality(text)

      expect(modality.isFollowUp).toBe(true) // "what if" / "also"
      expect(modality.isChallenge).toBe(true) // "disagree"
      expect(modality.isClarification).toBe(true) // "could you clarify"
    })

    it('detectNormalizedIntent falls back to normal_conversation on small talk', () => {
      expect(detectNormalizedIntent('Xin chào bạn, chúc một ngày tốt lành', 'SMALL_TALK')).toBe('normal_conversation')
      expect(detectNormalizedIntent('Good morning everyone, nice to meet you', 'SMALL_TALK')).toBe('normal_conversation')
    })
  })
})
