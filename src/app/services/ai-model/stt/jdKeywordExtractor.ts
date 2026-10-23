/**
 * ─────────────────────────────────────────────────────────────────────────────
 * JD KEYWORD EXTRACTOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule-based, zero-cost, instant extractor for Job Descriptions.
 * Extracts technical stacks, languages, frameworks, cloud services, databases,
 * and tech acronyms with canonical normalization and deduplication.
 */

export interface KeywordCategoryItem {
  canonical: string
  aliases?: string[]
  weight: number
}

// ── Curated Tech Dictionary with Canonical Casing & Aliases ─────────────────
const TECH_DICTIONARY: KeywordCategoryItem[] = [
  // Programming Languages (Weight: 10)
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], weight: 10 },
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'es6', 'es2020'], weight: 10 },
  { canonical: 'Python', aliases: ['python', 'python3', 'py'], weight: 10 },
  { canonical: 'Java', aliases: ['java', 'java8', 'java11', 'java17', 'java21'], weight: 10 },
  { canonical: 'C++', aliases: ['c++', 'cpp'], weight: 10 },
  { canonical: 'C#', aliases: ['c#', 'csharp'], weight: 10 },
  { canonical: '.NET', aliases: ['.net', 'dotnet', '.net core', 'asp.net'], weight: 10 },
  { canonical: 'Go', aliases: ['golang', 'go lang'], weight: 10 },
  { canonical: 'Rust', aliases: ['rust', 'rustlang'], weight: 10 },
  { canonical: 'Kotlin', aliases: ['kotlin'], weight: 10 },
  { canonical: 'Swift', aliases: ['swift'], weight: 10 },
  { canonical: 'PHP', aliases: ['php', 'php7', 'php8'], weight: 10 },
  { canonical: 'Ruby', aliases: ['ruby'], weight: 9 },
  { canonical: 'SQL', aliases: ['sql', 't-sql', 'pl/sql'], weight: 9 },
  { canonical: 'HTML5', aliases: ['html', 'html5'], weight: 8 },
  { canonical: 'CSS3', aliases: ['css', 'css3'], weight: 8 },
  { canonical: 'Bash', aliases: ['bash', 'shell script', 'shell'], weight: 8 },

  // Frontend & Mobile (Weight: 10)
  { canonical: 'React', aliases: ['reactjs', 'react.js', 'react'], weight: 10 },
  { canonical: 'Next.js', aliases: ['nextjs', 'next.js', 'next'], weight: 10 },
  { canonical: 'Vue', aliases: ['vuejs', 'vue.js', 'vue 3'], weight: 9 },
  { canonical: 'Nuxt.js', aliases: ['nuxtjs', 'nuxt.js', 'nuxt'], weight: 9 },
  { canonical: 'Angular', aliases: ['angularjs', 'angular', 'angular 2+'], weight: 9 },
  { canonical: 'Svelte', aliases: ['svelte', 'sveltekit'], weight: 9 },
  { canonical: 'React Native', aliases: ['react native', 'react-native'], weight: 10 },
  { canonical: 'Flutter', aliases: ['flutter'], weight: 10 },
  { canonical: 'Redux', aliases: ['redux', 'redux toolkit', 'rtk'], weight: 8 },
  { canonical: 'Zustand', aliases: ['zustand'], weight: 8 },
  { canonical: 'TailwindCSS', aliases: ['tailwind', 'tailwindcss'], weight: 9 },
  { canonical: 'Webpack', aliases: ['webpack'], weight: 8 },
  { canonical: 'Vite', aliases: ['vite', 'vitejs'], weight: 8 },

  // Backend & Microservices (Weight: 10)
  { canonical: 'Node.js', aliases: ['nodejs', 'node.js', 'node'], weight: 10 },
  { canonical: 'NestJS', aliases: ['nestjs', 'nest.js', 'nest'], weight: 10 },
  { canonical: 'Express', aliases: ['expressjs', 'express.js', 'express'], weight: 9 },
  { canonical: 'Spring Boot', aliases: ['springboot', 'spring boot', 'spring framework'], weight: 10 },
  { canonical: 'Django', aliases: ['django', 'django rest framework', 'drf'], weight: 9 },
  { canonical: 'FastAPI', aliases: ['fastapi', 'fast api'], weight: 9 },
  { canonical: 'Flask', aliases: ['flask'], weight: 8 },
  { canonical: 'Laravel', aliases: ['laravel'], weight: 9 },
  { canonical: 'Gin', aliases: ['gin framework', 'gin-gonic'], weight: 8 },
  { canonical: 'Ruby on Rails', aliases: ['rails', 'ruby on rails'], weight: 8 },

  // Cloud & Containers (Weight: 10)
  { canonical: 'Kubernetes', aliases: ['k8s', 'kubernetes'], weight: 10 },
  { canonical: 'Docker', aliases: ['docker', 'dockerfile', 'docker compose'], weight: 10 },
  { canonical: 'AWS', aliases: ['aws', 'amazon web services'], weight: 10 },
  { canonical: 'Azure', aliases: ['azure', 'microsoft azure'], weight: 9 },
  { canonical: 'GCP', aliases: ['gcp', 'google cloud', 'google cloud platform'], weight: 9 },
  { canonical: 'Terraform', aliases: ['terraform', 'tf'], weight: 9 },
  { canonical: 'Ansible', aliases: ['ansible'], weight: 8 },
  { canonical: 'CI/CD', aliases: ['ci/cd', 'cicd', 'continuous integration'], weight: 9 },
  { canonical: 'GitHub Actions', aliases: ['github actions', 'gh actions'], weight: 9 },
  { canonical: 'GitLab CI', aliases: ['gitlab ci', 'gitlab-ci'], weight: 8 },
  { canonical: 'Helm', aliases: ['helm', 'helm chart'], weight: 8 },
  { canonical: 'Prometheus', aliases: ['prometheus'], weight: 8 },
  { canonical: 'Grafana', aliases: ['grafana'], weight: 8 },
  { canonical: 'Nginx', aliases: ['nginx'], weight: 8 },
  { canonical: 'Linux', aliases: ['linux', 'ubuntu', 'centos'], weight: 8 },

  // Databases & Caching (Weight: 10)
  { canonical: 'PostgreSQL', aliases: ['postgres', 'postgresql'], weight: 10 },
  { canonical: 'MySQL', aliases: ['mysql'], weight: 9 },
  { canonical: 'MongoDB', aliases: ['mongo', 'mongodb'], weight: 9 },
  { canonical: 'Redis', aliases: ['redis'], weight: 10 },
  { canonical: 'Elasticsearch', aliases: ['elasticsearch', 'elastic search'], weight: 9 },
  { canonical: 'DynamoDB', aliases: ['dynamodb', 'dynamo db'], weight: 9 },
  { canonical: 'Cassandra', aliases: ['cassandra'], weight: 8 },
  { canonical: 'SQLite', aliases: ['sqlite', 'sqlite3'], weight: 8 },
  { canonical: 'Oracle', aliases: ['oracle db', 'oracle database'], weight: 8 },
  { canonical: 'Supabase', aliases: ['supabase'], weight: 8 },
  { canonical: 'Firebase', aliases: ['firebase'], weight: 8 },

  // Architecture, Messaging & APIs (Weight: 9)
  { canonical: 'Kafka', aliases: ['kafka', 'apache kafka'], weight: 10 },
  { canonical: 'RabbitMQ', aliases: ['rabbitmq', 'rabbit mq'], weight: 9 },
  { canonical: 'GraphQL', aliases: ['graphql', 'apollo'], weight: 9 },
  { canonical: 'gRPC', aliases: ['grpc', 'protocol buffers', 'protobuf'], weight: 9 },
  { canonical: 'REST API', aliases: ['rest api', 'restful', 'restful api', 'rest apis'], weight: 9 },
  { canonical: 'WebSocket', aliases: ['websocket', 'websockets', 'socket.io'], weight: 8 },
  { canonical: 'Microservices', aliases: ['microservices', 'microservice'], weight: 9 },
  { canonical: 'System Design', aliases: ['system design', 'high level design', 'hld'], weight: 9 },
  { canonical: 'Event-Driven', aliases: ['event-driven', 'event driven', 'eda'], weight: 8 },
  { canonical: 'Serverless', aliases: ['serverless', 'aws lambda'], weight: 8 },
  { canonical: 'OAuth2', aliases: ['oauth', 'oauth2', 'oauth 2.0'], weight: 8 },
  { canonical: 'JWT', aliases: ['jwt', 'json web token'], weight: 8 },

  // Tools, Testing & Methodologies (Weight: 7)
  { canonical: 'Git', aliases: ['git', 'github', 'gitlab'], weight: 8 },
  { canonical: 'Jest', aliases: ['jest'], weight: 7 },
  { canonical: 'Cypress', aliases: ['cypress'], weight: 7 },
  { canonical: 'Playwright', aliases: ['playwright'], weight: 7 },
  { canonical: 'Agile', aliases: ['agile', 'scrum', 'kanban'], weight: 7 },
  { canonical: 'OOP', aliases: ['oop', 'object oriented programming'], weight: 7 },
  { canonical: 'SOLID', aliases: ['solid principles', 'solid'], weight: 7 },
]

