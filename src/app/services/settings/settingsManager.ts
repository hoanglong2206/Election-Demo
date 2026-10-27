import {
  type AppSettingsSchema,
  type FlatSettingsKey,
  DEFAULT_SETTINGS,
  validateSettings,
} from './schema'
import { STORAGE_KEYS } from '../ai-model/storageKeys'

export const SETTINGS_STORAGE_KEY = 'meeting_copilot_app_settings'
const AUDIO_DEVICE_STORAGE_KEY = 'meeting_copilot_audio_device'

let cachedSettings: AppSettingsSchema | null = null

type SettingsListener = (settings: AppSettingsSchema) => void
const listeners = new Set<SettingsListener>()

/**
 * Migrates legacy scattered keys from localStorage into a single unified AppSettingsSchema.
 */
function migrateFromLegacyLocalStorage(): AppSettingsSchema {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    const rawUnified = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (rawUnified) {
      const parsed = JSON.parse(rawUnified)
      return validateSettings(parsed)
    }

    // Read scattered legacy keys if available
    const llmProvider = (localStorage.getItem(STORAGE_KEYS.LLM_PROVIDER) as any) || 'Auto'
    const selectedLLM = localStorage.getItem(STORAGE_KEYS.LLM_ENGINE) || DEFAULT_SETTINGS.engines.selectedLLM
    const selectedSTT = localStorage.getItem(STORAGE_KEYS.STT_ENGINE) || DEFAULT_SETTINGS.engines.selectedSTT
    const sttLanguage = localStorage.getItem(STORAGE_KEYS.STT_LANGUAGE) || 'auto'
    const audioDeviceId = localStorage.getItem(AUDIO_DEVICE_STORAGE_KEY) || DEFAULT_SETTINGS.audio.audioDeviceId
    const rawVad = localStorage.getItem(STORAGE_KEYS.VAD_THRESHOLD)
    const vadThreshold = rawVad ? parseFloat(rawVad) : DEFAULT_SETTINGS.audio.vadThreshold
    const responseLang = (localStorage.getItem(STORAGE_KEYS.RESPONSE_LANG) as any) || DEFAULT_SETTINGS.audio.responseLang
    const rawAuto = localStorage.getItem(STORAGE_KEYS.AUTO_PERSONALIZE)
    const autoPersonalize = rawAuto !== null ? rawAuto === 'true' : true

    const legacyMerged: AppSettingsSchema = {
      version: 1,
      apiKeys: {
        groqKey: '',
        llmKey: '',
        llmProvider,
      },
      engines: {
        selectedLLM,
        selectedSTT,
        sttLanguage,
      },
      audio: {
        audioDeviceId,
        vadThreshold: isNaN(vadThreshold) ? 0.8 : vadThreshold,
        responseLang,
        autoPersonalize,
      },
      copilot: {
        ...DEFAULT_SETTINGS.copilot,
      },
      modelRouter: {
        ...DEFAULT_SETTINGS.modelRouter,
      },
      translation: {
        ...DEFAULT_SETTINGS.translation,
      },
    }

    const validated = validateSettings(legacyMerged)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated))
    console.log('[SettingsManager] Successfully migrated scattered localStorage keys into unified AppSettingsSchema.')
    return validated
  } catch (err) {
    console.warn('[SettingsManager] Migration error, falling back to defaults:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Synchronizes unified schema values back to legacy localStorage keys
 * to ensure 100% backward compatibility with any direct callers.
 */
function syncLegacyKeys(settings: AppSettingsSchema): void {
  if (typeof localStorage === 'undefined') return
  try {
    // SECURITY: Never write plaintext API keys to localStorage!
    // Secret keys are kept encrypted in OS Credential Store (DPAPI/Keychain).
    localStorage.removeItem(STORAGE_KEYS.GROQ_KEY)
    localStorage.removeItem(STORAGE_KEYS.LLM_KEY)
    localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY)

    // Only non-secret settings are mirrored:
    localStorage.setItem(STORAGE_KEYS.LLM_PROVIDER, settings.apiKeys.llmProvider)
    localStorage.setItem(STORAGE_KEYS.LLM_ENGINE, settings.engines.selectedLLM)
    localStorage.setItem(STORAGE_KEYS.STT_ENGINE, settings.engines.selectedSTT)
    localStorage.setItem(STORAGE_KEYS.STT_LANGUAGE, settings.engines.sttLanguage)
    localStorage.setItem(AUDIO_DEVICE_STORAGE_KEY, settings.audio.audioDeviceId)
    localStorage.setItem(STORAGE_KEYS.VAD_THRESHOLD, String(settings.audio.vadThreshold))
    localStorage.setItem(STORAGE_KEYS.RESPONSE_LANG, settings.audio.responseLang)
    localStorage.setItem(STORAGE_KEYS.AUTO_PERSONALIZE, String(settings.audio.autoPersonalize))
  } catch {
    // Ignore storage quota warnings on legacy mirror
  }
}

function notifySettingsChanged(settings: AppSettingsSchema): void {
  listeners.forEach((fn) => {
    try {
      fn(settings)
    } catch (err) {
      console.warn('[SettingsManager] Listener error:', err)
    }
  })

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('app_settings_changed', { detail: settings }))
    } catch {}
  }
}

