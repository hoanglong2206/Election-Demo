import type { LLMProviderOption } from '../../features/settings/types'
import type { ResponseLanguage } from '../ai-model/language'

export interface APIKeySettings {
  groqKey: string
  llmKey: string
  llmProvider: LLMProviderOption
}

export interface EngineSettings {
  selectedLLM: string
  selectedSTT: string
  sttLanguage: string
  selectedMultimodal?: string
}

export interface AudioSettings {
  audioDeviceId: string
  vadThreshold: number
  responseLang: ResponseLanguage
  autoPersonalize: boolean
}

export type TriggerMode = 'manual' | 'semi-auto' | 'auto'

export interface CopilotSettings {
  triggerMode: TriggerMode
  confidenceThreshold: number
  debounceMs: number
}

export interface AppSettingsSchema {
  version: number
  apiKeys: APIKeySettings
  engines: EngineSettings
  audio: AudioSettings
  copilot: CopilotSettings
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
  },
  copilot: {
    triggerMode: 'auto',
    confidenceThreshold: 0.65,
    debounceMs: 500,
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
  | 'triggerMode'
  | 'confidenceThreshold'
  | 'debounceMs'

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
    },
    copilot: {
      triggerMode,
      confidenceThreshold,
      debounceMs,
    },
  }
}
