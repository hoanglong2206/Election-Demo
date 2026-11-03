/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TECHNICAL VIETGLISH & CODE-SWITCHING LEXICON
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides specialized technical vocabulary conditioning and phonetic
 * post-correction for Whisper STT (both Local C++ and Groq Cloud LPU).
 *
 * Solves the classic problem where bilingual Vietnamese engineers speaking
 * English technical terms ("Docker", "Kubernetes", "Redis", "Kafka", etc.)
 * are mis-transcribed into phonetic Vietnamese garbage by Whisper.
 */

export const CORE_TECHNICAL_LEXICON: readonly string[] = [
  // Top High-Frequency Buzzwords in Vietglish Interviews
  'TypeScript',
  'JavaScript',
  'Node.js',
  'React',
  'Next.js',
  'Docker',
  'Kubernetes',
  'Microservices',
  'Redis',
  'Kafka',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'gRPC',
  'GraphQL',
  'Goroutine',
  'Load Balancer',
  'Sharding',
  'Caching',
  'DevOps',
  'CI/CD',
  'AWS',
  'Golang',
  'Python',
  'Java',
  'Spring Boot',
  'C++',
  'Rust',
  'Vue.js',
  'Angular',
  'FastAPI',
  'NestJS',
  'Elasticsearch',
  'Cassandra',
  'ClickHouse',
  'SQLite',
  'DynamoDB',
  'Monolith',
  'RabbitMQ',
  'REST API',
  'Replication',
  'Event-Driven',
  'Pub/Sub',
  'CQRS',
  'Circuit Breaker',
  'WebSocket',
  'GCP',
  'Azure',
  'Terraform',
  'Prometheus',
  'Grafana',
  'Nginx',
  'GitHub',
  'Algorithm',
  'LeetCode',
  'Big-O',
  'O(1)',
  'O(log N)',
  'O(N)',
  'Dynamic Programming',
  'Binary Search',
  'Dijkstra',
  'Concurrency',
  'Multithreading',
  'Deadlock',
  'ACID',
]

/**
 * Concise base prompt conditioning string injected into Whisper initial_prompt
 * to prime its decoder on English technical nouns spoken in Vietnamese audio.
 */
export const TECHNICAL_VIETGLISH_BASE_PROMPT =
  'Technical interview & engineering discussion in Vietnamese and English: React, TypeScript, Node.js, Docker, Kubernetes, Microservices, Redis, Kafka, PostgreSQL, Goroutine, Async/Await, Cache, Indexing, Sharding, gRPC, O(log N).'

/**
 * Compiles a raw regex pattern string into a Unicode-aware word boundary pattern.
 * Uses unicode lookaround (?<=^|[^\p{L}\p{N}]) and (?=$|[^\p{L}\p{N}]) with 'giu' flags
 * to correctly match Vietnamese diacritics and preserve casing variations.
 */
function compileJargonRegex(pattern: string): RegExp {
  return new RegExp(`(?<=^|[^\\p{L}\\p{N}])(?:${pattern})(?=$|[^\\p{L}\\p{N}])`, 'giu')
}

/**
 * Raw patterns of phonetic Vietnamese mis-transcriptions mapped to their
 * standard technical English spelling.
 */
