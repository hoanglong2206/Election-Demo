import { describe, expect, it } from 'bun:test'
import {
  buildStaticSystemPrefix,
  normalizePromptWhitespace,
} from '../promptTemplate'
import {
  computeProfileHash,
  buildDeterministicCandidateBrief,
  getOrCreateCandidateBrief,
  isFullContextNeeded,
  estimateTokens,
} from '../../context/candidateBrief'
import { TieredContextManager } from '../../context/contextManager'
import { SmartModelRouter } from '../../model-router/smartModelRouter'
import type { DiscoveredModel } from '../../model-registry'
import { UsageTrackerService } from '../../../usage-tracker/usageTrackerService'
import { PricingRegistry } from '../../../usage-tracker/pricingRegistry'

describe('Prompt Caching & Cost Optimization Suite', () => {
  const sampleCV = `
Nguyễn Văn An - Senior Fullstack Engineer
Email: an.nguyen@example.com | SĐT: 0901234567 | Hà Nội

TÓM TẮT CHUYÊN MÔN:
Hơn 6 năm kinh nghiệm phát triển hệ thống web quy mô lớn, vi dịch vụ phân tán, xử lý tải cao.
Thành thạo TypeScript, React, Next.js, Node.js, Go, PostgreSQL, Redis, Docker, Kubernetes, AWS.

KINH NGHIỆM LÀM VIỆC:
Senior Software Engineer - TechCorp Vietnam (2021 - Hiện tại)
- Thiết kế và triển khai kiến trúc microservices phục vụ hơn 2.5 triệu người dùng hoạt động hàng tháng.
- Tối ưu hóa truy vấn PostgreSQL và caching Redis đa tầng, giảm P99 latency từ 420ms xuống 65ms (giảm 84%).
- Tối ưu chi phí hạ tầng AWS EKS và CloudFront, tiết kiệm 35% chi phí vận hành hàng tháng.
- Dẫn dắt đội ngũ kỹ sư 8 thành viên, tổ chức code review và chuẩn hóa CI/CD pipeline với GitHub Actions.

Software Engineer - FinTech Solutions (2018 - 2021)
- Xây dựng hệ thống cổng thanh toán trực tuyến xử lý hơn 15,000 transactions/second (TPS).
- Tích hợp Kafka event streaming đảm bảo tính nhất quán dữ liệu (eventual consistency) giữa các dịch vụ tài chính.
- Phát triển giao diện quản trị bằng React và TypeScript với hơn 50 màn hình phức tạp.

DỰ ÁN TIÊU BIỂU:
1. Dự án E-commerce Core Engine: Nền tảng bán lẻ phân tán, tích hợp Elasticsearch tìm kiếm toàn văn sản phẩm.
2. Hệ thống Realtime Chat & Notification: Sử dụng WebSocket và Redis Pub/Sub phục vụ 100k kết nối đồng thời.

KỸ NĂNG:
- Ngôn ngữ: TypeScript, JavaScript, Go, Python, SQL
- Frontend: React, Next.js, TailwindCSS, Redux Toolkit, WebRTC
- Backend: Node.js, NestJS, Express, Go (Gin), PostgreSQL, MySQL, Redis, MongoDB
- DevOps & Cloud: Docker, Kubernetes, AWS, CI/CD, Prometheus, Grafana
`

  const sampleJD = `
Vị trí: Lead / Senior Backend Engineer
Công ty: Global FinTech Hub
Mô tả công việc:
- Thiết kế hệ thống vi dịch vụ xử lý giao dịch tài chính với độ trễ thấp và độ tin cậy 99.99%.
- Tối ưu hóa cơ sở dữ liệu phân tán PostgreSQL và Redis caching.
- Hướng dẫn và dẫn dắt các kỹ sư trẻ trong đội ngũ.
Yêu cầu:
- Ít nhất 5 năm kinh nghiệm với Node.js, TypeScript hoặc Go.
- Kinh nghiệm thực tế với Microservices, Kafka, Redis, Docker, Kubernetes.
- Kỹ năng giải quyết bài toán tải cao (high throughput, low latency).
`

  // ───────────────────────────────────────────────────────────────────────────
  // 1. BYTE-FOR-BYTE STATIC PREFIX STABILITY (SNAPSHOT IDENTITY)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Static Prefix Byte-for-Byte Stability', () => {
    it('generates 100% byte-for-byte identical prefix across multiple consecutive turns', () => {
      const cm = new TieredContextManager('test_session_stability')
      cm.setPermanentContext({
        cvSummary: sampleCV,
        jobDescription: sampleJD,
        role: 'Senior Backend Engineer',
        companyName: 'Global FinTech Hub',
        customInstructions: 'Tập trung nhấn mạnh số liệu và kiến trúc phân tán.',
      })

      const candidateContext = cm.getCandidateContext(false)
      const perm = cm.getPermanentContext()

      // Turn 1 prefix
      const prefixTurn1 = buildStaticSystemPrefix({
        candidateContext,
        role: perm.role,
        companyName: perm.companyName,
        customInstructions: perm.customInstructions,
      })

      // Turn 2 prefix (simulating next question 3 minutes later)
      const prefixTurn2 = buildStaticSystemPrefix({
        candidateContext,
        role: perm.role,
        companyName: perm.companyName,
        customInstructions: perm.customInstructions,
      })

      // Turn 3 prefix
      const prefixTurn3 = buildStaticSystemPrefix({
        candidateContext,
        role: perm.role,
        companyName: perm.companyName,
        customInstructions: perm.customInstructions,
      })

      // Exact equality: String value, length, character codes
      expect(prefixTurn1).toBe(prefixTurn2)
      expect(prefixTurn2).toBe(prefixTurn3)
      expect(prefixTurn1.length).toBe(prefixTurn2.length)

      for (let i = 0; i < prefixTurn1.length; i++) {
        expect(prefixTurn1.charCodeAt(i)).toBe(prefixTurn2.charCodeAt(i))
      }
    })

    it('contains no timestamps, session IDs, turn counters, or question text in static prefix', () => {
      const cm = new TieredContextManager('test_session_prefix')
      cm.setPermanentContext({
        cvSummary: sampleCV,
        jobDescription: sampleJD,
        role: 'Senior Backend Engineer',
      })

      const prefix = buildStaticSystemPrefix({
        candidateContext: cm.getCandidateContext(false),
        role: 'Senior Backend Engineer',
      })

      // No dynamic tokens
      expect(prefix).not.toMatch(/\d{4}-\d{2}-\d{2}/) // Date YYYY-MM-DD
      expect(prefix).not.toMatch(/turn_\d+/i)
      expect(prefix).not.toMatch(/session_[a-z0-9]+/i)
      expect(prefix).not.toMatch(/timestamp/i)
      expect(prefix).not.toMatch(/câu hỏi hiện tại/i)
    })

    it('normalizes line endings and whitespace deterministically', () => {
      const dirtyText = "Line 1   \r\nLine 2 \t\r\n\r\nLine 3   "
      const cleaned = normalizePromptWhitespace(dirtyText)
      expect(cleaned).toBe("Line 1\nLine 2\n\nLine 3")
      expect(cleaned).not.toContain('\r')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PROFILE HASH & INVALIDATION ON CV/JD CHANGE
  // ───────────────────────────────────────────────────────────────────────────
  describe('Profile Hash & Invalidation', () => {
    it('produces identical hash for identical CV and JD content', () => {
      const hash1 = computeProfileHash(sampleCV, sampleJD)
      const hash2 = computeProfileHash(sampleCV, sampleJD)
      expect(hash1).toBe(hash2)
    })

    it('changes hash and prefix when CV content changes', () => {
      const hashOriginal = computeProfileHash(sampleCV, sampleJD)
      const modifiedCV = sampleCV.replace('6 năm kinh nghiệm', '8 năm kinh nghiệm')
      const hashModified = computeProfileHash(modifiedCV, sampleJD)

      expect(hashOriginal).not.toBe(hashModified)

      const prefixOriginal = buildStaticSystemPrefix({ candidateContext: sampleCV })
      const prefixModified = buildStaticSystemPrefix({ candidateContext: modifiedCV })
      expect(prefixOriginal).not.toBe(prefixModified)
    })

    it('changes hash when JD changes', () => {
      const hash1 = computeProfileHash(sampleCV, sampleJD)
      const hash2 = computeProfileHash(sampleCV, sampleJD + '\nYêu cầu thêm: Kubernetes CKA certificate')
      expect(hash1).not.toBe(hash2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CANDIDATE BRIEF COMPRESSION & CITATIONS
  // ───────────────────────────────────────────────────────────────────────────
  describe('CandidateBrief Compression Service', () => {
    it('compresses ~2000 token CV down to ~600-900 tokens', () => {
      const rawTokens = estimateTokens(sampleCV + sampleJD)
      expect(rawTokens).toBeGreaterThan(600)

      const brief = buildDeterministicCandidateBrief({
        cvText: sampleCV,
        jdText: sampleJD,
        role: 'Senior Backend Engineer',
        companyName: 'Global FinTech Hub',
      })

      expect(brief.tokenEstimate).toBeLessThan(900)
      expect(brief.formattedBriefText.length).toBeLessThan((sampleCV + sampleJD).length)
      expect(brief.formattedBriefText).toContain('=== [CANDIDATE BRIEF:')
    })

    it('generates structured citation IDs ([EXP-x], [PRJ-x]) for grounding', () => {
      const brief = buildDeterministicCandidateBrief({
        cvText: sampleCV,
        jdText: sampleJD,
      })

      expect(brief.keyExperience.length).toBeGreaterThan(0)
      expect(brief.keyExperience[0].id).toBe('EXP-1')
      expect(brief.formattedBriefText).toContain('[-1]'.replace('-', 'EXP-'))

      if (brief.keyProjects.length > 0) {
        expect(brief.keyProjects[0].id).toBe('PRJ-1')
      }
    })

    it('caches brief in memory so repeated calls do not re-parse', () => {
      const brief1 = getOrCreateCandidateBrief({ cvText: sampleCV, jdText: sampleJD })
      const brief2 = getOrCreateCandidateBrief({ cvText: sampleCV, jdText: sampleJD })

      expect(brief1.hash).toBe(brief2.hash)
      expect(brief1.formattedBriefText).toBe(brief2.formattedBriefText)
    })

    it('correctly detects when a question needs full panoramic context', () => {
      expect(isFullContextNeeded('Hãy giới thiệu về bản thân em')).toBe(true)
      expect(isFullContextNeeded('Tell me about yourself and your journey')).toBe(true)
      expect(isFullContextNeeded('Tổng quan về sự nghiệp của bạn qua các năm')).toBe(true)

      // Specific technical questions do not need full context (use brief + top-k RAG)
      expect(isFullContextNeeded('Em tối ưu Redis caching như thế nào để giảm P99 latency?')).toBe(false)
      expect(isFullContextNeeded('Giải thích cơ chế eventual consistency khi dùng Kafka?')).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. SESSION AFFINITY (STICKY ROUTER)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Session Affinity (Sticky Router)', () => {
    it('sticks to the same model and provider across multiple copilot requests in the same session', () => {
      const mockModels: DiscoveredModel[] = [
        {
          id: 'llama-3.3-70b-versatile',
          displayName: 'Llama 3.3 70B',
          provider: 'Groq',
          isLiveFromAPI: true,
          capabilities: ['text'],
          contextWindow: '128k',
          contextTokens: 128000,
          tier: 'Pro',
          lastDiscoveredAt: Date.now(),
        },
        {
          id: 'gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          provider: 'OpenAI',
          isLiveFromAPI: true,
          capabilities: ['text'],
          contextWindow: '128k',
          contextTokens: 128000,
          tier: 'Pro',
          lastDiscoveredAt: Date.now(),
        },
      ]
      const router = new SmartModelRouter({}, () => mockModels)
      const sessionId = 'session_test_affinity_123'

      const decision1 = router.decide({
        feature: 'copilot_interview',
        sessionId,
      })

      const decision2 = router.decide({
        feature: 'copilot_interview',
        sessionId,
      })

      const decision3 = router.decide({
        feature: 'copilot_interview',
        sessionId,
      })

      expect(decision1.selectedModelId).toBe(decision2.selectedModelId)
      expect(decision2.selectedModelId).toBe(decision3.selectedModelId)
      expect(decision2.isSessionAffinity).toBe(true)
      expect(decision2.reason).toBe('session_affinity_cache_preserve')
      expect(decision3.isSessionAffinity).toBe(true)
    })

    it('clears session affinity cleanly when session ends', () => {
      const mockModels: DiscoveredModel[] = [
        {
          id: 'llama-3.3-70b-versatile',
          displayName: 'Llama 3.3 70B',
          provider: 'Groq',
          isLiveFromAPI: true,
          capabilities: ['text'],
          contextWindow: '128k',
          contextTokens: 128000,
          tier: 'Pro',
          lastDiscoveredAt: Date.now(),
        },
      ]
      const router = new SmartModelRouter({}, () => mockModels)
      const sessionId = 'session_test_affinity_clear'

      router.decide({ feature: 'copilot_interview', sessionId })
      expect(router.getSessionAffinity(sessionId)).not.toBeNull()

      router.clearSessionAffinity(sessionId)
      expect(router.getSessionAffinity(sessionId)).toBeNull()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. CACHED TOKENS MEASUREMENT & FALLBACK HANDLING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Usage Tracker & Cached Tokens Fallback', () => {
    it('correctly tracks cachedTokens and calculates cacheHitRate and savings', () => {
      const tracker = UsageTrackerService.getInstance()
      tracker.resetLocalStatistics(true)

      // Turn 1: Cache Miss (all input uncached)
      tracker.trackUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        feature: 'copilot_interview',
        inputTokens: 1200,
        outputTokens: 150,
        cachedTokens: 0,
      })

      let metrics = tracker.getCacheMetrics()
      expect(metrics.totalInputTokens).toBe(1200)
      expect(metrics.totalCachedTokens).toBe(0)
      expect(metrics.uncachedTokens).toBe(1200)
      expect(metrics.cacheHitRate).toBe(0)

      // Turn 2: Cache Hit (1024 tokens cached, 200 new uncached tokens)
      tracker.trackUsage({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        feature: 'copilot_interview',
        inputTokens: 1224,
        outputTokens: 140,
        cachedTokens: 1024,
      })

      metrics = tracker.getCacheMetrics()
      expect(metrics.totalInputTokens).toBe(2424)
      expect(metrics.totalCachedTokens).toBe(1024)
      expect(metrics.uncachedTokens).toBe(1400)
      // Hit rate: 1024 / 2424 = ~42.2% across both turns
      expect(metrics.cacheHitRate).toBeGreaterThan(40)
      expect(metrics.estimatedSavingsUsd).toBeGreaterThan(0)
    })

    it('falls back gracefully when provider does not report cachedTokens', () => {
      const tracker = UsageTrackerService.getInstance()
      tracker.resetLocalStatistics(true)

      // Provider without prompt caching support or without cachedTokens in response
      const record = tracker.trackUsage({
        provider: 'CustomLocalProvider',
        model: 'ggml-model',
        feature: 'copilot_interview',
        inputTokens: 950,
        outputTokens: 120,
        cachedTokens: undefined, // Provider omitted cachedTokens
      })

      expect(record.inputTokens).toBe(950)
      expect(record.outputTokens).toBe(120)
      expect(record.cachedTokens).toBeUndefined()

      const metrics = tracker.getCacheMetrics()
      expect(metrics.totalInputTokens).toBe(950)
      expect(metrics.totalCachedTokens).toBe(0)
      expect(metrics.uncachedTokens).toBe(950)
      expect(metrics.cacheHitRate).toBe(0)
    })

    it('pricing registry applies discount to cached tokens when available', () => {
      const pricing = PricingRegistry.getInstance()
      pricing.registerPricing({
        provider: 'OpenAI',
        modelMatch: 'gpt-4o-mini',
        inputPerMillionTokens: 0.15,
        outputPerMillionTokens: 0.60,
        cachedInputPerMillionTokens: 0.075, // 50% discount
        currency: 'USD',
      })

      // Without cache
      const uncachedCost = pricing.calculateCost({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 100,
        cachedTokens: 0,
      })

      // With cache (800 cached tokens out of 1000)
      const cachedCost = pricing.calculateCost({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 100,
        cachedTokens: 800,
      })

      expect(cachedCost.estimatedCostUsd).toBeDefined()
      expect(uncachedCost.estimatedCostUsd).toBeDefined()
      expect(cachedCost.estimatedCostUsd!).toBeLessThan(uncachedCost.estimatedCostUsd!)
    })
  })
})
