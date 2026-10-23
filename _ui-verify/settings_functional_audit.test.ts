import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import {
  settingsManager,
  getAppSettings,
  updateAppSettings,
  exportSanitizedSettings,
  validateSettings,
  DEFAULT_SETTINGS,
} from '../src/app/services/settings'
import {
  modelRegistryService,
  ModelRegistryService,
} from '../src/app/services/ai-model/model-registry'
import { GoogleProvider } from '../src/app/services/ai-model/model-registry/providers/googleProvider'
import { pricingRegistry } from '../src/app/services/usage-tracker/pricingRegistry'
import { usageTrackerService } from '../src/app/services/usage-tracker/usageTrackerService'
import {
  saveAIModelId,
  getSavedAIModelId,
  saveSTTEngineId,
  getSavedSTTEngineId,
} from '../src/app/services/ai-model/aiModels'
import { callUniversalLLM } from '../src/app/services/ai-model/copilot/universalLlm'

// Explicit test fixtures; production pricing starts with no rules.
pricingRegistry.registerRule({ provider: 'Google', modelMatch: 'gemini-1.5-flash', inputPerMillionTokens: 0.075, outputPerMillionTokens: 0.3, cachedInputPerMillionTokens: 0.01875 })
pricingRegistry.registerRule({ provider: 'OpenAI', modelMatch: 'gpt-4o-mini', inputPerMillionTokens: 0.15, outputPerMillionTokens: 0.6 })
pricingRegistry.registerRule({ provider: 'Groq', modelMatch: 'whisper', perMinuteAudioUsd: 0.00185 })

