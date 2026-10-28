export type LLMProviderOption = 'Auto' | 'Google' | 'OpenAI'
import type { ResponseLanguage } from '../ai-model/language'

export interface APIKeySettings {
  /** @deprecated Plaintext storage is disabled. Keys are stored securely in OS Credential Store (safeStorage). */
  groqKey?: string
  /** @deprecated Plaintext storage is disabled. Keys are stored securely in OS Credential Store (safeStorage). */
  llmKey?: string
  llmProvider: LLMProviderOption
}

export interface EngineSettings {
  selectedLLM: string
  selectedSTT: string
  sttLanguage: string
  selectedMultimodal?: string
}

export type SegmentationMode = 'sentence' | 'fixed'

export interface AudioSettings {
  audioDeviceId: string
  vadThreshold: number
  responseLang: ResponseLanguage
  autoPersonalize: boolean
  segmentationMode?: SegmentationMode
  silenceEndMs?: number
  maxSegmentMs?: number
}

export type TriggerMode = 'manual' | 'semi-auto' | 'auto'

export interface CopilotSettings {
  triggerMode: TriggerMode
  confidenceThreshold: number
  debounceMs: number
}

export type ModelRouterPolicy = 'fastest' | 'cheapest' | 'balanced' | 'highest-quality' | 'local-only'

export interface ModelRouterSettings {
  enabled: boolean
  policy: ModelRouterPolicy
}

export type TranslationProviderOption = 'google_translate' | 'deepl' | 'llm' | 'none'

export interface TranslationSettings {
  provider: TranslationProviderOption
  enabled: boolean
}

export interface AppSettingsSchema {
  version: number
  apiKeys: APIKeySettings
  engines: EngineSettings
  audio: AudioSettings
  copilot: CopilotSettings
  modelRouter: ModelRouterSettings
  translation: TranslationSettings
}

export const DEFAULT_SETTINGS: AppSettingsSchema = {
  version: 1,
  apiKeys: {
    groqKey: '',
    llmKey: '',
    llmProvider: 'Auto',
  },
  engines: {
    selectedLLM: 'no-model-configured',
    selectedSTT: 'ggml-tiny.bin',
    sttLanguage: 'auto',
    selectedMultimodal: '',
  },
  audio: {
    audioDeviceId: 'default-loopback',
    vadThreshold: 0.8,
    responseLang: 'bilingual',
    autoPersonalize: true,
    segmentationMode: 'sentence',
    silenceEndMs: 400,
    maxSegmentMs: 4500,
  },
  copilot: {
    triggerMode: 'auto',
    confidenceThreshold: 0.65,
    debounceMs: 500,
  },
  modelRouter: {
    enabled: true,
    policy: 'balanced',
  },
  translation: {
    provider: 'google_translate',
    enabled: true,
  },
}

export type FlatSettingsKey =
  | 'groqKey'
  | 'llmKey'
  | 'llmProvider'
  | 'selectedLLM'
  | 'selectedSTT'
  | 'sttLanguage'
  | 'selectedMultimodal'
  | 'audioDeviceId'
  | 'vadThreshold'
  | 'responseLang'
  | 'autoPersonalize'
  | 'segmentationMode'
  | 'silenceEndMs'
  | 'maxSegmentMs'
  | 'triggerMode'
  | 'confidenceThreshold'
  | 'debounceMs'
  | 'modelRouterEnabled'
  | 'modelRouterPolicy'
  | 'translationProvider'
  | 'translationEnabled'

/**
 * Validates, sanitizes and enforces strict types on a raw settings object.
 * Returns a guaranteed valid AppSettingsSchema.
 */
