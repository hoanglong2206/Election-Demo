/**
 * Token bucket rate limiter with 429 exponential backoff and Retry-After header parsing.
 */

export class TranslationRateLimiter {
  private maxRequestsPerMinute: number
  private timestamps: number[] = []
  private backoffUntilMs: number = 0
  private consecutive429Count: number = 0

  constructor(maxRequestsPerMinute: number = 60) {
    this.maxRequestsPerMinute = maxRequestsPerMinute
  }

  /**
   * Checks whether a request can be dispatched right now.
   */
  public canProceed(): boolean {
    const now = Date.now()
    if (now < this.backoffUntilMs) {
      return false
    }

    // Clean up timestamps older than 60s
    this.timestamps = this.timestamps.filter((t) => now - t < 60000)
    return this.timestamps.length < this.maxRequestsPerMinute
  }

  /**
   * Records a dispatched request.
   */
  public recordRequest(): void {
    this.timestamps.push(Date.now())
  }

  /**
   * Resets 429 backoff upon receiving a successful response.
   */
  public recordSuccess(): void {
    this.consecutive429Count = 0
  }

  /**
   * Applies rate limit backoff when HTTP 429 is encountered.
   * Respects Retry-After header if provided, otherwise applies exponential backoff.
   */
  public handle429(retryAfterSec?: number): number {
    this.consecutive429Count++
    let delayMs: number

    if (typeof retryAfterSec === 'number' && retryAfterSec > 0) {
      delayMs = Math.min(60000, retryAfterSec * 1000)
    } else {
      // Exponential backoff: 2s, 4s, 8s, 16s, capped at 32s
      const exponent = Math.min(5, this.consecutive429Count)
      delayMs = Math.pow(2, exponent) * 1000
    }

    this.backoffUntilMs = Date.now() + delayMs
    return delayMs
  }

  /**
   * How many milliseconds to wait before next request is allowed.
   */
  public getWaitTimeMs(): number {
    const now = Date.now()
    if (now < this.backoffUntilMs) {
      return this.backoffUntilMs - now
    }

    this.timestamps = this.timestamps.filter((t) => now - t < 60000)
    if (this.timestamps.length >= this.maxRequestsPerMinute && this.timestamps.length > 0) {
      const oldest = this.timestamps[0]
      return Math.max(0, 60000 - (now - oldest))
    }

    return 0
  }

  public getRequestsInLastMinute(): number {
    const now = Date.now()
    this.timestamps = this.timestamps.filter((t) => now - t < 60000)
    return this.timestamps.length
  }

  public reset(): void {
    this.timestamps = []
    this.backoffUntilMs = 0
    this.consecutive429Count = 0
  }
}