// Common non-tech uppercase stop words to exclude from uppercase acronym matching
const EXCLUDED_STOPWORDS = new Set([
  'AND', 'THE', 'FOR', 'WITH', 'FROM', 'YOU', 'ARE', 'NOT', 'ALL', 'NEW', 'TOP',
  'JOB', 'GET', 'SET', 'OUT', 'CAN', 'BUT', 'WHO', 'HOW', 'WHY', 'WHAT', 'PER',
  'DAY', 'WEEK', 'YEAR', 'USD', 'VND', 'HCM', 'HN', 'OFF', 'EXP', 'SENIOR',
  'JUNIOR', 'LEAD', 'TECH', 'TEAM', 'WORK', 'TIME', 'LEVEL', 'SALARY', 'BENEFIT',
  'BONUS', 'REMOTE', 'HYBRID', 'ONSITE', 'FULLTIME', 'PARTTIME', 'DEGREE', 'BACHELOR',
  'MASTER', 'ENGLISH', 'VIETNAMESE', 'USE', 'THIS', 'THAT', 'HAVE', 'HAS', 'HAD',
  'WILL', 'WOULD', 'COULD', 'SHOULD', 'SOME', 'ANY', 'ONE', 'TWO', 'MORE', 'LESS',
  'MOST', 'ALSO', 'ONLY', 'INTO', 'OVER', 'THEN', 'THEM', 'THEIR', 'THEY', 'WHEN',
  'WHERE', 'WHICH', 'THERE', 'THESE', 'THOSE', 'EACH', 'BOTH', 'SUCH', 'LIKE',
  'YEU', 'CAU', 'KINH', 'NGHIEM', 'MUC', 'LUONG',
  'THU', 'VIEC', 'CHE', 'DO', 'BAO', 'HIEM', 'QUYEN', 'LOI', 'TUYEN', 'DUNG',
  'CONG', 'TY', 'MO', 'TA', 'CONG', 'VIEC', 'THAM', 'GIA', 'PHAT', 'TRIEN',
  'DU', 'AN', 'TOT', 'NGHIEP', 'DAI', 'HOC', 'GIAO', 'TIEP', 'TIENG', 'ANH',
  'DOC', 'HIEU', 'TAI', 'LIEU', 'PHONG', 'VAN', 'THIET', 'KE', 'HE', 'THONG',
  'QUAN', 'LY', 'TRUOC', 'SAU', 'CHUC', 'NANG', 'NEN', 'TANG', 'CO', 'SO',
  'DU', 'LIEU', 'MOI', 'TRUONG', 'LINH', 'HOAT', 'KHU', 'VUC', 'QUAN', 'TINH',
])

