import { describe, it, expect } from 'bun:test'
import {
  classifyLatency,
  formatTokenRate,
  getBenchmarkErrorDetails,
} from '../benchmarkFormatters'

describe('benchmarkFormatters utility functions', () => {
  describe('classifyLatency', () => {
    it('returns excellent for latencies under 300ms', () => {
      const res = classifyLatency(150)
      expect(res.status).toBe('excellent')
      expect(res.label).toContain('Cực nhanh')
      expect(res.color).toBe('text-emerald-300')
    })

    it('returns good for latencies between 300ms and 800ms', () => {
      const res = classifyLatency(450)
      expect(res.status).toBe('good')
      expect(res.label).toContain('Ổn định')
      expect(res.color).toBe('text-amber-300')
    })

    it('returns slow for latencies above 800ms', () => {
      const res = classifyLatency(1200)
      expect(res.status).toBe('slow')
      expect(res.label).toContain('Chậm')
      expect(res.color).toBe('text-rose-300')
    })
  })

  describe('formatTokenRate', () => {
    it('handles 0 or missing tokensPerSec gracefully', () => {
      const res = formatTokenRate(0)
      expect(res.formatted).toBe('-- tok/s')
      expect(res.speedLabel).toBe('Chưa đo')
    })

    it('formats high speed > 80 tokens/sec', () => {
      const res = formatTokenRate(110, false)
      expect(res.formatted).toBe('110 tok/s')
      expect(res.speedLabel).toContain('Siêu tốc')
      expect(res.speedLabel).not.toContain('ước tính')
    })

    it('indicates estimate when isEstimate is true', () => {
      const res = formatTokenRate(95, true)
      expect(res.speedLabel).toContain('(ước tính)')
      expect(res.note).toBe('Ước tính')
    })
  })

  describe('getBenchmarkErrorDetails', () => {
    it('returns default fallback when no category provided', () => {
      const res = getBenchmarkErrorDetails(undefined)
      expect(res.title).toBe('Lỗi API')
      expect(res.advice).toBeNull()
    })

    it('returns specific advice for authentication error', () => {
      const res = getBenchmarkErrorDetails('authentication')
      expect(res.title).toContain('API key')
      expect(res.advice).toContain('Kiểm tra API key')
    })

    it('returns specific advice for quota error', () => {
      const res = getBenchmarkErrorDetails('quota')
      expect(res.title).toContain('Quota')
      expect(res.advice).toContain('billing')
    })

    it('returns specific advice for rate_limit error', () => {
      const res = getBenchmarkErrorDetails('rate_limit')
      expect(res.title).toContain('rate limit')
      expect(res.advice).toContain('reset')
    })
  })
})
