/**
 * Enhanced Answer Grounding Unit Test Suite & Benchmark Evaluation
 * Validates fixes for 7 identified bugs in legacy regex/bag-of-words pipeline.
 * Tests Tier 0 FactSheet, Tier 1 Deterministic Engine, Tier 2 LLM Judge, and Streaming Mode.
 * Evaluates Precision, Recall, and False Positive Rate across Golden Dataset (>= 60 pairs).
 */

import { describe, expect, it } from 'bun:test'
import {
  validateAnswerGrounding,
  validateAnswerGroundingAsync,
  createStreamingGrounder,
  classifyClaimType,
  splitSentences,
  tokens,
  checkNegationContradiction,
  checkDirectedRelationContradiction,
  PERSONAL_PATTERN,
  METRIC_PATTERN,
} from '../answerGrounding'
import { extractFactSheet, clearFactSheetCache } from '../factSheet'
import { GOLDEN_GROUNDING_DATASET } from './goldenGroundingDataset'

describe('Answer Grounding 7 Target Bug Fixes', () => {
  // ─── BUG 1: VIETNAMESE ACCENTED WORD BOUNDARY ─────────────────────────────
  it('Bug 1: Lookaround with \\p{L} correctly matches accented Vietnamese words without word boundary corruption', () => {
    const viPersonalPhrases = [
      'Tại công ty VNG, tôi đã quản lý đội ngũ 6 người.',
      'Em đã tối ưu hóa hiệu năng hệ thống.',
      'Chị đã chủ trì kiến trúc vi dịch vụ.',
      'Chúng tôi đã xây dựng hệ thống thanh toán.',
      'Kinh nghiệm của tôi bao gồm 4 năm với React.',
    ]

    for (const phrase of viPersonalPhrases) {
      expect(PERSONAL_PATTERN.test(phrase)).toBe(true)
    }

    // High priority metric pattern should match 'triệu' and 'đội' without double million
    expect(METRIC_PATTERN.test('10 triệu người dùng')).toBe(true)
    expect(METRIC_PATTERN.test('6 kỹ sư')).toBe(true)
    expect(METRIC_PATTERN.test('4 năm')).toBe(true)
  })

  // ─── BUG 2: SHORT TOKENS & METRIC PRESERVATION ────────────────────────────
  it('Bug 2: tokens() retains short numbers (5, 12) and short tech terms (go, c#, ai, ml, js)', () => {
    const text = 'Led 12 engineers using Go and C# to build an AI platform in 5 months'
    const tokenList = tokens(text)

    expect(tokenList).toContain('12')
    expect(tokenList).toContain('5')
    expect(tokenList).toContain('go')
    expect(tokenList).toContain('c#')
    expect(tokenList).toContain('ai')

    // "led 12 engineers" vs "led 5 engineers" must NOT be SUPPORTED
    clearFactSheetCache()
    const result = validateAnswerGrounding({
      answer: 'I led a team of 12 engineers at Acme.',
      cv: 'At Acme, I led a team of 5 engineers.',
      mode: 'strict',
    })

    expect(result.claims[0]?.classification).toBe('CONTRADICTED')
    expect(result.claims[0]?.reason).toContain('Sai lệch số liệu')
  })

  // ─── BUG 3: DIRECTED RELATIONS & CAUSALITY ────────────────────────────────
  it('Bug 3: Inverted migration direction (Kafka -> RabbitMQ vs RabbitMQ -> Kafka) is caught as CONTRADICTED', () => {
    clearFactSheetCache()
    const cv = 'Migrated our messaging infrastructure from RabbitMQ to Kafka for horizontal scale.'
    const factSheet = extractFactSheet(cv)

    expect(factSheet.directedRelations.length).toBeGreaterThan(0)
    expect(factSheet.directedRelations[0]?.from).toBe('rabbitmq')
    expect(factSheet.directedRelations[0]?.to).toBe('kafka')

    const invertedClaim = 'I migrated our message broker from Kafka to RabbitMQ.'
    const contradiction = checkDirectedRelationContradiction(invertedClaim, factSheet)
    expect(contradiction.hasContradiction).toBe(true)
    expect(contradiction.reason).toContain('Đảo ngược quan hệ')

    const result = validateAnswerGrounding({
      answer: invertedClaim,
      cv,
      mode: 'balanced',
    })
    expect(result.claims[0]?.classification).toBe('CONTRADICTED')
  })

  // ─── BUG 4: NEGATION BOUNDARY & EXPLICIT PRIORITY ─────────────────────────
  it('Bug 4: Word "notification" does not falsely trigger negation, and explicit match is prioritized', () => {
    const cv = 'Built the notification service using Redis and WebSockets for real-time alerts.'
    const claim = 'I built the notification service using Redis and WebSockets.'

    // Check negation alone
    const negation = checkNegationContradiction(claim, cv)
    expect(negation.hasContradiction).toBe(false)

    // Full grounding validation
    const result = validateAnswerGrounding({
      answer: claim,
      cv,
      mode: 'strict',
    })
    expect(result.claims[0]?.classification).toBe('SUPPORTED')
    expect(result.overallRisk).toBe('low')
  })

  it('Bug 4: True negation in CV correctly flags contradictory claim', () => {
    const cv = 'I did not lead a team and worked independently as an individual contributor.'
    const claim = 'I led a team of 8 engineers.'

    const negation = checkNegationContradiction(claim, cv)
    expect(negation.hasContradiction).toBe(true)

    const result = validateAnswerGrounding({
      answer: claim,
      cv,
      mode: 'balanced',
    })
    expect(result.claims[0]?.classification).toBe('CONTRADICTED')
  })

  // ─── BUG 5: SOURCE ISOLATION (JD/INTERVIEWER VS CANDIDATE) ────────────────
  it('Bug 5: Job Description requirements or interviewer transcript lines do not prove personal claims', () => {
    const answer = 'I have 5 years of React experience.'
    const cv = 'Frontend Developer: 1 year of React experience.'
    const jd = 'Requirements: 5 years of React experience and TypeScript.'
    const transcript = 'Interviewer: We require 5 years of React experience for this Senior role.'

    const result = validateAnswerGrounding({
      answer,
      cv,
      jobDescription: jd,
      transcript,
      mode: 'strict',
    })

    // Must be CONTRADICTED by candidate CV (1 year vs 5 years), NOT supported by JD!
    expect(result.claims[0]?.classification).toBe('CONTRADICTED')
  })

  it('Bug 5: Candidate own statements in transcript (speaker = me/candidate) do count as candidate proof', () => {
    const answer = 'I managed our cloud infrastructure on Google Cloud Platform.'
    const transcript =
      'Interviewer: Did you have any cloud experience?\nCandidate: I managed our cloud infrastructure on Google Cloud Platform for two years.'

    const result = validateAnswerGrounding({
      answer,
      transcript,
      mode: 'balanced',
    })

    expect(result.claims[0]?.classification).toBe('SUPPORTED')
  })

  // ─── BUG 6: LONG CONTEXT & BILINGUAL ALIASES ──────────────────────────────
  it('Bug 6: Full context > 4000 chars is preserved, and Vietnamese answer matches English CV', () => {
    const filler = 'Backend infrastructure details and microservice documentation. '.repeat(150) // ~9000 chars
    const cv = `EXECUTIVE PROFILE:\n${filler}\nAt Acme Corp, I optimized PostgreSQL database performance and reduced latency.`

    const viAnswer = 'Tôi đã tối ưu hóa hiệu năng cơ sở dữ liệu PostgreSQL để giảm độ trễ.'

    const result = validateAnswerGrounding({
      answer: viAnswer,
      cv,
      mode: 'balanced',
    })

    expect(result.claims[0]?.classification).toBe('SUPPORTED')
    expect(result.overallRisk).toBe('low')
  })

  // ─── BUG 7: CLAIM TYPES, RISK CALCULATION & REWRITE ANSWER ─────────────────
  it('Bug 7: Generic words (team, engineer) do not inflate risk; general technical facts are preserved in strict mode', () => {
    const answer =
      'The CAP theorem states that a distributed system can only guarantee two out of consistency, availability, and partition tolerance.'
    const cv = 'Frontend developer with React experience.'

    const claimType = classifyClaimType(answer)
    expect(claimType).toBe('general_technical')

    const result = validateAnswerGrounding({
      answer,
      cv,
      mode: 'strict',
    })

    expect(result.claims[0]?.classification).toBe('GENERAL_KNOWLEDGE')
    expect(result.overallRisk).toBe('low')
    // Must NOT be deleted in strict mode
    expect(result.correctedAnswer).toContain('CAP theorem')
  })

  it('Bug 7: Vietnamese answer rewrite fallback preserves Vietnamese language', () => {
    const viFabricatedAnswer = 'Tôi đã sáng lập và điều hành công ty trị giá 1 tỷ USD.'
    const cv = 'Lập trình viên mới tốt nghiệp.'

    const result = validateAnswerGrounding({
      answer: viFabricatedAnswer,
      cv,
      mode: 'strict',
    })

    expect(result.claims[0]?.classification).toBe('UNSUPPORTED')
    // Fallback must be in Vietnamese, not English!
    expect(result.correctedAnswer).toMatch(/Tôi có thể|cần xác nhận/i)
    expect(result.correctedAnswer).not.toContain('I can explain')
  })
})