const RAW_VIETGLISH_PATTERNS: ReadonlyArray<[string, string]> = [
  // Container & Orchestration
  ['đốc\\s*cơ|đốc\\s*kơ|đoóc\\s*cơ|đô\\s*cơ', 'Docker'],
  ['cu\\s*bơ\\s*ne\\s*tít|cu\\s*bơ\\s*ne\\s*ti|cu\\s*bơ\\s*nét|cu\\s*be\\s*ne\\s*ti|cu\\s*be\\s*ne\\s*tít', 'Kubernetes'],
  ['k8s|k\\s*tám\\s*ét', 'K8s'],

  // Databases & In-memory
  ['rê\\s*đít|rê\\s*địt|rê\\s*đis|re\\s*đít', 'Redis'],
  ['cáp\\s*ca|káp\\s*ca|cáp\\s*pha', 'Kafka'],
  ['pốt\\s*gờ\\s*rét|pốt\\s*ghê|pốt\\s*gờ\\s*re|pót\\s*gờ\\s*re|pót\\s*gờ\\s*rét', 'PostgreSQL'],
  ['mông\\s*gô(?:\\s*đê\\s*bê)?|mông\\s*gâu', 'MongoDB'],
  ['mai\\s*ét\\s*kju\\s*en|mai\\s*ét\\s*sờ\\s*kju\\s*en|mai\\s*xi\\s*cô|mai\\s*ét\\s*cu\\s*en', 'MySQL'],

  // Frameworks, Languages & Runtimes
  ['nốt\\s*di\\s*ét|nốt\\s*dếch|nốt\\s*giai\\s*ét', 'Node.js'],
  ['ri\\s*ác|ri\\s*ếch|ri\\s*ét', 'React'],
  ['nét\\s*dếch|nếch\\s*dếch|nét\\s*giai\\s*ét', 'Next.js'],
  ['tai\\s*xờ\\s*cờ\\s*ríp|típ\\s*xờ\\s*cờ\\s*ríp|tai\\s*cờ\\s*ríp', 'TypeScript'],
  ['da\\s*va\\s*xờ\\s*cờ\\s*ríp|gia\\s*va\\s*xờ\\s*cờ\\s*ríp|za\\s*va\\s*xờ\\s*cờ\\s*ríp', 'JavaScript'],
  ['gờ\\s*ráp\\s*kju\\s*en|gờ\\s*rap\\s*kju\\s*en', 'GraphQL'],
  ['gờ\\s*rờ\\s*pê\\s*xê|gờ\\s*rờ\\s*pi\\s*xi|gờ\\s*rê\\s*pê\\s*xê|gê\\s*rờ\\s*pê\\s*xê', 'gRPC'],

  // Architecture & Concurrency
  ['gô\\s*ru\\s*tin|gâu\\s*ru\\s*tin|gô\\s*ru\\s*ting', 'Goroutine'],
  ['lốt\\s*ba\\s*lăng\\s*xơ|nốt\\s*ba\\s*lăng\\s*xơ|nốt\\s*ba\\s*lan\\s*xơ|lốt\\s*ba\\s*lan\\s*xơ', 'Load Balancer'],
  ['mai\\s*cờ\\s*rô\\s*xơ\\s*vít|mai\\s*cờ\\s*rô\\s*xơ\\s*vit', 'Microservices'],
  ['shát\\s*đinh|sát\\s*đinh', 'Sharding'],
  ['cát\\s*sờ|két\\s*sờ', 'Cache'],
  ['xì\\s*queo|sì\\s*queo|xì\\s*cu\\s*en', 'SQL'],
  ['no\\s*xì\\s*queo|nô\\s*sì\\s*queo|nô\\s*xì\\s*cu\\s*en', 'NoSQL'],
  ['pắp\\s*sắp|bắp\\s*sắp', 'Pub/Sub'],

  // Roles, Practices & Tools
  ['đép\\s*ốp|đíp\\s*ốp|đao\\s*ốp', 'DevOps'],
  ['bách\\s*en|ba\\s*ken', 'Backend'],
  ['phờ\\s*rôn\\s*en|phờ\\s*rông\\s*en', 'Frontend'],
  ['gít\\s*húp|gít\\s*háp', 'GitHub'],
  ['lít\\s*cốt|lít\\s*cót', 'LeetCode'],
  ['an\\s*gô\\s*ri\\s*thầm|an\\s*gô\\s*rít', 'Algorithm'],
  ['xì\\s*keo|xờ\\s*keo', 'Scale'],
]

/**
 * Pre-compiled table of regex patterns for fast phonetic normalization.
 */
export const VIETGLISH_PHONETIC_CORRECTIONS: ReadonlyArray<[RegExp, string]> =
  RAW_VIETGLISH_PATTERNS.map(([pattern, replacement]) => [
    compileJargonRegex(pattern),
    replacement,
  ])

/**
 * Normalizes phonetic Vietglish mis-transcriptions from Whisper STT
 * back to proper international technical terms.
 */
export function correctVietglishJargon(text: string): string {
  if (!text || !text.trim()) return text

  let corrected = text
  for (const [pattern, replacement] of VIETGLISH_PHONETIC_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement)
  }

  return corrected
}