export interface ExtractOptions {
  maxKeywords?: number
  includeProperNouns?: boolean
}

/**
 * Fast string hash for caching extraction results
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return `${str.length}_${(hash >>> 0).toString(16)}`
}

export class JDKeywordExtractor {
  private cache = new Map<string, string[]>()
  private maxCacheEntries = 100

  /**
   * Normalizes a raw keyword to its canonical technical casing (e.g. "k8s" -> "Kubernetes").
   */
  public normalizeKeyword(raw: string): string {
    const trimmed = raw.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, '')
    if (!trimmed) return ''

    const lower = trimmed.toLowerCase()

    for (const item of TECH_DICTIONARY) {
      if (item.canonical.toLowerCase() === lower) {
        return item.canonical
      }
      if (item.aliases?.some((a) => a.toLowerCase() === lower)) {
        return item.canonical
      }
    }

    // Preserve original casing if it already has uppercase letters (e.g. SQS, BigQuery)
    if (/[A-Z]/.test(trimmed)) {
      return trimmed
    }

    // Capitalize first letter as fallback
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }

  /**
   * Extracts technical keywords from Job Description text with caching.
   */
  public extractKeywords(jdText: string, options?: ExtractOptions): string[] {
    if (!jdText || typeof jdText !== 'string' || !jdText.trim()) {
      return []
    }

    // Cap at 50,000 characters to prevent main thread lockup on massive text
    const trimmed = jdText.length > 50000 ? jdText.slice(0, 50000).trim() : jdText.trim()
    const cacheKey = hashString(trimmed)

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      const limit = options?.maxKeywords ?? 25
      return cached.slice(0, limit)
    }

    try {
      const extracted = this.performExtraction(trimmed, options)

      // Store in LRU cache
      if (this.cache.size >= this.maxCacheEntries) {
        const oldestKey = this.cache.keys().next().value
        if (oldestKey) this.cache.delete(oldestKey)
      }
      this.cache.set(cacheKey, extracted)

      const limit = options?.maxKeywords ?? 25
      return extracted.slice(0, limit)
    } catch (err) {
      console.warn('[JDKeywordExtractor] Error extracting keywords, returning empty fallback:', err)
      return []
    }
  }

  private performExtraction(text: string, options?: ExtractOptions): string[] {
    const matchedTerms = new Map<string, { canonical: string; weight: number; index: number }>()
    const lowerText = text.toLowerCase()

    // 1. Match from Curated Tech Dictionary
    for (const item of TECH_DICTIONARY) {
      const allPatterns = [item.canonical, ...(item.aliases || [])]

      for (const pattern of allPatterns) {
        const pLower = pattern.toLowerCase()
        let foundIdx = -1

        // Special handling for short words like "Go" to avoid matching lowercase common verb "go"
        if (pLower === 'go') {
          const goRegex = /\b(Go|Golang|golang)\b/
          const match = text.match(goRegex)
          if (match && match.index !== undefined) {
            foundIdx = match.index
          }
        } else if (/[+#./-]/.test(pLower)) {
          // Special character safe boundary (e.g. C++, C#, .NET, CI/CD)
          const escaped = pLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(?:^|[\\s,;()[\\]/])(${escaped})(?=[\\s,;()[\\]/]|$|[.:!?])`, 'i')
          const match = lowerText.match(regex)
          if (match && match.index !== undefined) {
            foundIdx = match.index
          }
        } else {
          // Standard word boundary
          const regex = new RegExp(`\\b${pLower}\\b`, 'i')
          const match = lowerText.match(regex)
          if (match && match.index !== undefined) {
            foundIdx = match.index
          }
        }

        if (foundIdx !== -1) {
          const existing = matchedTerms.get(item.canonical.toLowerCase())
          if (!existing || foundIdx < existing.index) {
            matchedTerms.set(item.canonical.toLowerCase(), {
              canonical: item.canonical,
              weight: item.weight,
              index: foundIdx,
            })
          }
          break // Found this item, move to next dictionary item
        }
      }
    }

    // 2. Extract Tech Acronyms (e.g. S3, EC2, IAM, SQS, SNS, VPC, CDN, SSO, RBAC, SDK, CLI)
    if (options?.includeProperNouns !== false) {
      const acronymRegex = /\b[A-Z0-9]{2,6}\b/g
      let match: RegExpExecArray | null
      while ((match = acronymRegex.exec(text)) !== null) {
        const word = match[0]
        if (!EXCLUDED_STOPWORDS.has(word) && !/^\d+$/.test(word)) {
          const lowerWord = word.toLowerCase()
          if (!matchedTerms.has(lowerWord)) {
            matchedTerms.set(lowerWord, {
              canonical: word,
              weight: 6,
              index: match.index,
            })
          }
        }
      }

      // 3. Extract PascalCase/CamelCase tech proper nouns (e.g. CloudFront, DynamoDB, OpenTelemetry)
      const pascalRegex = /\b([A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*)\b/g
      while ((match = pascalRegex.exec(text)) !== null) {
        const word = match[0]
        const lowerWord = word.toLowerCase()
        if (!matchedTerms.has(lowerWord)) {
          matchedTerms.set(lowerWord, {
            canonical: word,
            weight: 7,
            index: match.index,
          })
        }
      }
    }

    // Sort by weight DESC, then by earliest appearance in text ASC
    const sorted = Array.from(matchedTerms.values()).sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight
      }
      return a.index - b.index
    })

    return sorted.map((item) => item.canonical)
  }

  /**
   * Clears in-memory extraction cache (useful for tests or profile changes)
   */
  public clearCache(): void {
    this.cache.clear()
  }
}

export const jdKeywordExtractor = new JDKeywordExtractor()