describe('Sentence Splitting & Streaming Grounder Pipeline', () => {
  it('splitSentences correctly preserves Node.js, v1.2, e.g., and markdown bullets', () => {
    const text = `
- Led a team of 5 engineers building Node.js microservices v2.1.
- Implemented e.g. Redis caching and Kafka message queues.
We migrated to AWS. It was successful.
`
    const sentences = splitSentences(text)
    expect(sentences.length).toBe(4)
    expect(sentences[0]).toContain('Node.js microservices v2.1')
    expect(sentences[1]).toContain('e.g. Redis caching')
  })

  it('createStreamingGrounder emits progressive claim evaluations as sentences complete without altering reading text', () => {
    const cv = 'At Acme, I led a team of 8 engineers. Built payment APIs.'
    const groundedClaims: string[] = []

    const grounder = createStreamingGrounder({
      cv,
      mode: 'balanced',
      onSentenceGround: (claim) => {
        groundedClaims.push(`${claim.id}:${claim.classification}`)
      },
    })

    // Stream tokens in chunks
    grounder.pushDelta('At Acme, I led a ')
    expect(groundedClaims.length).toBe(0) // Sentence not finished

    grounder.pushDelta('team of 8 engineers. Next, I ')
    expect(groundedClaims.length).toBe(1) // First sentence completed and grounded!
    expect(groundedClaims[0]).toContain('SUPPORTED')

    grounder.pushDelta('built payment APIs.')
    const finalResult = grounder.finalize()

    expect(finalResult.claims.length).toBe(2)
    expect(finalResult.claims[0]?.classification).toBe('SUPPORTED')
    expect(finalResult.claims[1]?.classification).toBe('SUPPORTED')
    expect(finalResult.overallRisk).toBe('low')
  })
})

