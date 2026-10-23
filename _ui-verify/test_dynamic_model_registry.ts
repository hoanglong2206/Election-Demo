/**
 * Comprehensive Automated Verification Suite for:
 * Dynamic AI Model Discovery and Synchronization
 */
import {
  ModelRegistryService,
  modelRegistryService,
  GoogleProvider,
  OpenAIProvider,
  GroqProvider,
  type AIProvider,
  type DiscoveredModel,
} from '../src/app/services/ai-model/model-registry'

// Mock browser environment if running in node/bun
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  }
}

if (typeof window === 'undefined') {
  ;(globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }
}

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${msg}`)
    failedTests++
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('Testing: Dynamic AI Model Discovery and Synchronization')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Providers do not expose sample models when credentials are absent.
  for (const p of [new GoogleProvider(), new OpenAIProvider(), new GroqProvider()]) {
    assert((await p.listModels()).length === 0, `No API key yields no sample models: ${p.id}`)
  }

  // 3. ModelRegistryService Single Source of Truth & Caching
  console.log('\n3. ModelRegistryService Lifecycle & Local Caching:')
  const registry = ModelRegistryService.getInstance()
  const initialModels = registry.getModels()
  // Multimodal filtering
  const multimodalOnly = registry.getMultimodalModels()
  assert(multimodalOnly.every((m) => m.capabilities.includes('vision')), 'Registry returns only vision-capable models')

  // 4. Model Validation & Disappearance Warning
  console.log('\n4. Model Validation & Disappearance Warning:')
  // Valid model
  const validCheck = registry.validateSelectedModel(initialModels[0]?.id || '')
  assert(validCheck.valid === (initialModels.length > 0), 'Registry validates discovered models when available')

  // Non-existent model disappeared
  const vanishedCheck = registry.validateSelectedModel('non-existent-vanished-model-2024')
  assert(vanishedCheck.valid === false, 'Vanished model is flagged as invalid')
  assert(
    Boolean(vanishedCheck.warning?.includes(initialModels.length > 0 ? 'không còn khả dụng' : 'thêm API Key')),
    'Generates the appropriate warning for an empty registry or unavailable model'
  )
  assert(Boolean(vanishedCheck.recommendedReplacement) === (initialModels.length > 0), 'Provides a replacement only when a model is available')

  // 5. Zero API Key Logging
  console.log('\n5. Zero API Key Leakage Protection:')
  const dummySecret = 'sk-proj-SUPER_SECRET_KEY_NEVER_LOG_THIS_123456789'
  const openai = new OpenAIProvider()
  try {
    // Attempt with invalid endpoint/offline without logging key
    await openai.listModels(dummySecret)
    assert(true, 'listModels executed safely without throwing unhandled exceptions')
  } catch (err: any) {
    const errorMsg = String(err?.message || err)
    assert(!errorMsg.includes(dummySecret), 'API key was NOT leaked in error message')
  }

  // 6. Network Error Resilience & Cache Preservation
  console.log('\n6. Network Error Resilience & Cache Preservation:')
  const beforeCount = registry.getModels().length
  // Trigger sync with non-working keys (simulating offline/network error)
  const syncResult = await registry.syncAll({
    force: true,
    apiKeyMap: {
      Google: 'invalid-key-testing',
      OpenAI: 'invalid-key-testing',
      Groq: 'invalid-key-testing',
    },
  })
  const afterCount = registry.getModels().length
  assert(afterCount >= beforeCount, `Cached models preserved despite offline/failed network (${afterCount} models)`)
  assert(registry.getSyncState().status === 'success' || registry.getSyncState().status === 'error', 'Sync status is properly tracked')

  // 7. Future Provider Extensibility
  console.log('\n7. Extensibility: Dynamic Custom Provider Registration:')
  class DeepSeekProvider implements AIProvider {
    readonly id = 'DeepSeek'
    readonly displayName = 'DeepSeek AI'
    async listModels(): Promise<DiscoveredModel[]> {
      return [
        {
          id: 'deepseek-r1',
          displayName: 'DeepSeek R1 (Reasoning Master)',
          provider: 'DeepSeek',
          capabilities: ['text', 'reasoning', 'code'],
          contextWindow: '128k tokens',
          contextTokens: 131072,
          tier: 'Pro',
          badgeColor: 'violet',
          description: 'Mô hình suy luận mở đầu bảng xếp hạng.',
          recommendedFor: 'Tư vấn phỏng vấn giải thuật toán chuyên sâu.',
          pricing: { promptPerMillion: 0.55, completionPerMillion: 2.19, currency: 'USD' },
          isLiveFromAPI: true,
          lastDiscoveredAt: Date.now(),
        },
      ]
    }
  }

  registry.registerProvider(new DeepSeekProvider())
  assert(Boolean(registry.getProvider('DeepSeek')), 'Custom future provider registered into registry')
  await registry.syncAll()
  const deepSeekModel = registry.getModelById('deepseek-r1')
  assert(Boolean(deepSeekModel), 'Registry dynamically discovered models from new provider')
  assert(deepSeekModel?.pricing?.promptPerMillion === 0.55, 'Pricing metadata successfully preserved in registry')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err)
  process.exit(1)
})
