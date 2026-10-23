import { jdKeywordExtractor } from '../src/app/services/ai-model/stt/jdKeywordExtractor'
import { whisperPromptBuilder } from '../src/app/services/ai-model/stt/whisperPromptBuilder'
import { SAMPLE_JD, SAMPLE_DISCUSSION_CONTEXT } from '../src/app/services/meeting-context/samples'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  [PASS] ${testName}`)
  } else {
    console.error(`  [FAIL] ${testName}`, details ? details : '')
  }
}

console.log('======================================================================')
console.log('TEST SUITE: CONTEXT-AWARE WHISPER KEYWORD EXTRACTION & PROMPT BUILDER')
console.log('======================================================================')

// ── Test Group 1: Curated Dictionary & Alias Normalization ───────────────────
console.log('\n--- 1. Keyword Extraction & Alias Normalization ---')
{
  const input = 'We are hiring an engineer experienced with reactjs, k8s, postgres, golang and docker.'
  const keywords = jdKeywordExtractor.extractKeywords(input)

  assert(keywords.includes('React'), 'Normalizes "reactjs" -> "React"', keywords)
  assert(keywords.includes('Kubernetes'), 'Normalizes "k8s" -> "Kubernetes"', keywords)
  assert(keywords.includes('PostgreSQL'), 'Normalizes "postgres" -> "PostgreSQL"', keywords)
  assert(keywords.includes('Go'), 'Normalizes "golang" -> "Go"', keywords)
  assert(keywords.includes('Docker'), 'Identifies "docker" -> "Docker"', keywords)
}

// ── Test Group 2: Deduplication Across Aliases ────────────────────────────────
console.log('\n--- 2. Deduplication Across Repeated Aliases ---')
{
  const input = 'Build UI in React, reactjs, and react.js with redux and redux toolkit.'
  const keywords = jdKeywordExtractor.extractKeywords(input)

  const reactCount = keywords.filter((k) => k === 'React').length
  const reduxCount = keywords.filter((k) => k === 'Redux').length

  assert(reactCount === 1, 'Only 1 "React" entry despite multiple aliases ("React", "reactjs", "react.js")', keywords)
  assert(reduxCount === 1, 'Only 1 "Redux" entry despite "redux" and "redux toolkit"', keywords)
}

// ── Test Group 3: Tech Acronyms & Stopwords Exclusion ────────────────────────
console.log('\n--- 3. Tech Acronyms & Stopwords Exclusion ---')
{
  const input = 'Use AWS S3, EC2, IAM, VPC, and SQS. BUT DO NOT USE OLD TOOLS FOR THIS AND THAT.'
  const keywords = jdKeywordExtractor.extractKeywords(input)

  assert(keywords.includes('AWS'), 'Extracts AWS', keywords)
  assert(keywords.includes('S3'), 'Extracts S3 acronym', keywords)
  assert(keywords.includes('EC2'), 'Extracts EC2 acronym', keywords)
  assert(keywords.includes('VPC'), 'Extracts VPC acronym', keywords)

  // Stopwords should NOT be extracted as keywords
  assert(!keywords.includes('BUT'), 'Excludes stopword "BUT"')
  assert(!keywords.includes('NOT'), 'Excludes stopword "NOT"')
  assert(!keywords.includes('USE'), 'Excludes stopword "USE"')
  assert(!keywords.includes('FOR'), 'Excludes stopword "FOR"')
  assert(!keywords.includes('AND'), 'Excludes stopword "AND"')
  assert(!keywords.includes('THIS'), 'Excludes stopword "THIS"')
  assert(!keywords.includes('THAT'), 'Excludes stopword "THAT"')
}

// ── Test Group 4: PascalCase Proper Nouns Extraction ─────────────────────────
console.log('\n--- 4. PascalCase / CamelCase Proper Nouns ---')
{
  const input = 'Deploy via CloudFront with OpenTelemetry monitoring and DynamoDB storage.'
  const keywords = jdKeywordExtractor.extractKeywords(input)

  assert(keywords.includes('DynamoDB'), 'Extracts DynamoDB', keywords)
  assert(keywords.includes('OpenTelemetry'), 'Extracts OpenTelemetry', keywords)
  assert(keywords.includes('CloudFront'), 'Extracts CloudFront', keywords)
}

// ── Test Group 5: LRU Caching & Idempotency ──────────────────────────────────
console.log('\n--- 5. LRU Caching & Performance ---')
{
  const text = 'Fullstack TypeScript and Node.js with Kubernetes and AWS'
  jdKeywordExtractor.clearCache()

  const start1 = performance.now()
  const firstRun = jdKeywordExtractor.extractKeywords(text)
  const duration1 = performance.now() - start1

  const start2 = performance.now()
  const secondRun = jdKeywordExtractor.extractKeywords(text)
  const duration2 = performance.now() - start2

  assert(
    JSON.stringify(firstRun) === JSON.stringify(secondRun),
    'Cached execution returns identical results'
  )
  assert(
    duration2 <= duration1 + 1,
    `Cache hit is sub-millisecond (Run 1: ${duration1.toFixed(3)}ms, Run 2: ${duration2.toFixed(3)}ms)`
  )
}

// ── Test Group 6: Empty & Edge Case Fallback ─────────────────────────────────
console.log('\n--- 6. Edge Case & Empty Input Fallbacks ---')
{
  assert(jdKeywordExtractor.extractKeywords('').length === 0, 'Empty string returns empty array')
  assert(jdKeywordExtractor.extractKeywords('   \n\t  ').length === 0, 'Whitespace returns empty array')
  assert((jdKeywordExtractor.extractKeywords as any)(null).length === 0, 'null input gracefully handled')
  assert((jdKeywordExtractor.extractKeywords as any)(undefined).length === 0, 'undefined input gracefully handled')
  assert(jdKeywordExtractor.extractKeywords('1234 5678 9999').length === 0, 'Pure numbers return empty array')
}

// ── Test Group 7: Extraction on Real Application Samples ─────────────────────
console.log('\n--- 7. Extraction on Real Application Samples ---')
{
  const sampleJdKeywords = jdKeywordExtractor.extractKeywords(SAMPLE_JD)
  console.log('    Extracted from SAMPLE_JD:', sampleJdKeywords)

  assert(sampleJdKeywords.includes('TypeScript'), 'SAMPLE_JD contains TypeScript')
  assert(sampleJdKeywords.includes('React'), 'SAMPLE_JD contains React')
  assert(sampleJdKeywords.includes('Node.js'), 'SAMPLE_JD contains Node.js')
  assert(sampleJdKeywords.includes('Go'), 'SAMPLE_JD contains Go')
  assert(sampleJdKeywords.includes('Redis'), 'SAMPLE_JD contains Redis')
  assert(sampleJdKeywords.includes('Kafka'), 'SAMPLE_JD contains Kafka')
  assert(sampleJdKeywords.includes('RabbitMQ'), 'SAMPLE_JD contains RabbitMQ')
  assert(sampleJdKeywords.includes('Microservices'), 'SAMPLE_JD contains Microservices')

  const discussionKeywords = jdKeywordExtractor.extractKeywords(SAMPLE_DISCUSSION_CONTEXT)
  console.log('    Extracted from SAMPLE_DISCUSSION_CONTEXT:', discussionKeywords)
  assert(discussionKeywords.includes('Redis'), 'SAMPLE_DISCUSSION contains Redis')
}

// ── Test Group 8: WhisperPromptBuilder Formatting & Context Types ────────────
console.log('\n--- 8. WhisperPromptBuilder Formatting & Context Types ---')
{
  const keywords = ['React', 'TypeScript', 'Kubernetes', 'AWS', 'PostgreSQL', 'Docker']

  const interviewPrompt = whisperPromptBuilder.buildPrompt(keywords, {
    contextType: 'interview',
  })
  assert(
    interviewPrompt.startsWith('Technical interview about React, TypeScript'),
    'Interview prompt uses interview prefix',
    interviewPrompt
  )
  assert(interviewPrompt.endsWith('.'), 'Interview prompt ends with a period', interviewPrompt)

  const discussionPrompt = whisperPromptBuilder.buildPrompt(keywords, {
    contextType: 'discussion',
  })
  assert(
    discussionPrompt.startsWith('Technical meeting discussing React, TypeScript'),
    'Discussion prompt uses discussion prefix',
    discussionPrompt
  )
}

// ── Test Group 9: Prompt Character Clamping & Sanitization ───────────────────
console.log('\n--- 9. Prompt Clamping (<= 220 chars) & Sanitization ---')
{
  const manyKeywords = [
    'React', 'TypeScript', 'Kubernetes', 'AWS', 'PostgreSQL', 'Docker',
    'GraphQL', 'gRPC', 'Redis', 'Kafka', 'RabbitMQ', 'Elasticsearch',
    'MongoDB', 'Terraform', 'Next.js', 'NestJS', 'Microservices', 'CI/CD',
    'OpenTelemetry', 'CloudFront', 'Prometheus', 'Grafana'
  ]

  const prompt = whisperPromptBuilder.buildPrompt(manyKeywords, { maxChars: 120 })
  assert(prompt.length <= 120, `Prompt clamped to <= 120 characters (Actual length: ${prompt.length})`, prompt)
  assert(prompt.endsWith('.'), 'Clamped prompt correctly preserves trailing period', prompt)

  const emptyPrompt = whisperPromptBuilder.buildPrompt([])
  assert(emptyPrompt === '', 'Empty keywords produces empty prompt string')

  const fallbackPrompt = (whisperPromptBuilder.buildPrompt as any)(null)
  assert(fallbackPrompt === '', 'null keywords produces empty prompt string without throwing')
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n======================================================================')
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`)
console.log('======================================================================')

if (passedTests === totalTests) {
  console.log('All tests PASSED successfully!')
  process.exit(0)
} else {
  console.error('Some tests FAILED.')
  process.exit(1)
}
