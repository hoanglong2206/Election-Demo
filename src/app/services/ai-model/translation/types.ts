/**
 * Types and interfaces for the Translation Service subsystem.
 */

export type TranslationProvider = 'google_translate' | 'deepl' | 'llm' | 'none'

export type TranslationStatus = 'translated' | 'untranslated' | 'error' | 'skipped'

export interface TranslationJob {
  id: number | string
  text: string
  sourceLang?: string
  targetLang?: string
  contextBefore?: string
  onComplete?: (translated: string, status: TranslationStatus) => void
  onError?: (err: Error) => void
  timestamp: number
}

export interface TranslationTelemetry {
  cacheHits: number
  cacheMisses: number
  hitRatePercent: number
  totalRequests: number
  requestsPerMinute: number
  latencyP50Ms: number
  latencyP95Ms: number
  errors429: number
  timeouts: number
  droppedLines: number
  pendingLines: number
}

export interface TranslationServiceOptions {
  batchWindowMs?: number
  maxBatchSize?: number
  maxQueueSize?: number
  concurrency?: number
  maxCacheSize?: number
  timeoutMs?: number
}

export interface DirectTranslateOptions {
  sourceLang?: string
  targetLang?: string
  contextBefore?: string
  sttReportedLang?: string
}
