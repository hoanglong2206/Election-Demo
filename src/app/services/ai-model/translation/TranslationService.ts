/**
 * Production-grade, privacy-respecting, resilient Translation Service.
 *
 * Architecture:
 * - Decoupled from STT worker thread: 100% asynchronous, never blocks transcript commits.
 * - LRU Cache (500 items) with key normalization.
 * - 300ms window batching & request deduplication.
 * - Concurrency limiter (max 2 active batches).
 * - Rate limiter with exponential backoff & Retry-After parsing on 429.
 * - Circuit breaker for automated failover.
 * - Zero network requests in local-only / offline mode.
 * - Pluggable providers: Google Cloud Translation, DeepL (via Main IPC), LLM (callUniversalLLM), None.
 * - Technical glossary preservation (Kubernetes, race condition, etc.).
 * - Telemetry & metrics: p50/p95 latency, cache hit rate, req/min, 429 count.
 */

import { settingsManager } from '../../settings'
import { usageTrackerService } from '../../usage-tracker'
import { callUniversalLLM } from '../copilot/universalLlm'
import { TranslationLRUCache } from './LRUCache'
import { TranslationRateLimiter } from './RateLimiter'
import { TranslationCircuitBreaker } from './CircuitBreaker'
import { detectLanguage } from './languageDetector'
import { technicalGlossary } from './glossary'
import { credentialsPort } from '@/infrastructure/ipc'
import type {
  TranslationProvider,
  TranslationStatus,
  TranslationJob,
  TranslationTelemetry,
  TranslationServiceOptions,
  DirectTranslateOptions,
} from './types'

export type CustomTranslationProviderFn = (params: {
  texts: string[]
  sourceLang?: string
  targetLang?: string
}) => Promise<{
  success: boolean
  translations: string[]
  error?: string
  status?: number
  retryAfterSec?: number
}>

export class TranslationService {
  private cache: TranslationLRUCache
  private rateLimiter: TranslationRateLimiter
  private circuitBreaker: TranslationCircuitBreaker
  private queue: TranslationJob[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private activeConcurrentRequests: number = 0

  // Configuration options
  private batchWindowMs: number
  private maxBatchSize: number
  private maxQueueSize: number
  private concurrency: number
  private timeoutMs: number

  // Telemetry metrics
  private totalRequests: number = 0
  private errors429: number = 0
  private timeouts: number = 0
  private droppedLines: number = 0
  private latenciesMs: number[] = []

  // Dependency injection hooks for unit testing
  private mockProviderFn?: CustomTranslationProviderFn
  private isOnlineOverride?: () => boolean

  constructor(options: TranslationServiceOptions = {}) {
    this.batchWindowMs = options.batchWindowMs ?? 300
    this.maxBatchSize = options.maxBatchSize ?? 10
    this.maxQueueSize = options.maxQueueSize ?? 25
    this.concurrency = Math.min(2, Math.max(1, options.concurrency ?? 2))
    this.timeoutMs = options.timeoutMs ?? 3500

    this.cache = new TranslationLRUCache(options.maxCacheSize ?? 500)
    this.rateLimiter = new TranslationRateLimiter(60)
    this.circuitBreaker = new TranslationCircuitBreaker({ failureThreshold: 3, cooldownPeriodMs: 30000 })
  }

  /**
   * Configures a mock provider for unit testing.
   */
  public setMockProvider(fn?: CustomTranslationProviderFn): void {
    this.mockProviderFn = fn
  }

  /**
   * Returns the configured translation timeout in milliseconds.
   */
  public getTimeoutMs(): number {
    return this.timeoutMs
  }

  /**
   * Configures an online status check override for unit testing.
   */
  public setIsOnlineOverride(fn?: () => boolean): void {
    this.isOnlineOverride = fn
  }

  private isOnline(): boolean {
    if (this.isOnlineOverride) return this.isOnlineOverride()
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine
    }
    return true
  }

  /**
   * Current active translation provider configured in settings or credentials.
   */
  public getActiveProvider(): TranslationProvider {
    const raw = settingsManager.get('translationProvider') as string
    if (raw === 'google_translate' || raw === 'deepl' || raw === 'llm' || raw === 'none') {
      return raw as TranslationProvider
    }
    // Default fallback to google_translate if in Electron
    return 'google_translate'
  }