describe('Settings Page Full Functional Audit', () => {
  beforeEach(() => {
    settingsManager.resetToDefaults()
    usageTrackerService.resetLocalStatistics(true)
  })

  afterEach(() => {
    settingsManager.resetToDefaults()
    usageTrackerService.resetLocalStatistics(true)
  })

  // ── 1. Settings Schema Validation & Startup Persistence ───────────────────
  describe('Settings Schema Validation & Startup Persistence', () => {
    it('loads guaranteed valid defaults when localStorage is empty or null', () => {
      const s = getAppSettings()
      expect(s).toBeDefined()
      expect(s.version).toBe(1)
      expect(s.apiKeys.llmProvider).toBe('Auto')
      expect(s.engines.selectedLLM).toBe('no-model-configured')
      expect(s.engines.selectedSTT).toBe('ggml-tiny.bin')
      expect(s.audio.vadThreshold).toBe(0.8)
      expect(s.copilot.confidenceThreshold).toBe(0.65)
    })

    it('sanitizes and clamps invalid or out-of-range configuration values', () => {
      const corrupt = {
        apiKeys: { llmProvider: 'HackerLLM' },
        audio: { vadThreshold: 99.9, responseLang: 'latin' },
        copilot: { confidenceThreshold: -5, debounceMs: 999999 },
      }
      const validated = validateSettings(corrupt)
      expect(validated.apiKeys.llmProvider).toBe('Auto')
      expect(validated.audio.vadThreshold).toBe(0.8) // Clamped back to default
      expect(validated.audio.responseLang).toBe('bilingual')
      expect(validated.copilot.confidenceThreshold).toBe(0.65)
      expect(validated.copilot.debounceMs).toBe(500) // Clamped back to default
    })

    it('persists updates across reloads and notifies subscribers', () => {
      let notified = false
      const unsubscribe = settingsManager.subscribe((updated) => {
        if (updated.engines.selectedLLM === 'gpt-4o') {
          notified = true
        }
      })

      updateAppSettings({
        engines: { selectedLLM: 'gpt-4o' },
        audio: { vadThreshold: 0.6 },
      })

      const loaded = getAppSettings()
      expect(loaded.engines.selectedLLM).toBe('gpt-4o')
      expect(loaded.audio.vadThreshold).toBe(0.6)
      expect(notified).toBe(true)

      unsubscribe()
    })
  })

  // ── 2. Sensitive Credentials Security & Key Scrubbing ──────────────────────
  describe('API Credential Security & Secret Masking', () => {
    it('never exposes API keys in exportSanitizedSettings()', () => {
      settingsManager.set('groqKey', 'gsk_secret_production_key_12345')
      settingsManager.set('llmKey', 'AIzaSySecretGoogleGeminiKey_67890')

      const exported = exportSanitizedSettings()
      expect(JSON.stringify(exported)).not.toContain('gsk_secret')
      expect(JSON.stringify(exported)).not.toContain('AIzaSySecret')
      expect(exported.apiKeys?.groqKey).toBeUndefined()
      expect(exported.apiKeys?.llmKey).toBeUndefined()
    })

    it('sanitizes URL query parameter keys in network fetch error messages', async () => {
      class TestGoogleProvider extends GoogleProvider {
        public async testSafeFetch(url: string) {
          return this.safeFetch(url, {}, 500)
        }
      }

      const p = new TestGoogleProvider()
      const secretUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSy_MY_SUPER_SECRET_KEY'
      try {
        await p.testSafeFetch(secretUrl)
      } catch (err: any) {
        expect(err.message).toContain('key=***')
        expect(err.message).not.toContain('AIzaSy_MY_SUPER_SECRET_KEY')
      }
    })
  })

  // Provider model normalization is exercised with live API responses in integration checks.

  // ── 4. Capability Filtering & Deprecated Model Safety ───────────────────────
  describe('Capability Filtering & Deprecated Model Safety', () => {
    it('starts with no selectable models until a provider API returns models', () => {
      const visionModels = modelRegistryService.getMultimodalModels()
      expect(visionModels).toEqual([])
    })

    it('asks for an API key when validating a model with an empty registry', () => {
      const validation = modelRegistryService.validateSelectedModel('unknown-model', 'vision')
      expect(validation.valid).toBe(false)
      expect(validation.warning).toContain('thêm API Key')
      expect(validation.recommendedReplacement).toBeUndefined()
    })

    it('rejects an LLM call before network access when no model has been synchronized', async () => {
      const originalFetch = globalThis.fetch
      const fetchMock = mock(() => Promise.reject(new Error('fetch should not be called')))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      try {
        await expect(callUniversalLLM('test prompt')).rejects.toThrow(
          'Chưa có mô hình LLM khả dụng'
        )
        expect(fetchMock).not.toHaveBeenCalled()
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('safely handles deprecated / removed model previously stored in settings', () => {
      const validation = modelRegistryService.validateSelectedModel('deprecated-old-gpt-model-2023')
      expect(validation.valid).toBe(false)
      expect(validation.warning).toContain('thêm API Key')
      expect(validation.recommendedReplacement).toBeUndefined()
    })

    it('switching model immediately reflects in getSavedAIModelId() without restart', () => {
      saveAIModelId('gemini-2.0-flash')
      expect(getSavedAIModelId()).toBe('gemini-2.0-flash')

      saveAIModelId('gpt-4o')
      expect(getSavedAIModelId()).toBe('gpt-4o')
    })
  })

  // ── 5. Pricing Registry & Exact Cost Math ──────────────────────────────────
  describe('Pricing Registry Calculations & Token Math', () => {
    it('calculates exact cost for Gemini 1.5 Flash (uncached + cached tokens)', () => {
      // 800k uncached input ($0.075/M) + 200k cached input ($0.01875/M) + 500k output ($0.30/M)
      const cost = pricingRegistry.calculateCost('Google', 'gemini-1.5-flash', {
        inputTokens: 1000000,
        cachedTokens: 200000,
        outputTokens: 500000,
      })

      // 800,000 * 0.075 / 1M = 0.060
      // 200,000 * 0.01875 / 1M = 0.00375
      // 500,000 * 0.30 / 1M = 0.150
      // Total = 0.21375
      expect(cost.costStatus).toBe('calculated')
      expect(cost.costUsd).toBe(0.21375)
    })

    it('calculates exact cost for GPT-4o-mini', () => {
      // 100k input ($0.15/M) + 50k output ($0.60/M) = 0.015 + 0.030 = 0.045
      const cost = pricingRegistry.calculateCost('OpenAI', 'gpt-4o-mini', {
        inputTokens: 100000,
        outputTokens: 50000,
      })
      expect(cost.costStatus).toBe('calculated')
      expect(cost.costUsd).toBe(0.045)
    })

    it('calculates audio duration cost for Groq Whisper Cloud LPU (~$0.00185/min)', () => {
      // 120 seconds = 2 minutes -> 2 * 0.00185 = $0.0037
      const cost = pricingRegistry.calculateCost('Groq', 'whisper-large-v3-turbo', {
        audioDurationSeconds: 120,
      })
      expect(cost.costStatus).toBe('calculated')
      expect(cost.costUsd).toBe(0.0037)
    })

    it('returns unknown for OpenAI Whisper until a pricing rule is supplied', () => {
      const cost = pricingRegistry.calculateCost('OpenAI', 'whisper-1', {
        audioDurationSeconds: 60,
      })
      expect(cost.costStatus).toBe('unknown')
      expect(cost.costUsd).toBeNull()
    })

    it('treats Local Whisper and GGML offline models as 100% Free ($0.00)', () => {
      const cost = pricingRegistry.calculateCost('Local', 'ggml-base.bin', {
        audioDurationSeconds: 300,
        inputTokens: 5000,
      })
      expect(cost.costStatus).toBe('free')
      expect(cost.costUsd).toBe(0)
    })

    it('returns unknown status when rule is not found without crashing', () => {
      const cost = pricingRegistry.calculateCost('UnknownProvider', 'custom-obscure-model', {
        inputTokens: 1000,
      })
      expect(cost.costStatus).toBe('unknown')
      expect(cost.costUsd).toBeNull()
    })
  })

  // ── 6. Usage Tracker Aggregation, Month Boundaries & Budgeting ─────────────
  describe('Usage Tracker Aggregation, Month Boundaries & Budget', () => {
    it('creates exactly one usage record per trackUsage() invocation', () => {
      const rec = usageTrackerService.trackUsage({
        sessionId: 'session-test-01',
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'copilot_interview',
        inputTokens: 1000,
        outputTokens: 200,
      })

      expect(rec.id).toBeDefined()
      expect(rec.sessionId).toBe('session-test-01')
      expect(rec.costStatus).toBe('calculated')
      expect(rec.estimatedCostUsd).toBeGreaterThan(0)

      const all = usageTrackerService.getAllRecords()
      expect(all.length).toBe(1)
      expect(all[0].id).toBe(rec.id)
    })

    it('sanitizes NaN and negative token inputs gracefully', () => {
      const rec = usageTrackerService.trackUsage({
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'general',
        inputTokens: NaN,
        outputTokens: -100,
        audioDurationSeconds: NaN,
      })

      expect(rec.inputTokens).toBe(0)
      expect(rec.outputTokens).toBe(0)
      expect(rec.audioDurationSeconds).toBe(0)
    })

    it('aggregates monthly summary with breakdown by provider, model, and feature', () => {
      // 1. Google Copilot
      usageTrackerService.trackUsage({
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'copilot_interview',
        inputTokens: 10000,
        outputTokens: 2000,
      })

      // 2. Groq Whisper
      usageTrackerService.trackUsage({
        provider: 'Groq',
        model: 'whisper-large-v3',
        feature: 'stt',
        audioDurationSeconds: 180, // 3 mins
      })

      // 3. Local Whisper (Free)
      usageTrackerService.trackUsage({
        provider: 'Local',
        model: 'ggml-tiny.bin',
        feature: 'stt',
        audioDurationSeconds: 60,
      })

      const summary = usageTrackerService.getCurrentMonthSummary()
      expect(summary.totalRequests).toBe(3)
      expect(summary.totalInputTokens).toBe(10000)
      expect(summary.totalOutputTokens).toBe(2000)
      expect(summary.totalAudioDurationSeconds).toBe(240)
      expect(summary.totalEstimatedCostUsd).toBeGreaterThan(0)

      // Breakdowns
      expect(summary.byProvider.length).toBe(3) // Google, Groq, Local
      expect(summary.byFeature.some((f) => f.name === 'copilot_interview')).toBe(true)
      expect(summary.byFeature.some((f) => f.name === 'stt')).toBe(true)
    })

    it('filters usage accurately for a specific session ID', () => {
      usageTrackerService.trackUsage({
        sessionId: 'session-alpha',
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'copilot',
        inputTokens: 500,
        outputTokens: 100,
      })

      usageTrackerService.trackUsage({
        sessionId: 'session-beta',
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'copilot',
        inputTokens: 800,
        outputTokens: 200,
      })

      const alphaSummary = usageTrackerService.getSessionUsageSummary('session-alpha')
      expect(alphaSummary.totalRecords).toBe(1)
      expect(alphaSummary.totalInputTokens).toBe(500)
      expect(alphaSummary.totalOutputTokens).toBe(100)

      // Empty session ID safety
      const emptySummary = usageTrackerService.getSessionUsageSummary('')
      expect(emptySummary.totalRecords).toBe(0)
    })

    it('updates and persists budget settings with synchronized property names', () => {
      const updated = usageTrackerService.updateBudgetSettings({
        monthlyBudgetLimitUsd: 15.5,
        warningThresholdPercent: 85,
      })

      expect(updated.monthlyBudgetLimitUsd).toBe(15.5)
      expect(updated.monthlyLimitUsd).toBe(15.5) // Synchronized alias
      expect(updated.warningThresholdPercent).toBe(85)

      const loaded = usageTrackerService.getBudgetSettings()
      expect(loaded.monthlyBudgetLimitUsd).toBe(15.5)
      expect(loaded.monthlyLimitUsd).toBe(15.5)
    })

    it('resets local statistics only when confirmed is explicitly true', () => {
      usageTrackerService.trackUsage({
        provider: 'Google',
        model: 'gemini-1.5-flash',
        feature: 'copilot',
        inputTokens: 100,
        outputTokens: 50,
      })

      // Rejected without confirmation
      const denied = usageTrackerService.resetLocalStatistics(false)
      expect(denied).toBe(false)
      expect(usageTrackerService.getAllRecords().length).toBe(1)

      // Accepted with confirmation
      const confirmed = usageTrackerService.resetLocalStatistics(true)
      expect(confirmed).toBe(true)
      expect(usageTrackerService.getAllRecords().length).toBe(0)
      expect(usageTrackerService.getCurrentMonthSummary().totalRequests).toBe(0)
    })
  })

  // ── 7. End-to-End Workflow Verification ────────────────────────────────────
  describe('End-to-End Workflow: Configure Provider → Sync Models → Select Model → Request → Usage → Cost', () => {
    it('executes complete settings lifecycle successfully', async () => {
      // Step 1: Configure Provider
      updateAppSettings({
        apiKeys: {
          llmProvider: 'Google',
        },
      })
      expect(getAppSettings().apiKeys.llmProvider).toBe('Google')

      // Step 2: Sync Models from Registry
      const models = await modelRegistryService.syncAll()
      expect(models).toEqual([])
      expect(getSavedAIModelId()).toBe('no-model-configured')

      // Without provider credentials, the registry has no selectable model.
      // Usage from an unpriced/unavailable model is retained with unknown cost.
      const usageRec = usageTrackerService.trackUsage({
        sessionId: 'session-e2e-workflow',
        provider: 'Google',
        model: 'not-discovered-model',
        feature: 'copilot_interview',
        inputTokens: 1200,
        outputTokens: 350,
        cachedTokens: 400,
      })

      // Step 5: Verify Usage Record Data Integrity
      expect(usageRec.inputTokens).toBe(1200)
      expect(usageRec.outputTokens).toBe(350)
      expect(usageRec.cachedTokens).toBe(400)
      expect(usageRec.costStatus).toBe('unknown')
      expect(usageRec.estimatedCostUsd).toBeNull()

      // Step 6: Verify Monthly Summary Breakdown
      const summary = usageTrackerService.getCurrentMonthSummary()
      expect(summary.totalRequests).toBe(1)
      expect(summary.totalInputTokens).toBe(1200)
      expect(summary.totalOutputTokens).toBe(350)
      expect(summary.totalCachedTokens).toBe(400)
      expect(summary.totalEstimatedCostUsd).toBe(0)

      // Step 7: Verify Session Breakdown
      const sessionSummary = usageTrackerService.getSessionUsageSummary('session-e2e-workflow')
      expect(sessionSummary.totalRecords).toBe(1)
      expect(sessionSummary.totalEstimatedCostUsd).toBe(0)
    })
  })
})
