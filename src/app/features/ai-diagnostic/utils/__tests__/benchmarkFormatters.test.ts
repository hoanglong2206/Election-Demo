import { describe, it, expect } from 'bun:test'
import {
  classifyLatency,
  formatTokenRate,
  getBenchmarkErrorDetails,
  getTacticalRecommendation,
} from '../benchmarkFormatters'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'

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

  describe('getTacticalRecommendation', () => {
    it('returns null if no benchmarkResult', () => {
      expect(getTacticalRecommendation(null)).toBeNull()
    })

    it('classifies fast model (<550ms) as speed king for live interviews', () => {
      const mockResult: AIBenchmarkResult = {
        modelId: 'test-fast',
        modelName: 'Fast Model',
        provider: 'Google',
        prompt: 'Hello',
        latencyMs: 380,
        ttftMs: 380,
        tokensPerSec: 95,
        response: 'Hello',
        status: 'excellent',
        timestamp: '12:00',
        isRealAPI: true,
      }
      const rec = getTacticalRecommendation(mockResult)
      expect(rec?.category).toBe('speed')
      expect(rec?.badgeTitle).toContain('Vua Tốc Độ')
      expect(rec?.suitabilityScore).toBeGreaterThanOrEqual(95)
    })

    it('classifies balanced model (550ms-1500ms) as balanced tech for coding', () => {
      const mockResult: AIBenchmarkResult = {
        modelId: 'test-balanced',
        modelName: 'Balanced Model',
        provider: 'OpenAI',
        prompt: 'Code please',
        latencyMs: 850,
        ttftMs: 850,
        tokensPerSec: 65,
        response: 'Code solution',
        status: 'good',
        timestamp: '12:00',
        isRealAPI: true,
      }
      const rec = getTacticalRecommendation(mockResult)
      expect(rec?.category).toBe('balanced')
      expect(rec?.badgeTitle).toContain('Cân Bằng')
      expect(rec?.headline).toContain('Live Coding')
    })

    it('classifies deep model (>1500ms) for system design with warning', () => {
      const mockResult: AIBenchmarkResult = {
        modelId: 'test-deep',
        modelName: 'Deep Model',
        provider: 'Anthropic',
        prompt: 'System architecture',
        latencyMs: 2200,
        ttftMs: 2200,
        tokensPerSec: 40,
        response: 'Deep architectural thought',
        status: 'slow',
        timestamp: '12:00',
        isRealAPI: true,
      }
      const rec = getTacticalRecommendation(mockResult)
      expect(rec?.category).toBe('deep')
      expect(rec?.badgeTitle).toContain('Lập Luận Chuyên Sâu')
      expect(rec?.riskWarning).toBeDefined()
    })

    it('identifies API error or quota issue as high risk', () => {
      const mockResult: AIBenchmarkResult = {
        modelId: 'test-error',
        modelName: 'Error Model',
        provider: 'Custom',
        prompt: 'Test',
        latencyMs: 100,
        tokensPerSec: 0,
        response: 'Error',
        status: 'slow',
        timestamp: '12:00',
        isRealAPI: false,
        errorCategory: 'rate_limit',
      }
      const rec = getTacticalRecommendation(mockResult)
      expect(rec?.category).toBe('risky')
      expect(rec?.badgeTitle).toContain('Cảnh Báo Rủi Ro')
      expect(rec?.suitabilityScore).toBeLessThan(30)
    })
  })
})
