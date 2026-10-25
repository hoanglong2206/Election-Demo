import { SmartModelRouter, type ModelRouterRequest } from '../src/app/services/ai-model/model-router'
import type { DiscoveredModel } from '../src/app/services/ai-model/model-registry'

const model = (overrides: Partial<DiscoveredModel>): DiscoveredModel => ({
  id: 'mock-fast',
  displayName: 'Mock Fast',
  provider: 'Groq',
  capabilities: ['text', 'fast'],
  contextWindow: '32k',
  contextTokens: 32000,
  tier: 'Free',
  pricing: { promptPerMillion: 0.1, completionPerMillion: 0.2 },
  isLiveFromAPI: true,
  lastDiscoveredAt: Date.now(),
  ...overrides,
})

const models = [
  model({ id: 'mock-fast', metadata: { latencyMs: 100 } }),
  model({
    id: 'mock-reasoning',
    displayName: 'Mock Reasoning',
    capabilities: ['text', 'reasoning', 'code'],
    tier: 'Pro',
    metadata: { latencyMs: 900 },
    pricing: { promptPerMillion: 2, completionPerMillion: 4 },
  }),
  model({ id: 'mock-vision', capabilities: ['text', 'vision'], metadata: { latencyMs: 400 } }),
]

const route = (request: Partial<ModelRouterRequest>) =>
  new SmartModelRouter({ monthlyBudgetLimitUsd: 20 }, () => models).decide({
    feature: 'copilot_interview',
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 500,
    ...request,
  })

const fast = route({ policy: 'fastest' })
if (fast.selectedModelId !== 'mock-fast') throw new Error('Fastest policy should select the low-latency model')

const reasoning = route({ intentType: 'system_design_problem', policy: 'highest-quality' })
if (reasoning.selectedModelId !== 'mock-reasoning') throw new Error('System design should select reasoning capability')

const vision = route({ requiredModality: 'vision' })
if (vision.selectedModelId !== 'mock-vision') throw new Error('Vision requests should filter to vision models')

const override = route({ manualModelId: 'mock-fast', policy: 'highest-quality' })
if (!override.isManualOverride || override.selectedModelId !== 'mock-fast') {
  throw new Error('Manual model override should win over automatic scoring')
}

const localOnly = route({ privacyRequirement: 'local-only' })
if (localOnly.selectedModelId !== null) throw new Error('Local-only policy must reject cloud-only candidates')

console.log('smart model router tests passed')