export class SettingsManager {
  public getSettings(): AppSettingsSchema {
    if (!cachedSettings) {
      cachedSettings = migrateFromLegacyLocalStorage()
    }
    return cachedSettings
  }

  public getAll(): AppSettingsSchema {
    return this.getSettings()
  }

  public reload(): AppSettingsSchema {
    cachedSettings = migrateFromLegacyLocalStorage()
    return cachedSettings
  }

  public updateSettings(partial: {
    apiKeys?: Partial<AppSettingsSchema['apiKeys']>
    engines?: Partial<AppSettingsSchema['engines']>
    audio?: Partial<AppSettingsSchema['audio']>
    copilot?: Partial<AppSettingsSchema['copilot']>
    modelRouter?: Partial<AppSettingsSchema['modelRouter']>
    translation?: Partial<AppSettingsSchema['translation']>
  }): AppSettingsSchema {
    const current = this.getSettings()

    const merged: AppSettingsSchema = {
      version: 1,
      apiKeys: {
        ...current.apiKeys,
        ...(partial.apiKeys || {}),
      },
      engines: {
        ...current.engines,
        ...(partial.engines || {}),
      },
      audio: {
        ...current.audio,
        ...(partial.audio || {}),
      },
      copilot: {
        ...current.copilot,
        ...(partial.copilot || {}),
      },
      modelRouter: {
        ...current.modelRouter,
        ...(partial.modelRouter || {}),
      },
      translation: {
        ...current.translation,
        ...(partial.translation || {}),
      },
    }

    const validated = validateSettings(merged)
    cachedSettings = validated

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated))
        syncLegacyKeys(validated)
      } catch (err) {
        console.warn('[SettingsManager] Failed to persist settings to localStorage:', err)
      }
    }

    notifySettingsChanged(validated)
    return validated
  }

  public get<K extends FlatSettingsKey>(key: K): any {
    const s = this.getSettings()
    switch (key) {
      case 'groqKey':
        return ''
      case 'llmKey':
        return ''
      case 'llmProvider':
        return s.apiKeys.llmProvider
      case 'selectedLLM':
        return s.engines.selectedLLM
      case 'selectedSTT':
        return s.engines.selectedSTT
      case 'sttLanguage':
        return s.engines.sttLanguage
      case 'selectedMultimodal':
        return s.engines.selectedMultimodal || ''
      case 'audioDeviceId':
        return s.audio.audioDeviceId
      case 'vadThreshold':
        return s.audio.vadThreshold
      case 'responseLang':
        return s.audio.responseLang
      case 'autoPersonalize':
        return s.audio.autoPersonalize
      case 'triggerMode':
        return s.copilot.triggerMode
      case 'confidenceThreshold':
        return s.copilot.confidenceThreshold
      case 'debounceMs':
        return s.copilot.debounceMs
      case 'modelRouterEnabled':
        return s.modelRouter.enabled
      case 'modelRouterPolicy':
        return s.modelRouter.policy
      case 'translationProvider':
        return s.translation?.provider || 'google_translate'
      case 'translationEnabled':
        return s.translation?.enabled ?? true
    }
  }

  public set<K extends FlatSettingsKey>(key: K, value: any): AppSettingsSchema {
    switch (key) {
      case 'groqKey':
      case 'llmKey':
        console.warn(
          `[SettingsManager] Refusing to set plaintext key '${key}'. API keys must be saved via window.api.credentials.saveApiKey.`
        )
        return this.getSettings()
      case 'llmProvider':
        return this.updateSettings({ apiKeys: { [key]: value } as any })
      case 'selectedLLM':
      case 'selectedSTT':
      case 'sttLanguage':
      case 'selectedMultimodal':
        return this.updateSettings({ engines: { [key]: value } as any })
      case 'audioDeviceId':
      case 'vadThreshold':
      case 'responseLang':
      case 'autoPersonalize':
      case 'segmentationMode':
      case 'silenceEndMs':
      case 'maxSegmentMs':
        return this.updateSettings({ audio: { [key]: value } as any })
      case 'triggerMode':
      case 'confidenceThreshold':
      case 'debounceMs':
        return this.updateSettings({ copilot: { [key]: value } as any })
      case 'modelRouterEnabled':
        return this.updateSettings({ modelRouter: { enabled: value } })
      case 'modelRouterPolicy':
        return this.updateSettings({ modelRouter: { policy: value } })
      case 'translationProvider':
        return this.updateSettings({ translation: { ...this.getSettings().translation, provider: value } })
      case 'translationEnabled':
        return this.updateSettings({ translation: { ...this.getSettings().translation, enabled: value } })
    }
    return this.getSettings()
  }

  public subscribe(listener: SettingsListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  public resetToDefaults(): AppSettingsSchema {
    cachedSettings = { ...DEFAULT_SETTINGS }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
        syncLegacyKeys(DEFAULT_SETTINGS)
      } catch {}
    }
    notifySettingsChanged(cachedSettings)
    return cachedSettings
  }
}

