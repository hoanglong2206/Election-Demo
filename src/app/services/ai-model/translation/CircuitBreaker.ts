/**
 * Dedicated circuit breaker for Translation providers.
 *
 * Trips to OPEN after consecutive failures, immediately failing fast and
 * returning original text without flooding the failing upstream provider.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold?: number // e.g. 3 consecutive failures
  cooldownPeriodMs?: number // e.g. 30,000 ms before half-open probe
}

export class TranslationCircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private consecutiveFailures: number = 0
  private failureThreshold: number
  private cooldownPeriodMs: number
  private lastFailureTimeMs: number = 0

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 3
    this.cooldownPeriodMs = config.cooldownPeriodMs ?? 30000
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now()
      if (now - this.lastFailureTimeMs >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN'
      }
    }
    return this.state
  }

  public canExecute(): boolean {
    const currentState = this.getState()
    return currentState === 'CLOSED' || currentState === 'HALF_OPEN'
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0
    this.state = 'CLOSED'
  }

  public recordFailure(): void {
    this.consecutiveFailures++
    this.lastFailureTimeMs = Date.now()

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  public reset(): void {
    this.state = 'CLOSED'
    this.consecutiveFailures = 0
    this.lastFailureTimeMs = 0
  }
}
