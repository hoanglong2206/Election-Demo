import { describe, it, expect, beforeEach } from 'bun:test'
import { TranslationService } from '../TranslationService'
import { TranslationLRUCache } from '../LRUCache'
import { TranslationRateLimiter } from '../RateLimiter'
import { TranslationCircuitBreaker } from '../CircuitBreaker'
import { detectLanguage } from '../languageDetector'
import { technicalGlossary } from '../glossary'
import { settingsManager } from '../../../settings'

describe('Language Detector', () => {
  it('detects accented Vietnamese and marks shouldTranslateToVi as false', () => {
    const res = detectLanguage('Xin chào các bạn, tôi là kỹ sư phần mềm.')
    expect(res.detectedLang).toBe('vi')
    expect(res.shouldTranslateToVi).toBe(false)
  })

  it('detects unaccented Vietnamese with common stopwords and avoids translating', () => {
    const res = detectLanguage('toi muon hoi ve du an nay va cac cong nghe duoc dung')
    expect(res.detectedLang).toBe('vi')
    expect(res.shouldTranslateToVi).toBe(false)
  })

  it('detects English questions and marks shouldTranslateToVi as true', () => {
    const res = detectLanguage('Can you explain the difference between processes and threads?')
    expect(res.detectedLang).toBe('en')
    expect(res.shouldTranslateToVi).toBe(true)
  })

  it('respects STT reported language code', () => {
    const resVi = detectLanguage('Hello', 'vi')
    expect(resVi.detectedLang).toBe('vi')
    expect(resVi.shouldTranslateToVi).toBe(false)

    const resEn = detectLanguage('System architecture', 'en')
    expect(resEn.detectedLang).toBe('en')
    expect(resEn.shouldTranslateToVi).toBe(true)
  })
})

describe('Technical Glossary Protection', () => {
  it('masks and unmasks technical terms accurately', () => {
    const original = 'We encountered a race condition in Kubernetes when scaling the pod.'
    const { maskedText, placeholderMap } = technicalGlossary.mask(original)

    expect(maskedText).not.toContain('race condition')
    expect(maskedText).not.toContain('Kubernetes')
    expect(placeholderMap.size).toBeGreaterThanOrEqual(2)

    // Simulate translation where non-glossary words become Vietnamese
    const translatedMock = maskedText
      .replace('We encountered a', 'Chúng tôi gặp phải')
      .replace('in', 'trong')
      .replace('when scaling the', 'khi mở rộng')

    const restored = technicalGlossary.unmask(translatedMock, placeholderMap)
    expect(restored).toContain('race condition')
    expect(restored).toContain('Kubernetes')
  })
})

describe('TranslationLRUCache', () => {
  it('normalizes keys by trimming, lowercasing, and collapsing whitespace', () => {
    const k1 = TranslationLRUCache.normalizeKey('  Hello   World  ', 'en', 'vi')
    const k2 = TranslationLRUCache.normalizeKey('hello world', 'en', 'vi')
    expect(k1).toBe(k2)
  })

  it('evicts the oldest item when capacity is exceeded', () => {
    const cache = new TranslationLRUCache(3)
    cache.set('k1', 'v1')
    cache.set('k2', 'v2')
    cache.set('k3', 'v3')

    expect(cache.get('k1')).toBe('v1') // k1 is now MRU; k2 becomes oldest
    cache.set('k4', 'v4') // evicts k2

    expect(cache.has('k2')).toBe(false)
    expect(cache.has('k1')).toBe(true)
    expect(cache.has('k3')).toBe(true)
    expect(cache.has('k4')).toBe(true)
  })

  it('computes accurate hit rate statistics', () => {
    const cache = new TranslationLRUCache(10)
    cache.set('k1', 'v1')
    cache.get('k1') // Hit
    cache.get('k2') // Miss
    const stats = cache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
    expect(stats.hitRate).toBe(50)
  })
})

describe('TranslationRateLimiter', () => {
  it('applies exponential backoff on 429 and respects Retry-After', () => {
    const limiter = new TranslationRateLimiter(60)
    expect(limiter.canProceed()).toBe(true)

    // 429 with Retry-After 5 seconds
    const delayMs = limiter.handle429(5)
    expect(delayMs).toBe(5000)
    expect(limiter.canProceed()).toBe(false)
    expect(limiter.getWaitTimeMs()).toBeGreaterThan(0)
  })

  it('resets backoff count on successful request', () => {
    const limiter = new TranslationRateLimiter(60)
    limiter.handle429()
    limiter.recordSuccess()
    const nextDelay = limiter.handle429() // back to base exponent
    expect(nextDelay).toBe(2000)
  })
})