export const settingsManager = new SettingsManager()

// High-level exported helpers
export function getAppSettings(): AppSettingsSchema {
  return settingsManager.getSettings()
}

export function updateAppSettings(
  partial: Parameters<SettingsManager['updateSettings']>[0]
): AppSettingsSchema {
  return settingsManager.updateSettings(partial)
}

export function subscribeAppSettings(listener: SettingsListener): () => void {
  return settingsManager.subscribe(listener)
}

/**
 * Automatically migrates any legacy plaintext API keys from localStorage
 * into Electron Main's OS Credential Store, then immediately purges the plaintext.
 */
export async function migratePlaintextSecretsToSecureStore(): Promise<{
  migrated: boolean
  count: number
  warning?: string
}> {
  if (typeof window === 'undefined' || !window.api?.credentials) {
    return { migrated: false, count: 0 }
  }

  const isAvailable = await window.api.credentials.isAvailable()
  if (!isAvailable) {
    const warning =
      'Cảnh báo bảo mật: Hệ thống mã hóa OS Credential Store (DPAPI/Keychain) không khả dụng. Ứng dụng từ chối lưu khóa dạng plaintext.'
    console.warn('[Migration]', warning)

    const legacyGroq =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.GROQ_KEY) || '' : ''
    const legacyLlm =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEYS.LLM_KEY) ||
          localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) ||
          ''
        : ''

    if (legacyGroq || legacyLlm) {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(
              'Hệ thống mã hóa OS Credential Store (safeStorage) không khả dụng trên môi trường này. Để đảm bảo an toàn, bạn có muốn xóa toàn bộ API key plaintext cũ khỏi bộ nhớ tạm không?'
            )
          : true

      if (confirmed && typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.GROQ_KEY)
        localStorage.removeItem(STORAGE_KEYS.LLM_KEY)
        localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY)
      }
    }

    return { migrated: false, count: 0, warning }
  }

  let migratedCount = 0

  // 1. Check legacy scattered keys
  const legacyGroq =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.GROQ_KEY) || '' : ''
  const legacyLlm =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.LLM_KEY) ||
        localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) ||
        ''
      : ''

  // 2. Check unified settings schema
  const current = settingsManager.getSettings()
  const schemaGroq = current.apiKeys?.groqKey || ''
  const schemaLlm = current.apiKeys?.llmKey || ''

  const groqToMigrate = (legacyGroq || schemaGroq).trim()
  const llmToMigrate = (legacyLlm || schemaLlm).trim()

  if (groqToMigrate) {
    const res = await window.api.credentials.saveApiKey('groq', groqToMigrate)
    if (res.success) {
      migratedCount++
    }
  }

  if (llmToMigrate) {
    let targetProvider = 'gemini'
    if (llmToMigrate.startsWith('sk-')) targetProvider = 'openai'
    else if (llmToMigrate.startsWith('AIza')) targetProvider = 'gemini'
    else if (current.apiKeys.llmProvider && current.apiKeys.llmProvider !== 'Auto') {
      targetProvider = current.apiKeys.llmProvider.toLowerCase()
    }

    const res = await window.api.credentials.saveApiKey(targetProvider, llmToMigrate)
    if (res.success) {
      migratedCount++
    }
  }

  // 3. PURGE ALL PLAINTEXT KEYS FROM LOCALSTORAGE AND UNIFIED SETTINGS
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.GROQ_KEY)
    localStorage.removeItem(STORAGE_KEYS.LLM_KEY)
    localStorage.removeItem(STORAGE_KEYS.GEMINI_KEY)
  }

  if (schemaGroq || schemaLlm) {
    settingsManager.updateSettings({
      apiKeys: {
        groqKey: '',
        llmKey: '',
      },
    })
  }

  if (migratedCount > 0) {
    console.log(
      `[Migration] Successfully migrated ${migratedCount} plaintext API key(s) to OS Credential Store and purged from localStorage.`
    )
  }

  return { migrated: migratedCount > 0, count: migratedCount }
}

/**
 * Exports application settings guaranteed to be free of any credentials or secrets.
 */
export function exportSanitizedSettings(): Record<string, any> {
  const settings = settingsManager.getSettings()
  const copy = JSON.parse(JSON.stringify(settings))

  // Strip any secret fields
  if (copy.apiKeys) {
    delete copy.apiKeys.groqKey
    delete copy.apiKeys.llmKey
    delete copy.groqKey
    delete copy.llmKey
  }

  return copy
}