  /**
   * True if local-only mode is active (strictly forbids sending transcript to external network).
   */
  public isLocalOnly(): boolean {
    const policy = settingsManager.get('modelRouterPolicy')
    return policy === 'local-only'
  }

  /**
   * Enqueues a transcript line for asynchronous background translation.
   * Completely decoupled from the STT commit path - returns immediately.
   */
  public enqueueLine(options: {
    id: number | string
    text: string
    sourceLang?: string
    targetLang?: string
    contextBefore?: string
    sttReportedLang?: string
    onTranslate: (translated: string, status: TranslationStatus) => void
  }): void {
    const trimmed = options.text.trim()
    if (!trimmed) {
      options.onTranslate('', 'untranslated')
      return
    }

    const targetLang = options.targetLang || 'vi'

    // 1. Language detection & diacritics check
    const langResult = detectLanguage(trimmed, options.sttReportedLang || options.sourceLang)
    if (!langResult.shouldTranslateToVi) {
      // Already Vietnamese or mixed text that shouldn't be mangled
      options.onTranslate(trimmed, 'skipped')
      return
    }

    // 2. Strict Privacy: Local-only or offline mode never calls external network
    if (this.isLocalOnly() || !this.isOnline() || this.getActiveProvider() === 'none') {
      options.onTranslate(trimmed, 'untranslated')
      return
    }

    // 3. LRU Cache lookup
    const cacheKey = TranslationLRUCache.normalizeKey(trimmed, options.sourceLang || 'auto', targetLang)
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) {
      options.onTranslate(cached, 'translated')
      return
    }

    // 4. Backlog management: drop oldest lines if queue grows too large (e.g. fast speaker / network lag)
    if (this.queue.length >= this.maxQueueSize) {
      const dropped = this.queue.shift()
      if (dropped) {
        this.droppedLines++
        dropped.onComplete?.(dropped.text, 'skipped')
      }
    }

    // 5. Add to batch queue
    this.queue.push({
      id: options.id,
      text: trimmed,
      sourceLang: options.sourceLang,
      targetLang,
      contextBefore: options.contextBefore,
      onComplete: options.onTranslate,
      timestamp: Date.now(),
    })

