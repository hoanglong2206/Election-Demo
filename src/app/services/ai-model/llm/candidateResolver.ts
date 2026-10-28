import { getAllAIModels, getSavedAIModelId } from '../aiModels'
import { modelRegistryService } from '../model-registry'
import { settingsManager } from '../../settings'
import { smartModelRouter } from '../model-router'
import type { AIModelConfig, LLMProvider } from '../types'
import type { UniversalLLMOptions } from './types'

export interface ResolvedCandidatesResult {
  router: typeof smartModelRouter
  routingDecision?: ReturnType<typeof smartModelRouter.decide>
  selectedModel: AIModelConfig
  providerCandidates: AIModelConfig[]
  selectedModelId: string
}

export function resolveCandidates(options?: UniversalLLMOptions): ResolvedCandidatesResult {
  const explicitlySavedModelId = String(settingsManager.get('selectedLLM') || '').trim()
  const router = options?.routing?.router || smartModelRouter
  const routingDecision = options?.routing?.enabled === false
    ? undefined
    : router.decide({
        feature: options?.feature || 'general',
        sessionId: options?.sessionId,
        ...options?.routing,
        policy: options?.routing?.policy || settingsManager.get('modelRouterPolicy'),
        manualModelId: options?.modelId || options?.routing?.manualModelId,
      })
  const selectedModelId =
    options?.modelId?.trim() || routingDecision?.selectedModelId || explicitlySavedModelId || getSavedAIModelId()

  const fallbackModelConfig: AIModelConfig = {
    id: selectedModelId,
    name: selectedModelId.includes('70b')
      ? 'Llama 3.3 70B'
      : selectedModelId.includes('gemini')
      ? 'Google Gemini Flash'
      : selectedModelId.includes('gpt')
      ? 'OpenAI GPT-4o Mini'
      : selectedModelId,
    provider: (selectedModelId.includes('gemini')
      ? 'Google'
      : selectedModelId.includes('gpt')
      ? 'OpenAI'
      : 'Groq') as LLMProvider,
    contextWindow: '128k',
    tier: 'Free',
    badgeColor: '#10B981',
    pingMs: 0,
    description: '',
    recommendedFor: '',
    isLiveFromAPI: true,
  }

  const selectedModel: AIModelConfig =
    getAllAIModels().find((model) => model.id === selectedModelId) ||
    fallbackModelConfig

  const validModels = getAllAIModels().filter((model) =>
    model.isLiveFromAPI &&
    modelRegistryService.getModelById(model.id)?.capabilities.includes('text')
  )
  const fallbackCandidates: AIModelConfig[] = routingDecision?.fallbackChain
    ? routingDecision.fallbackChain
        .map((item) => validModels.find((model) => model.id === item.modelId))
        .filter((model): model is AIModelConfig => Boolean(model))
    : [selectedModel]

  const providerCandidates: AIModelConfig[] = validModels.length > 0
    ? [
        ...(fallbackCandidates.length > 0 ? fallbackCandidates : [selectedModel]),
        ...validModels.filter((model) =>
          model.provider === selectedModel.provider &&
          model.id !== selectedModel.id &&
          !routingDecision?.fallbackChain?.some((item) => item.modelId === model.id)
        ),
      ]
    : [selectedModel]

  return {
    router,
    routingDecision,
    selectedModel,
    providerCandidates,
    selectedModelId,
  }
}
