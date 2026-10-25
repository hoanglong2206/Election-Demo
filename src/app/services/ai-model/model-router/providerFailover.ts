export type ProviderFailureType =
  | 'timeout'
  | 'connection_error'
  | 'rate_limit'
  | 'server_error'
  | 'authentication_error'
  | 'invalid_request'
  | 'content_error'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface ProviderFailure {
  type: ProviderFailureType
  provider: string
  status?: number
  message: string
  retryable: boolean
}

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  latencyBudgetMs: number
}

export interface ProviderHealthSnapshot {
  provider: string
  state: CircuitState
  failureRate: number
  averageLatencyMs: number
  consecutiveFailures: number
  recoveryTimeMs?: number
  lastFailureType?: ProviderFailureType
}

interface ProviderHealthRecord {
  state: CircuitState
  requests: number
  failures: number
  totalLatencyMs: number
  consecutiveFailures: number
  openedAt?: number
  lastFailureType?: ProviderFailureType
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 120,
  maxDelayMs: 700,
  latencyBudgetMs: 4500,
}

const DEFAULT_OPEN_AFTER_FAILURES = 3
const DEFAULT_COOLDOWN_MS = 15_000

export function classifyProviderError(error: unknown, provider: string): ProviderFailure {
  const candidate = error as { status?: number; code?: string; name?: string; message?: string } | null
  const message = String(candidate?.message || error || 'Provider request failed')
  const normalized = message.toLowerCase()
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined

  let type: ProviderFailureType = 'connection_error'
  if (candidate?.name === 'AbortError' || normalized.includes('timeout')) type = 'timeout'
  else if (status === 408) type = 'timeout'
  else if (status === 401 || status === 403 || normalized.includes('unauthorized') || normalized.includes('api key')) type = 'authentication_error'
  else if (status === 400 || status === 422 || normalized.includes('invalid request')) type = 'invalid_request'
  else if (status === 429 || normalized.includes('rate limit') || normalized.includes('too many requests')) type = 'rate_limit'
  else if (status !== undefined && status >= 500) type = 'server_error'
  else if (normalized.includes('content') || normalized.includes('safety') || normalized.includes('blocked')) type = 'content_error'
  else if (candidate?.code || normalized.includes('network') || normalized.includes('fetch')) type = 'connection_error'

  return {
    type,
    provider,
    status,
    message,
    retryable: type === 'timeout' || type === 'connection_error' || type === 'rate_limit' || type === 'server_error',
  }
}

export class ProviderCircuitBreaker {
  private readonly records = new Map<string, ProviderHealthRecord>()
  private readonly openAfterFailures: number
  private readonly cooldownMs: number

  constructor(
    openAfterFailures = DEFAULT_OPEN_AFTER_FAILURES,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  ) {
    this.openAfterFailures = openAfterFailures
    this.cooldownMs = cooldownMs
  }

  canRequest(provider: string): boolean {
    const record = this.getRecord(provider)
    if (record.state === 'CLOSED') return true
    if (record.state === 'OPEN' && Date.now() - (record.openedAt || 0) >= this.cooldownMs) {
      record.state = 'HALF_OPEN'
      return true
    }

    return record.state === 'HALF_OPEN'
  }

  recordSuccess(provider: string, latencyMs: number): void {
    const record = this.getRecord(provider)
    record.requests += 1
    record.totalLatencyMs += Math.max(0, latencyMs)
    record.consecutiveFailures = 0
    record.state = 'CLOSED'
    record.openedAt = undefined
  }

  recordFailure(provider: string, failure: ProviderFailure, latencyMs: number): void {
    const record = this.getRecord(provider)
    record.requests += 1
    record.failures += 1
    record.totalLatencyMs += Math.max(0, latencyMs)
    record.consecutiveFailures += 1
    record.lastFailureType = failure.type
    if (record.consecutiveFailures >= this.openAfterFailures) {
      record.state = 'OPEN'
      record.openedAt = Date.now()
    }
  }

  getSnapshot(provider: string): ProviderHealthSnapshot {
    const record = this.getRecord(provider)
    return {
      provider,
      state: record.state,
      failureRate: record.requests ? record.failures / record.requests : 0,
      averageLatencyMs: record.requests ? record.totalLatencyMs / record.requests : 0,
      consecutiveFailures: record.consecutiveFailures,
      recoveryTimeMs: record.openedAt ? Math.max(0, Date.now() - record.openedAt) : undefined,
      lastFailureType: record.lastFailureType,
    }
  }

  getAllSnapshots(): ProviderHealthSnapshot[] {
    return Array.from(this.records.keys()).map((provider) => this.getSnapshot(provider))
  }

  private getRecord(provider: string): ProviderHealthRecord {
    const existing = this.records.get(provider)
    if (existing) return existing
    const created: ProviderHealthRecord = {
      state: 'CLOSED',
      requests: 0,
      failures: 0,
      totalLatencyMs: 0,
      consecutiveFailures: 0,
    }
    this.records.set(provider, created)
    return created
  }
}

export async function waitForRetry(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): Promise<void> {
  const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1))
  await new Promise<void>((resolve) => setTimeout(resolve, delay))
}

export function getDefaultRetryPolicy(): RetryPolicy {
  return { ...DEFAULT_RETRY_POLICY }
}

export const providerCircuitBreaker = new ProviderCircuitBreaker()

export function getCircuitBreakerState(provider: string): ProviderHealthSnapshot {
  return providerCircuitBreaker.getSnapshot(provider)
}