    // 6. Schedule batch window
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null
        this.flushQueue()
      }, this.batchWindowMs)
    }

    // If batch size reached max capacity, flush early
    if (this.queue.length >= this.maxBatchSize) {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer)
        this.batchTimer = null
      }
      this.flushQueue()
    }
  }

  /**
   * Direct translation helper maintaining signature compatibility with translateSTTText(text).
   */
  public async translateDirect(
    text: string,
    options: DirectTranslateOptions = {}
  ): Promise<string> {
    const trimmed = text.trim()
    if (!trimmed) return ''

    const targetLang = options.targetLang || 'vi'

    // Language detection
    const langResult = detectLanguage(trimmed, options.sttReportedLang || options.sourceLang)
    if (!langResult.shouldTranslateToVi) {
      return trimmed
    }

    // Local-only check
    if (this.isLocalOnly() || !this.isOnline() || this.getActiveProvider() === 'none') {
      return trimmed
    }

    // Cache check
    const cacheKey = TranslationLRUCache.normalizeKey(trimmed, options.sourceLang || 'auto', targetLang)
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    return new Promise((resolve) => {
      this.enqueueLine({
        id: Date.now() + Math.random(),
        text: trimmed,
        sourceLang: options.sourceLang,
        targetLang,
        contextBefore: options.contextBefore,
        sttReportedLang: options.sttReportedLang,
        onTranslate: (translated) => {
          resolve(translated || trimmed)
        },
      })
    })
  }

  /**
   * Flushes and executes pending jobs in the queue.
   */
  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return
    if (this.activeConcurrentRequests >= this.concurrency) return

    // Circuit breaker check
    if (!this.circuitBreaker.canExecute()) {
      const itemsToFail = this.queue.splice(0, this.queue.length)
      for (const item of itemsToFail) {
        item.onComplete?.(item.text, 'error')
      }
      return
    }

    // Rate limiter check
    if (!this.rateLimiter.canProceed()) {
      const waitMs = this.rateLimiter.getWaitTimeMs()
      if (waitMs > 0 && !this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.batchTimer = null
          this.flushQueue()
        }, Math.min(waitMs, 2000))
      }
      return
    }

    // Extract batch of jobs
    const batch = this.queue.splice(0, this.maxBatchSize)
    if (batch.length === 0) return

    this.activeConcurrentRequests++
    this.rateLimiter.recordRequest()
    this.totalRequests++

    const startTime = performance.now()

    try {
      // 1. Deduplicate strings within the batch
      const uniqueTexts: string[] = []
      const textToIndices = new Map<string, number[]>()

      batch.forEach((job, index) => {
        const norm = job.text.trim()
        if (!textToIndices.has(norm)) {
          textToIndices.set(norm, [index])
          uniqueTexts.push(norm)
        } else {
          textToIndices.get(norm)!.push(index)
        }
      })

      // 2. Protect technical glossary terms via placeholders
      const maskedList: string[] = []
      const placeholderMaps: Map<string, string>[] = []

      for (const text of uniqueTexts) {
        const { maskedText, placeholderMap } = technicalGlossary.mask(text)
        maskedList.push(maskedText)
        placeholderMaps.push(placeholderMap)
      }

      // 3. Dispatch to Provider with timeout protection
      let timer: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<{
        success: boolean
        translations: string[]
        error?: string
        status?: number
        retryAfterSec?: number
      }>((resolve) => {
        timer = setTimeout(() => {
          resolve({
            success: false,
            translations: maskedList,
            error: `Translation request timed out after ${this.timeoutMs}ms`,
            status: 408,
          })
        }, this.timeoutMs)
      })

      const providerPromise = this.executeProvider(maskedList, batch[0]?.sourceLang, batch[0]?.targetLang)
      const result = await Promise.race([providerPromise, timeoutPromise])
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      const durationMs = Math.round(performance.now() - startTime)
      this.latenciesMs.push(durationMs)
      if (this.latenciesMs.length > 200) this.latenciesMs.shift()

      if (result.success && result.translations.length === uniqueTexts.length) {
        this.circuitBreaker.recordSuccess()
        this.rateLimiter.recordSuccess()

        // 4. Restore technical glossary & cache results
        const finalTranslations: string[] = []
        for (let i = 0; i < uniqueTexts.length; i++) {
          const rawTranslation = result.translations[i] || uniqueTexts[i]
          const unmasked = technicalGlossary.unmask(rawTranslation, placeholderMaps[i])
          finalTranslations.push(unmasked)

          // Store in LRU Cache
          const cacheKey = TranslationLRUCache.normalizeKey(
            uniqueTexts[i],
            batch[0]?.sourceLang || 'auto',
            batch[0]?.targetLang || 'vi'
          )
          this.cache.set(cacheKey, unmasked)
        }

        // 5. Track cost
        this.recordUsage(batch[0]?.targetLang || 'vi', uniqueTexts.join(' ').length)

        // 6. Notify callbacks for all jobs
        for (let i = 0; i < uniqueTexts.length; i++) {
          const trans = finalTranslations[i]
          const jobIndices = textToIndices.get(uniqueTexts[i]) || []
          for (const idx of jobIndices) {
            batch[idx]?.onComplete?.(trans, 'translated')
          }
        }
      } else {
        // Handle provider error gracefully
        this.handleBatchError(result.error || 'Provider returned unsuccessful response', result.status, result.retryAfterSec, batch)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.handleBatchError(errorMessage, 500, undefined, batch)
    } finally {
      this.activeConcurrentRequests--
      // Continue processing remaining queue
      if (this.queue.length > 0) {
        this.flushQueue()
      }
    }
  }

  private handleBatchError(
    errorMessage: string,
    status?: number,
    retryAfterSec?: number,
    batch: TranslationJob[] = []
  ): void {
    this.circuitBreaker.recordFailure()

    if (status === 429) {
      this.errors429++
      this.rateLimiter.handle429(retryAfterSec)
    } else if (status === 408 || errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      this.timeouts++
    }

    // Fall back to original text without throwing to UI
    for (const job of batch) {
      job.onComplete?.(job.text, 'error')
    }
  }

  /**
   * Executes translation using mock provider, Electron IPC (Google/DeepL), or Universal LLM.
   */
  private async executeProvider(
    texts: string[],
    sourceLang?: string,
    targetLang = 'vi'
  ): Promise<{
    success: boolean
    translations: string[]
    error?: string
    status?: number
    retryAfterSec?: number
  }> {
    // 1. Mock provider (unit test injection)
    if (this.mockProviderFn) {
      return this.mockProviderFn({ texts, sourceLang, targetLang })
    }

    const provider = this.getActiveProvider()

    // 2. Official Google Cloud Translation or DeepL via Main IPC
    if (provider === 'google_translate' || provider === 'deepl') {
      if (credentialsPort.isSupported) {
        return credentialsPort.translateText({
          texts,
          sourceLang,
          targetLang,
          provider,
        })
      }
      // If IPC not available (browser dev mode), return original text
      return { success: false, translations: texts, error: 'IPC translateText unavailable in current environment' }
    }

    // 3. Small LLM via Universal LLM (feature: 'translate')
    if (provider === 'llm') {
      try {
        const prompt = `Dịch danh sách các câu tiếng Anh sau sang tiếng Việt cho phụ đề hội thoại (giữ nguyên số thứ tự và số dòng, mỗi câu một dòng):
${texts.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}`

        const res = await callUniversalLLM(prompt, {
          feature: 'translate',
          systemPrompt:
            'Bạn là chuyên gia dịch phụ đề hội thoại Anh-Việt chuẩn xác, súc tích. Chỉ trả về đúng danh sách câu đã dịch theo thứ tự "1. ...", "2. ...", không thêm lời dẫn giải.',
          temperature: 0.1,
          maxTokens: Math.max(100, texts.length * 50),
        })

        if (!res || !res.text) {
          return { success: false, translations: texts, error: 'LLM returned empty response' }
        }

        const lines = res.text
          .split('\n')
          .map((l) => l.replace(/^\d+[.:\-)]\s*/, '').trim())
          .filter(Boolean)

        if (lines.length >= texts.length) {
          return { success: true, translations: lines.slice(0, texts.length) }
        } else {
          // If count mismatch, map what we got and fill with original
          const padded = texts.map((t, idx) => lines[idx] || t)
          return { success: true, translations: padded }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        return { success: false, translations: texts, error: errorMsg || 'LLM translation failed' }
      }
    }

    // None provider
    return { success: true, translations: texts }
  }

  /**
   * Records usage metrics to Cost Tracker.
   */
  private recordUsage(targetLang: string, charCount: number): void {
    try {
      const provider = this.getActiveProvider()
      usageTrackerService.trackUsage({
        provider: provider === 'deepl' ? 'DeepL' : provider === 'google_translate' ? 'Google' : 'LLM',
        model: provider === 'deepl' ? 'deepl-v2' : provider === 'google_translate' ? 'google-translate-v2' : 'llm-translator',
        feature: 'translate',
        inputTokens: Math.max(1, Math.round(charCount / 4)),
        outputTokens: Math.max(1, Math.round(charCount / 4)),
        metadata: { charCount, targetLang },
      })
    } catch {
      // Ignore cost tracking errors in tests/non-critical flows
    }
  }

  /**
   * Telemetry snapshot for health monitoring and diagnostics.
   */
  public getTelemetry(): TranslationTelemetry {
    const stats = this.cache.getStats()
    const sorted = [...this.latenciesMs].sort((a, b) => a - b)
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0

    return {
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
      hitRatePercent: stats.hitRate,
      totalRequests: this.totalRequests,
      requestsPerMinute: this.rateLimiter.getRequestsInLastMinute(),
      latencyP50Ms: p50,
      latencyP95Ms: p95,
      errors429: this.errors429,
      timeouts: this.timeouts,
      droppedLines: this.droppedLines,
      pendingLines: this.queue.length,
    }
  }

  public clear(): void {
    this.cache.clear()
    this.queue = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    this.rateLimiter.reset()
    this.circuitBreaker.reset()
    this.totalRequests = 0
    this.errors429 = 0
    this.timeouts = 0
    this.droppedLines = 0
    this.latenciesMs = []
  }
}

export const translationService = new TranslationService()