describe('Layer 2 Async LLM Judge & Timeout Fallback', () => {
  it('validateAnswerGroundingAsync safely falls back to Tier 1 deterministic result with degraded: true on timeout/error', async () => {
    const result = await validateAnswerGroundingAsync({
      answer: 'I designed an event sourcing architecture using Apache Flink.',
      cv: 'Frontend developer with React.',
      mode: 'strict',
    })

    // In a test environment without a real running LLM model, it gracefully degrades
    expect(result).toBeDefined()
    expect(result.claims.length).toBe(1)
    expect(result.claims[0]?.classification).toBe('UNSUPPORTED')
    expect(result.degraded).toBe(true)
  })
})

describe('Golden Dataset Benchmark (>= 60 Test Pairs)', () => {
  it('Evaluates Precision, Recall, and False Positive Rate across all 67 test pairs', () => {
    clearFactSheetCache()

    let truePositives = 0 // Actually UNSUPPORTED or CONTRADICTED, correctly predicted as such
    let falsePositives = 0 // Actually SUPPORTED or GENERAL_KNOWLEDGE, incorrectly predicted as UNSUPPORTED or CONTRADICTED
    let trueNegatives = 0 // Actually SUPPORTED or GENERAL_KNOWLEDGE, correctly predicted
    let falseNegatives = 0 // Actually UNSUPPORTED or CONTRADICTED, missed

    let exactMatchCount = 0

    const resultsByCategory: Record<string, { total: number; correct: number }> = {}

    for (const testCase of GOLDEN_GROUNDING_DATASET) {
      const result = validateAnswerGrounding({
        answer: testCase.answer,
        cv: testCase.cv,
        jobDescription: testCase.jobDescription,
        transcript: testCase.transcript,
        mode: 'balanced',
      })

      const predictedVerdict = result.claims[0]?.classification
      const expectedVerdict = testCase.expectedVerdict

      if (!resultsByCategory[testCase.category]) {
        resultsByCategory[testCase.category] = { total: 0, correct: 0 }
      }
      resultsByCategory[testCase.category].total++

      const isPredictionCorrect = predictedVerdict === expectedVerdict
      if (isPredictionCorrect) {
        exactMatchCount++
        resultsByCategory[testCase.category].correct++
      } else {
        console.log(`  [Miss] ${testCase.id} (${testCase.category}): expected ${expectedVerdict}, got ${predictedVerdict} (claim: "${testCase.answer}")`)
      }

      const isActualDiscrepancy =
        expectedVerdict === 'UNSUPPORTED' || expectedVerdict === 'CONTRADICTED'
      const isPredictedDiscrepancy =
        predictedVerdict === 'UNSUPPORTED' || predictedVerdict === 'CONTRADICTED'

      if (isActualDiscrepancy && isPredictedDiscrepancy) {
        truePositives++
      } else if (!isActualDiscrepancy && isPredictedDiscrepancy) {
        falsePositives++
      } else if (!isActualDiscrepancy && !isPredictedDiscrepancy) {
        trueNegatives++
      } else if (isActualDiscrepancy && !isPredictedDiscrepancy) {
        falseNegatives++
      }
    }

    const total = GOLDEN_GROUNDING_DATASET.length
    const precision =
      truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 1
    const recall =
      truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 1
    const fpr =
      falsePositives + trueNegatives > 0 ? falsePositives / (falsePositives + trueNegatives) : 0
    const accuracy = exactMatchCount / total

    console.log('\n===============================================================')
    console.log('             AI COPILOT ANSWER GROUNDING BENCHMARK             ')
    console.log('===============================================================')
    console.log(`Total Golden Test Cases:        ${total}`)
    console.log(`Exact Verdict Accuracy:         ${(accuracy * 100).toFixed(1)}% (${exactMatchCount}/${total})`)
    console.log(`Discrepancy Detection Recall:   ${(recall * 100).toFixed(1)}% (${truePositives}/${truePositives + falseNegatives})`)
    console.log(`Discrepancy Detection Precision:${(precision * 100).toFixed(1)}% (${truePositives}/${truePositives + falsePositives})`)
    console.log(`False Positive Rate (FPR):      ${(fpr * 100).toFixed(2)}% (${falsePositives}/${falsePositives + trueNegatives})`)
    console.log('---------------------------------------------------------------')
    console.log('Performance by Category:')
    for (const [cat, data] of Object.entries(resultsByCategory)) {
      const pct = ((data.correct / data.total) * 100).toFixed(0)
      console.log(`  - ${cat.padEnd(25)}: ${pct}% (${data.correct}/${data.total})`)
    }
    console.log('===============================================================\n')

    expect(total).toBeGreaterThanOrEqual(60)
    expect(recall).toBeGreaterThanOrEqual(0.85) // High recall catching discrepancies
    expect(precision).toBeGreaterThanOrEqual(0.85) // High precision without false alarms
    expect(fpr).toBeLessThanOrEqual(0.10) // Low false positive rate <= 10%
  })
})
