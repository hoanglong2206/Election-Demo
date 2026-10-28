import { describe, it, expect } from 'bun:test'
import {
  detectIntent,
  isSmallTalkUtterance,
  isIncompleteSpeechFragment,
  detectIntentFromRecentLines,
} from '../../intent'
import {
  validateAnswerGrounding,
  checkMetricContradiction,
  checkDirectedRelationContradiction,
  type GroundingInput,
} from '../../grounding'
import { extractFactSheet, clearFactSheetCache } from '../../grounding/factSheet'

describe('Specification Parity Tests (Pre-Split Baseline)', () => {
  describe('QuestionDetector Specification', () => {
    it('detects direct English and Vietnamese technical questions', () => {
      const enRes = detectIntent('What is the difference between TCP and UDP in distributed systems?')
      expect(enRes.isQuestion).toBe(true)
      expect(enRes.confidence).toBeGreaterThan(0.7)

      const viRes = detectIntent('Bạn có thể giải thích cơ chế Garbage Collection trong V8 engine hoạt động như thế nào không?')
      expect(viRes.isQuestion).toBe(true)
      expect(viRes.confidence).toBeGreaterThan(0.7)
    })

    it('detects indirect/implicit questions in both languages', () => {
      const implicitEn = detectIntent('I wonder if you could walk me through how you handled data consistency across services.')
      expect(implicitEn.isQuestion).toBe(true)
      expect(implicitEn.confidence).toBeGreaterThan(0.5)

      const implicitVi = detectIntent('Mình muốn biết thêm về cách thức team bạn xử lý dead letter queue khi Kafka bị quá tải.')
      expect(implicitVi.isQuestion).toBe(true)
      expect(implicitVi.confidence).toBeGreaterThan(0.5)
    })

    it('classifies small talk accurately without triggering technical copilot', () => {
      expect(isSmallTalkUtterance('Good morning')).toBe(true)
      expect(isSmallTalkUtterance('Xin chào')).toBe(true)
      expect(isSmallTalkUtterance('Thank you')).toBe(true)
      expect(isSmallTalkUtterance('Cảm ơn anh chị')).toBe(true)

      const res = detectIntent('Hello everyone, nice to meet you.')
      expect(res.intent === 'SMALL_TALK' || !res.shouldTriggerCopilot).toBe(true)
    })

    it('rejects incomplete speech fragments', () => {
      expect(isIncompleteSpeechFragment('and then we')).toBe(true)
      expect(isIncompleteSpeechFragment('bởi vì khi mà')).toBe(true)
      expect(isIncompleteSpeechFragment('thì lúc đó')).toBe(true)
      expect(isIncompleteSpeechFragment('chỉ là...')).toBe(true)

      const fragRes = detectIntent('và sau đó thì...')
      expect(fragRes.isQuestion).toBe(false)
    })

    it('detects questions from recent dialogue lines', () => {
      const lines = [
        { id: 1, speaker: 'Interviewer', original: 'Chào em, hôm nay chúng ta sẽ trao đổi về dự án gần nhất của em nhé.' },
        { id: 2, speaker: 'Candidate', original: 'Vâng ạ, em chào anh.' },
        { id: 3, speaker: 'Interviewer', original: 'Em hãy chia sẻ về kiến trúc hệ thống thanh toán em đã xây dựng?' },
      ]
      const detected = detectIntentFromRecentLines(lines, { mode: 'interview' })
      expect(detected).not.toBeNull()
      expect(detected?.isQuestion).toBe(true)
    })
  })

  describe('AnswerGrounding Specification', () => {
    const sampleCv = `
      Kinh nghiệm:
      - Senior Backend Engineer tại TechCorp (2021 - 2024).
      - Thiết kế hệ thống thanh toán xử lý 50000 rps sử dụng Golang, Redis và PostgreSQL.
      - Di chuyển kiến trúc message queue từ RabbitMQ sang Kafka để giảm độ trễ 40%.
      - Tối ưu hóa database connection pool giúp giảm p99 latency từ 250ms xuống 45ms.
    `

    it('correctly classifies SUPPORTED claims against evidence index', () => {
      clearFactSheetCache()
      const input: GroundingInput = {
        cv: sampleCv,
        answer: 'Tại TechCorp, tôi đã từng thiết kế hệ thống thanh toán bằng Golang và PostgreSQL.',
        mode: 'strict',
      }
      const res = validateAnswerGrounding(input)
      expect(res.overallRisk).toBe('low')
      expect(res.claims.some((c) => c.classification === 'SUPPORTED')).toBe(true)
    })

    it('detects metric contradiction (number mismatch)', () => {
      clearFactSheetCache()
      const factSheet = extractFactSheet(sampleCv)
      const metricCheck = checkMetricContradiction('Hệ thống của tôi xử lý 500.000 RPS', factSheet)
      expect(metricCheck.hasContradiction || metricCheck.isUngrounded).toBe(true)

      const input: GroundingInput = {
        cv: sampleCv,
        answer: 'Tôi đã trực tiếp thiết kế hệ thống thanh toán chịu tải 500000 rps.',
        mode: 'strict',
      }
      const res = validateAnswerGrounding(input)
      expect(res.overallRisk).toBe('high')
      expect(res.hasDiscrepancies).toBe(true)
    })

    it('detects inverted relational direction (RabbitMQ -> Kafka vs Kafka -> RabbitMQ)', () => {
      clearFactSheetCache()
      const factSheet = extractFactSheet(sampleCv)
      const invertedCheck = checkDirectedRelationContradiction(
        'Tôi đã chuyển đổi message broker từ Kafka sang RabbitMQ',
        factSheet
      )
      expect(invertedCheck.hasContradiction).toBe(true)
    })

    it('evaluates non-pronoun action claims without personal pronouns', () => {
      clearFactSheetCache()
      const input: GroundingInput = {
        cv: sampleCv,
        answer: 'Tối ưu hóa database connection pool giúp giảm p99 latency từ 250ms xuống 45ms.',
        mode: 'strict',
      }
      const res = validateAnswerGrounding(input)
      expect(res.claims[0].classification).toBe('SUPPORTED')
      expect(res.overallRisk).toBe('low')
    })

    it('marks UNSUPPORTED when claiming unmentioned tech stack', () => {
      clearFactSheetCache()
      const input: GroundingInput = {
        cv: sampleCv,
        answer: 'Tôi có 3 năm kinh nghiệm lập trình Rust và xây dựng blockchain trên Solana.',
        mode: 'strict',
      }
      const res = validateAnswerGrounding(input)
      expect(res.overallRisk).toBe('high')
      expect(res.claims.some((c) => c.classification === 'UNSUPPORTED')).toBe(true)
    })
  })
})