describe('TranslationCircuitBreaker', () => {
  it('trips to OPEN state after consecutive failures', () => {
    const breaker = new TranslationCircuitBreaker({ failureThreshold: 3, cooldownPeriodMs: 1000 })
    expect(breaker.getState()).toBe('CLOSED')
    expect(breaker.canExecute()).toBe(true)

    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.getState()).toBe('CLOSED')

    breaker.recordFailure()
    expect(breaker.getState()).toBe('OPEN')
    expect(breaker.canExecute()).toBe(false)
  })

  it('transitions to HALF_OPEN after cooldown and resets on success', () => {
    const breaker = new TranslationCircuitBreaker({ failureThreshold: 2, cooldownPeriodMs: 50 })
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.getState()).toBe('OPEN')

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(breaker.getState()).toBe('HALF_OPEN')
        expect(breaker.canExecute()).toBe(true)

        breaker.recordSuccess()
        expect(breaker.getState()).toBe('CLOSED')
        resolve()
      }, 70)
    })
  })
})

describe('TranslationService Orchestrator', () => {
  let service: TranslationService

  beforeEach(() => {
    service = new TranslationService({
      batchWindowMs: 40,
      maxBatchSize: 5,
      concurrency: 2,
    })
    // Reset policy to balanced
    settingsManager.set('modelRouterPolicy', 'balanced')
  })

  it('batches lines arriving in the batch window into a single provider call', async () => {
    let callCount = 0
    let batchedTexts: string[] = []

    service.setMockProvider(async ({ texts }) => {
      callCount++
      batchedTexts = texts
      return {
        success: true,
        translations: texts.map((t) => `[VI] ${t}`),
      }
    })

    const p1 = new Promise<string>((resolve) => {
      service.enqueueLine({
        id: 1,
        text: 'How does indexing work in database?',
        onTranslate: (res) => resolve(res),
      })
    })

    const p2 = new Promise<string>((resolve) => {
      service.enqueueLine({
        id: 2,
        text: 'What is a distributed transaction?',
        onTranslate: (res) => resolve(res),
      })
    })

    const [r1, r2] = await Promise.all([p1, p2])

    expect(callCount).toBe(1)
    expect(batchedTexts.length).toBe(2)
    expect(r1).toContain('[VI] How does indexing work in database?')
    expect(r2).toContain('[VI] What is a distributed transaction?')
  })

  it('deduplicates identical lines in the same batch', async () => {
    let receivedTexts: string[] = []

    service.setMockProvider(async ({ texts }) => {
      receivedTexts = texts
      return {
        success: true,
        translations: texts.map((t) => `Dịch: ${t}`),
      }
    })

    const p1 = new Promise<string>((resolve) => {
      service.enqueueLine({
        id: 1,
        text: 'Explain deadlock',
        onTranslate: (res) => resolve(res),
      })
    })

    const p2 = new Promise<string>((resolve) => {
      service.enqueueLine({
        id: 2,
        text: 'Explain deadlock',
        onTranslate: (res) => resolve(res),
      })
    })

    const [r1, r2] = await Promise.all([p1, p2])

    // Only 1 unique string sent to provider
    expect(receivedTexts.length).toBe(1)
    expect(r1).toBe('Dịch: Explain deadlock')
    expect(r2).toBe('Dịch: Explain deadlock')
  })

  it('serves repeat requests directly from LRU cache without calling provider', async () => {
    let callCount = 0

    service.setMockProvider(async ({ texts }) => {
      callCount++
      return {
        success: true,
        translations: texts.map((t) => `Cached: ${t}`),
      }
    })

    const res1 = await service.translateDirect('What is optimistic locking?')
    expect(res1).toBe('Cached: What is optimistic locking?')
    expect(callCount).toBe(1)

    // Second call with same text (normalized)
    const res2 = await service.translateDirect('  what is optimistic locking?  ')
    expect(res2).toBe('Cached: What is optimistic locking?')
    expect(callCount).toBe(1) // Provider was NOT called again!

    const telemetry = service.getTelemetry()
    expect(telemetry.cacheHits).toBe(1)
  })

  it('strictly makes ZERO network requests when local-only mode is active', async () => {
    let networkCallAttempted = false

    service.setMockProvider(async ({ texts }) => {
      networkCallAttempted = true
      return { success: true, translations: texts }
    })

    // Set policy to local-only
    settingsManager.set('modelRouterPolicy', 'local-only')

    const result = await new Promise<{ text: string; status: string }>((resolve) => {
      service.enqueueLine({
        id: 99,
        text: 'Strictly confidential private code line',
        onTranslate: (text, status) => resolve({ text, status }),
      })
    })

    expect(networkCallAttempted).toBe(false)
    expect(result.status).toBe('untranslated')
    expect(result.text).toBe('Strictly confidential private code line')
  })

  it('strictly makes ZERO network requests when offline', async () => {
    let networkCallAttempted = false

    service.setMockProvider(async ({ texts }) => {
      networkCallAttempted = true
      return { success: true, translations: texts }
    })

    service.setIsOnlineOverride(() => false)

    const result = await new Promise<{ text: string; status: string }>((resolve) => {
      service.enqueueLine({
        id: 100,
        text: 'Network is disconnected',
        onTranslate: (text, status) => resolve({ text, status }),
      })
    })

    expect(networkCallAttempted).toBe(false)
    expect(result.status).toBe('untranslated')
  })

  it('falls back to original text and reports error status without crashing on 429', async () => {
    service.setMockProvider(async ({ texts }) => {
      return {
        success: false,
        translations: texts,
        error: 'Too Many Requests',
        status: 429,
        retryAfterSec: 2,
      }
    })

    const result = await new Promise<{ text: string; status: string }>((resolve) => {
      service.enqueueLine({
        id: 101,
        text: 'This request will hit 429',
        onTranslate: (text, status) => resolve({ text, status }),
      })
    })

    expect(result.status).toBe('error')
    expect(result.text).toBe('This request will hit 429')

    const telemetry = service.getTelemetry()
    expect(telemetry.errors429).toBe(1)
  })

  it('asynchronously patches line without blocking transcript commit', async () => {
    // Simulate UI transcript state
    let lines = [
      { id: 1, text: 'Initial line', translated: 'Initial line' },
      { id: 2, text: 'What is event driven architecture?', translated: 'What is event driven architecture?' },
    ]

    service.setMockProvider(async ({ texts }) => {
      // Simulate 50ms network delay
      await new Promise((r) => setTimeout(r, 50))
      return {
        success: true,
        translations: texts.map(() => `Kiến trúc hướng sự kiện là gì?`),
      }
    })

    // UI commits line 2 immediately with original text:
    expect(lines[1].translated).toBe('What is event driven architecture?')

    // Translation job is enqueued in background
    await new Promise<void>((resolve) => {
      service.enqueueLine({
        id: 2,
        text: lines[1].text,
        onTranslate: (translated, status) => {
          if (status === 'translated') {
            lines = lines.map((l) => (l.id === 2 ? { ...l, translated } : l))
          }
          resolve()
        },
      })
    })

    // Once translation resolves, line is patched
    expect(lines[1].translated).toBe('Kiến trúc hướng sự kiện là gì?')
  })

  it('times out and falls back to original text when provider exceeds timeoutMs', async () => {
    const timeoutService = new TranslationService({
      batchWindowMs: 20,
      timeoutMs: 50,
    })

    timeoutService.setMockProvider(async ({ texts }) => {
      // Delay longer than timeoutMs
      await new Promise((r) => setTimeout(r, 120))
      return {
        success: true,
        translations: texts.map((t) => `Delayed: ${t}`),
      }
    })

    const result = await new Promise<{ text: string; status: string }>((resolve) => {
      timeoutService.enqueueLine({
        id: 102,
        text: 'This operation should time out',
        onTranslate: (text, status) => resolve({ text, status }),
      })
    })

    expect(result.status).toBe('error')
    expect(result.text).toBe('This operation should time out')

    const telemetry = timeoutService.getTelemetry()
    expect(telemetry.timeouts).toBe(1)
  })
})