export function validateSettings(raw: unknown): AppSettingsSchema {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS }
  }

  const obj = raw as Record<string, any>

  // Helper for provider
  const validProviders: LLMProviderOption[] = ['Auto', 'Google', 'OpenAI']
  const rawProvider = obj.apiKeys?.llmProvider ?? obj.llmProvider
  const llmProvider: LLMProviderOption = validProviders.includes(rawProvider)
    ? rawProvider
    : 'Auto'

  // Helper for response language
  const validLangs: ResponseLanguage[] = ['bilingual', 'en', 'vi']
  const rawLang = obj.audio?.responseLang ?? obj.responseLang
  const responseLang: ResponseLanguage = validLangs.includes(rawLang)
    ? rawLang
    : 'bilingual'

  // Helper for VAD threshold
  const rawVad = obj.audio?.vadThreshold ?? obj.vadThreshold
  let vadThreshold = typeof rawVad === 'number' ? rawVad : parseFloat(String(rawVad))
  if (isNaN(vadThreshold) || vadThreshold < 0 || vadThreshold > 1) {
    vadThreshold = 0.8
  }

  // Helper for auto personalize
  const rawAuto = obj.audio?.autoPersonalize ?? obj.autoPersonalize
  const autoPersonalize = typeof rawAuto === 'boolean' ? rawAuto : rawAuto !== 'false'

  // Helper for Copilot trigger mode
  const validTriggerModes: TriggerMode[] = ['auto', 'semi-auto', 'manual']
  const rawTriggerMode = obj.copilot?.triggerMode ?? obj.triggerMode
  const triggerMode: TriggerMode = validTriggerModes.includes(rawTriggerMode)
    ? rawTriggerMode
    : 'auto'

  const rawConf = obj.copilot?.confidenceThreshold ?? obj.confidenceThreshold
  let confidenceThreshold = typeof rawConf === 'number' ? rawConf : parseFloat(String(rawConf))
  if (isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
    confidenceThreshold = 0.65
  }

  const rawDebounce = obj.copilot?.debounceMs ?? obj.debounceMs
  let debounceMs = typeof rawDebounce === 'number' ? rawDebounce : parseInt(String(rawDebounce), 10)
  if (isNaN(debounceMs) || debounceMs < 100 || debounceMs > 3000) {
    debounceMs = 500
  }

  const validRouterPolicies: ModelRouterPolicy[] = ['fastest', 'cheapest', 'balanced', 'highest-quality', 'local-only']
  const rawRouterPolicy = obj.modelRouter?.policy ?? obj.modelRouterPolicy
  const modelRouterPolicy: ModelRouterPolicy = validRouterPolicies.includes(rawRouterPolicy)
    ? rawRouterPolicy
    : DEFAULT_SETTINGS.modelRouter.policy
  const rawRouterEnabled = obj.modelRouter?.enabled ?? obj.modelRouterEnabled
  const modelRouterEnabled = typeof rawRouterEnabled === 'boolean' ? rawRouterEnabled : DEFAULT_SETTINGS.modelRouter.enabled

  return {
    version: 1,
    apiKeys: {
      groqKey:
        typeof (obj.apiKeys?.groqKey ?? obj.groqKey) === 'string'
          ? (obj.apiKeys?.groqKey ?? obj.groqKey).trim()
          : '',
      llmKey:
        typeof (obj.apiKeys?.llmKey ?? obj.llmKey) === 'string'
          ? (obj.apiKeys?.llmKey ?? obj.llmKey).trim()
          : '',
      llmProvider,
    },
    engines: {
      selectedLLM:
        typeof (obj.engines?.selectedLLM ?? obj.selectedLLM) === 'string' &&
        (obj.engines?.selectedLLM ?? obj.selectedLLM).trim()
          ? (obj.engines?.selectedLLM ?? obj.selectedLLM).trim()
          : DEFAULT_SETTINGS.engines.selectedLLM,
      selectedSTT:
        typeof (obj.engines?.selectedSTT ?? obj.selectedSTT) === 'string' &&
        (obj.engines?.selectedSTT ?? obj.selectedSTT).trim()
          ? (obj.engines?.selectedSTT ?? obj.selectedSTT).trim()
          : DEFAULT_SETTINGS.engines.selectedSTT,
      sttLanguage:
        typeof (obj.engines?.sttLanguage ?? obj.sttLanguage) === 'string'
          ? (obj.engines?.sttLanguage ?? obj.sttLanguage)
          : 'auto',
      selectedMultimodal:
        typeof (obj.engines?.selectedMultimodal ?? obj.selectedMultimodal) === 'string'
          ? (obj.engines?.selectedMultimodal ?? obj.selectedMultimodal).trim()
          : (DEFAULT_SETTINGS.engines.selectedMultimodal || ''),
    },
    audio: {
      audioDeviceId:
        typeof (obj.audio?.audioDeviceId ?? obj.audioDeviceId) === 'string' &&
        (obj.audio?.audioDeviceId ?? obj.audioDeviceId).trim()
          ? (obj.audio?.audioDeviceId ?? obj.audioDeviceId).trim()
          : DEFAULT_SETTINGS.audio.audioDeviceId,
      vadThreshold,
      responseLang,
      autoPersonalize,
      segmentationMode:
        obj.audio?.segmentationMode === 'fixed' || obj.segmentationMode === 'fixed'
          ? 'fixed'
          : 'sentence',
      silenceEndMs:
        typeof (obj.audio?.silenceEndMs ?? obj.silenceEndMs) === 'number'
          ? Math.max(200, Math.min(1500, obj.audio?.silenceEndMs ?? obj.silenceEndMs))
          : 400,
      maxSegmentMs:
        typeof (obj.audio?.maxSegmentMs ?? obj.maxSegmentMs) === 'number'
          ? Math.max(2000, Math.min(10000, obj.audio?.maxSegmentMs ?? obj.maxSegmentMs))
          : 4500,
    },
    copilot: {
      triggerMode,
      confidenceThreshold,
      debounceMs,
    },
    modelRouter: {
      enabled: modelRouterEnabled,
      policy: modelRouterPolicy,
    },
    translation: {
      provider:
        obj.translation?.provider === 'deepl' ||
        obj.translation?.provider === 'llm' ||
        obj.translation?.provider === 'none'
          ? obj.translation.provider
          : 'google_translate',
      enabled:
        typeof (obj.translation?.enabled ?? obj.translationEnabled) === 'boolean'
          ? (obj.translation?.enabled ?? obj.translationEnabled)
          : true,
    },
  }
}
