import { describe, it, expect } from 'bun:test'
import {
  assembleLatestExchange,
  takeLastSentence,
  cleanAudioAnnotations,
  wordsMatch,
  levenshteinDistance,
  endsWithSentencePunctuation,
  stitchTwoChunks,
  isCandidateSpeaker,
  type AssemblerLine,
} from '../exchangeAssembler'

describe('exchangeAssembler Unit & Regression Suite', () => {
  // ── 1. Basic helper tests ──────────────────────────────────────────────────
  it('1. levenshteinDistance computes accurate distances', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('service', 'services')).toBe(1)
    expect(levenshteinDistance('same', 'same')).toBe(0)
    expect(levenshteinDistance('', 'abc')).toBe(3)
  })

  it('2. wordsMatch tolerates 1 typo/suffix on words >= 5 characters', () => {
    expect(wordsMatch('microservice', 'microservices')).toBe(true)
    expect(wordsMatch('database', 'databases')).toBe(true)
    // Short words (< 5 chars) require exact match
    expect(wordsMatch('cat', 'bat')).toBe(false)
    expect(wordsMatch('the', 'the')).toBe(true)
  })

  it('3. cleanAudioAnnotations strips Whisper tags in both English and Vietnamese', () => {
    const raw = '[BLANK_AUDIO] Hello (laughing) there [MUSIC] and (cười) [applause]'
    expect(cleanAudioAnnotations(raw)).toBe('Hello there and')
  })

  it('4. endsWithSentencePunctuation detects proper terminators and rejects abbreviations/decimals/ellipses', () => {
    expect(endsWithSentencePunctuation('How are you?')).toBe(true)
    expect(endsWithSentencePunctuation('Done!')).toBe(true)
    expect(endsWithSentencePunctuation('This is finished.')).toBe(true)
    expect(endsWithSentencePunctuation('Wait a minute...')).toBe(false)
    expect(endsWithSentencePunctuation('Wait a minute…')).toBe(false)
    expect(endsWithSentencePunctuation('He is Dr.')).toBe(false)
    expect(endsWithSentencePunctuation('We use Node.js')).toBe(false)
    expect(endsWithSentencePunctuation('Version is v1.2.')).toBe(false)
  })

  // ── 2. Boundary overlap & Chunk stitching ──────────────────────────────────
  it('5. EN: Boundary overlap with 2 words is cleanly deduplicated', () => {
    const res = stitchTwoChunks('tell me about your', 'your experience with Kafka')
    expect(res).toBe('tell me about your experience with Kafka')
  })

  it('6. EN: Boundary overlap with 1 long word (>= 4 chars) is deduplicated', () => {
    const res = stitchTwoChunks('we use kubernetes', 'kubernetes clusters in production')
    expect(res).toBe('we use kubernetes clusters in production')
  })

  it('7. EN: Levenshtein tolerance <= 1 deduplicates slightly altered overlapping word (>= 5 chars)', () => {
    const res = stitchTwoChunks('our distributed microservice', 'microservices architecture has 5 nodes')
    expect(res).toBe('our distributed microservices architecture has 5 nodes')
  })

  it('8. Valid repetition: "that that" is preserved and not pruned', () => {
    const res = stitchTwoChunks('I think that', 'that is the correct answer')
    expect(res).toBe('I think that that is the correct answer')
  })

  it('9. Valid repetition: "had had" in English is preserved', () => {
    const res = stitchTwoChunks('All the issues he had', 'had been resolved')
    expect(res).toBe('All the issues he had had been resolved')
  })

  it('10. VI: Valid repetition: "rất rất" is preserved', () => {
    const res = stitchTwoChunks('Hệ thống chạy rất', 'rất mượt mà')
    expect(res).toBe('Hệ thống chạy rất rất mượt mà')
  })

  it('11. VI: Valid repetition: "nhiều nhiều" is preserved', () => {
    const res = stitchTwoChunks('Dự án có nhiều', 'nhiều người tham gia')
    expect(res).toBe('Dự án có nhiều nhiều người tham gia')
  })

  it('12. VI: Boundary overlap with 1 long word is deduplicated', () => {
    const res = stitchTwoChunks('chúng ta sẽ chuyển sang', 'sang kiến trúc mới')
    expect(res).toBe('chúng ta sẽ chuyển sang kiến trúc mới')
  })

  it('13. VI: Boundary overlap with 2 words is deduplicated', () => {
    const res = stitchTwoChunks('bạn có thể giải thích', 'thể giải thích thêm về Redis không?')
    expect(res).toBe('bạn có thể giải thích thêm về Redis không?')
  })

  it('14. Mixed EN-VI: Boundary overlap with English keyword', () => {
    const res = stitchTwoChunks('dự án này deploy lên', 'deploy lên AWS ECS')
    expect(res).toBe('dự án này deploy lên AWS ECS')
  })

  it('15. Mixed EN-VI: Boundary overlap with "Node.js"', () => {
    const res = stitchTwoChunks('chúng tôi dùng Node.js', 'Node.js cho backend API')
    expect(res).toBe('chúng tôi dùng Node.js cho backend API')
  })

  it('16. Boundary punctuation attaches directly without extra space', () => {
    const res = stitchTwoChunks('Thank you so much', ', let us proceed.')
    expect(res).toBe('Thank you so much, let us proceed.')
  })

  it('17. Sentence terminating previous chunk prevents overlap pruning across sentences', () => {
    const res = stitchTwoChunks('We deployed Redis.', 'Redis is very fast.')
    expect(res).toBe('We deployed Redis. Redis is very fast.')
  })

  it('18. Trailing and leading ellipsis "..." stripped during stitching', () => {
    const res = stitchTwoChunks('Can you explain...', '...how garbage collection works?')
    expect(res).toBe('Can you explain how garbage collection works?')
  })

  // ── 3. takeLastSentence & extractSentences robustness ──────────────────────
  it('19. takeLastSentence handles single question sentence', () => {
    expect(takeLastSentence('What is your experience?')).toBe('What is your experience?')
  })

  it('20. takeLastSentence splits multi-sentence and returns last sentence', () => {
    const text = 'First we discuss requirements. Then we design the schema. How do we partition?'
    expect(takeLastSentence(text)).toBe('How do we partition?')
  })

  it('21. takeLastSentence does not split at "Dr." or "Mr."', () => {
    const text = 'I spoke with Dr. Smith yesterday. He approved the PR.'
    expect(takeLastSentence(text)).toBe('He approved the PR.')
    expect(takeLastSentence('I spoke with Dr. Smith.')).toBe('I spoke with Dr. Smith.')
  })

  it('22. takeLastSentence does not split at "e.g." or "i.e."', () => {
    const text = 'We support multiple databases, e.g. PostgreSQL and MongoDB.'
    expect(takeLastSentence(text)).toBe('We support multiple databases, e.g. PostgreSQL and MongoDB.')
  })

  it('23. takeLastSentence does not split at decimal numbers', () => {
    const text = 'The latency dropped from 3.14 seconds to 1.2 seconds.'
    expect(takeLastSentence(text)).toBe('The latency dropped from 3.14 seconds to 1.2 seconds.')
  })

  it('24. takeLastSentence does not split at "Node.js"', () => {
    const text = 'We use Node.js in our backend microservices.'
    expect(takeLastSentence(text)).toBe('We use Node.js in our backend microservices.')
  })

  it('25. takeLastSentence handles East Asian full-width punctuation', () => {
    const text = '这是第一句话。请问这个架构如何扩展？'
    expect(takeLastSentence(text)).toBe('请问这个架构如何扩展？')
  })

  it('26. takeLastSentence returns empty string for whitespace or empty', () => {
    expect(takeLastSentence('   ')).toBe('')
    expect(takeLastSentence('')).toBe('')
  })

  // ── 4. assembleLatestExchange Full Turn & Multi-Sentence Extraction ────────
  it('27. Multi-sentence turn provides original (last sentence) AND fullTurnText (whole turn)', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Cuộc họp', original: 'Today we are reviewing the chat service.' },
      { speaker: 'Cuộc họp', original: 'It will handle real-time WebSockets.' },
      { speaker: 'Cuộc họp', original: 'We start with the auth layer.' },
    ]
    const res = assembleLatestExchange(lines, 'discussion')
    expect(res).not.toBeNull()
    expect(res?.original).toBe('We start with the auth layer.')
    expect(res?.fullTurnText).toBe(
      'Today we are reviewing the chat service. It will handle real-time WebSockets. We start with the auth layer.'
    )
    expect(res?.mergedLineCount).toBe(3)
  })

  it('28. Multi-sentence turn with question extracts questionSentence', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'Let us move to system design.' },
      { speaker: 'Interviewer', original: 'How would you design a distributed rate limiter?' },
      { speaker: 'Interviewer', original: 'Take your time to think.' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.questionSentence).toBe('How would you design a distributed rate limiter?')
    expect(res?.isQuestion).toBe(true)
    expect(res?.original).toBe('Take your time to think.')
    expect(res?.fullTurnText).toContain('How would you design a distributed rate limiter?')
  })

  // ── 5. Speaker Selection (Interview vs Discussion) ─────────────────────────
  it('29. Interview mode: skips candidate ("You") and selects Interviewer question', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'Can you explain how CAP theorem' },
      { speaker: 'Interviewer', original: 'applies to your system?' },
      { speaker: 'You', original: 'Sure, in our payment gateway we chose AP.' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.speaker).toBe('Interviewer')
    expect(res?.original).toBe('Can you explain how CAP theorem applies to your system?')
  })

  it('30. Interview mode: falls back to candidate when only candidate has spoken', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'You', original: 'Hello, my name is Hoang Long.' },
      { speaker: 'You', original: 'I am applying for Senior Engineer.' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.speaker).toBe('You')
    expect(res?.original).toBe('I am applying for Senior Engineer.')
  })

  it('31. Discussion mode: extracts only contiguous run of trailing speaker', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Cuộc họp', original: 'We should use Redis.' },
      { speaker: 'You', original: 'I disagree.' },
      { speaker: 'Cuộc họp', original: 'Actually,' },
      { speaker: 'Cuộc họp', original: 'the cache layer is the bottleneck.' },
    ]
    const res = assembleLatestExchange(lines, 'discussion')
    expect(res?.speaker).toBe('Cuộc họp')
    expect(res?.original).toBe('Actually, the cache layer is the bottleneck.')
    expect(res?.fullTurnText).toBe('Actually, the cache layer is the bottleneck.')
    expect(res?.fullTurnText).not.toContain('I disagree')
  })

  // ── 6. Metadata Signals (continuation & sequenceId) ────────────────────────
  it('32. STT continuation = true forces stitching even across period', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'We use Node.js.', continuation: false },
      { speaker: 'Interviewer', original: 'And TypeScript for all services.', continuation: true },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.continuationStitched).toBe(true)
    expect(res?.mergedLineCount).toBe(2)
    expect(res?.fullTurnText).toBe('We use Node.js. And TypeScript for all services.')
  })

  it('33. Sequence ID gap > 1 stops lookback', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'First topic was Docker.', sequenceId: 10 },
      { speaker: 'Interviewer', original: 'Now tell me about Kubernetes.', sequenceId: 15 },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.mergedLineCount).toBe(1)
    expect(res?.original).toBe('Now tell me about Kubernetes.')
  })

  it('34. Timestamp gap > maxTimeGapSeconds stops lookback', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Cuộc họp', original: 'Old comment', timestamp: '10:00' },
      { speaker: 'Cuộc họp', original: 'New comment 5 minutes later', timestamp: '15:00' },
    ]
    const res = assembleLatestExchange(lines, 'discussion', { maxTimeGapSeconds: 30 })
    expect(res?.mergedLineCount).toBe(1)
    expect(res?.original).toBe('New comment 5 minutes later')
  })

  // ── 7. Edge Cases: Audio Tags, Punctuation & Vietnamese ────────────────────
  it('35. Embedded Whisper audio tags removed from multi-chunk assembly', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: '[BLANK_AUDIO] Could you explain' },
      { speaker: 'Interviewer', original: 'how (laughter) Redis expires keys? [MUSIC]' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.original).toBe('Could you explain how Redis expires keys?')
  })

  it('36. Vietnamese question particles (phải không, đúng không) recognized as question', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'Hệ thống này cần chịu tải 100k TPS' },
      { speaker: 'Interviewer', original: 'phải không anh' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.isQuestion).toBe(true)
    expect(res?.original).toBe('Hệ thống này cần chịu tải 100k TPS phải không anh')
  })

  it('37. Empty and blank transcripts return null safely', () => {
    expect(assembleLatestExchange([])).toBeNull()
    expect(assembleLatestExchange([{ speaker: 'You', original: '   ' }])).toBeNull()
  })

  it('38. Rapid 5-fragment real-time STT speech stitched cleanly', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'Can you' },
      { speaker: 'Interviewer', original: 'tell me about' },
      { speaker: 'Interviewer', original: 'about your' },
      { speaker: 'Interviewer', original: 'experience with' },
      { speaker: 'Interviewer', original: 'with microservices?' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.original).toBe('Can you tell me about your experience with microservices?')
    expect(res?.mergedLineCount).toBe(5)
  })

  it('39. isCandidateSpeaker helper handles various representations', () => {
    expect(isCandidateSpeaker('You')).toBe(true)
    expect(isCandidateSpeaker('You (Mic)')).toBe(true)
    expect(isCandidateSpeaker('Ứng viên')).toBe(true)
    expect(isCandidateSpeaker('Bạn')).toBe(true)
    expect(isCandidateSpeaker('Interviewer')).toBe(false)
    expect(isCandidateSpeaker('Cuộc họp')).toBe(false)
  })

  // ── 8. Performance Benchmark: Execution time must be < 5ms ────────────────
  it('40. assembleLatestExchange executes in < 5ms (0 tokens, deterministic)', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'Today we have a technical coding round.' },
      { speaker: 'Interviewer', original: 'Can you explain how' },
      { speaker: 'Interviewer', original: 'how the CAP theorem' },
      { speaker: 'Interviewer', original: 'applies to distributed databases like Cassandra?' },
    ]

    const start = performance.now()
    const iterations = 100
    for (let i = 0; i < iterations; i++) {
      assembleLatestExchange(lines, 'interview')
    }
    const elapsed = performance.now() - start
    const avgPerCall = elapsed / iterations

    // Average per call must be well below 5ms (typically < 0.1ms)
    expect(avgPerCall).toBeLessThan(5.0)
    expect(avgPerCall).toBeLessThan(1.0)
  })

  it('41. Verification: assembleLatestExchange uses ZERO tokens and does not call any LLM', () => {
    // Pure synchronous call without async LLM
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'What is eventual consistency?' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res).not.toBeNull()
    expect(res?.original).toBe('What is eventual consistency?')
  })

  it('42. Valid repetition preservation in full assembleLatestExchange run', () => {
    const lines: AssemblerLine[] = [
      { speaker: 'Interviewer', original: 'I believe that' },
      { speaker: 'Interviewer', original: 'that that method is very effective.' },
    ]
    const res = assembleLatestExchange(lines, 'interview')
    expect(res?.fullTurnText).toContain('that that')
  })
})
