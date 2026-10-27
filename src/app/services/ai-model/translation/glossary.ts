/**
 * Technical Glossary Management & Term Protection.
 *
 * Ensures technical terms like "Kubernetes", "race condition", "deadlock",
 * "goroutine", etc., are preserved faithfully during translation without
 * awkward or broken literal translations.
 */

export const DEFAULT_TECHNICAL_GLOSSARY = [
  'Kubernetes',
  'Docker',
  'race condition',
  'deadlock',
  'goroutine',
  'microservices',
  'PostgreSQL',
  'Kafka',
  'Redis',
  'load balancer',
  'mutex',
  'sharding',
  'replica',
  'throughput',
  'latency',
  'garbage collection',
  'memory leak',
  'thread pool',
  'event loop',
  'dependency injection',
  'unit test',
  'integration test',
  'middleware',
  'payload',
  'endpoint',
  'webhook',
  'token',
  'hash map',
  'binary search',
  'async/await',
  'promise',
  'pull request',
  'merge conflict',
  'pipeline',
  'cluster',
  'pod',
  'deployment',
  'ingress',
  'service mesh',
  'GraphQL',
  'REST API',
  'WebSocket',
  'gRPC',
  'OAuth',
  'JWT',
  'SSL/TLS',
  'DNS',
  'CDN',
  'NoSQL',
  'MongoDB',
  'Elasticsearch',
  'RabbitMQ',
  'Prometheus',
  'Grafana',
  'CI/CD',
  'OpenTelemetry',
  'TypeScript',
  'Node.js',
  'React',
  'Next.js',
  'Vite',
]

export class TechnicalGlossary {
  private terms: Set<string>

  constructor(initialTerms: string[] = DEFAULT_TECHNICAL_GLOSSARY) {
    this.terms = new Set(initialTerms)
  }

  public addTerms(newTerms: string[]): void {
    for (const term of newTerms) {
      const trimmed = term.trim()
      if (trimmed.length > 2) {
        this.terms.add(trimmed)
      }
    }
  }

  public getTerms(): string[] {
    return Array.from(this.terms)
  }

  /**
   * Masks known glossary terms with placeholders: `__GLOSS_0__`
   * Returns masked text and mapping to restore later.
   */
  public mask(text: string): { maskedText: string; placeholderMap: Map<string, string> } {
    const placeholderMap = new Map<string, string>()
    let masked = text
    let index = 0

    // Sort terms by length descending to match longest phrases first (e.g. "race condition" before "condition")
    const sorted = Array.from(this.terms).sort((a, b) => b.length - a.length)

    for (const term of sorted) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi')

      if (regex.test(masked)) {
        const placeholder = `__GLOSS_${index}__`
        placeholderMap.set(placeholder, term)
        masked = masked.replace(regex, placeholder)
        index++
      }
    }

    return { maskedText: masked, placeholderMap }
  }

  /**
   * Restores placeholders `__GLOSS_0__` with original glossary terms.
   */
  public unmask(translatedText: string, placeholderMap: Map<string, string>): string {
    let unmasked = translatedText
    for (const [placeholder, originalTerm] of placeholderMap.entries()) {
      unmasked = unmasked.replaceAll(placeholder, originalTerm)
      // Also handle case where translation engine inserted spaces, e.g. `__ GLOSS_0 __`
      const relaxedRegex = new RegExp(`__\\s*${placeholder.slice(2, -2)}\\s*__`, 'g')
      unmasked = unmasked.replace(relaxedRegex, originalTerm)
    }
    return unmasked
  }
}

export const technicalGlossary = new TechnicalGlossary()
