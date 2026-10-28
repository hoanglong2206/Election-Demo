import type {
  AIProvider,
  AIProviderId,
  DiscoveredModel,
  ModelCapability,
  ModelValidationResult,
  RegistrySyncState,
} from './types'
import { GoogleProvider } from './providers/googleProvider'
import { OpenAIProvider } from './providers/openaiProvider'
import { GroqProvider } from './providers/groqProvider'
import { pricingRegistry } from '../../usage-tracker/pricingRegistry'
import { credentialsPort } from '@/infrastructure/ipc'

export const REGISTRY_STORAGE_KEYS = {
  MODELS_CACHE: 'meeting_copilot_discovered_models',
  LEGACY_CACHE: 'meeting_copilot_real_api_models',
  SYNC_META: 'meeting_copilot_models_sync_meta',
  VERIFIED_MODELS: 'meeting_copilot_verified_model_ids',
}

const verifiedModelKey = (provider: string, id: string) => `${provider.trim().toLowerCase()}:${id.trim()}`

export class ModelRegistryService {
  private static instance: ModelRegistryService | null = null

  private providers = new Map<AIProviderId, AIProvider>()
  private cachedModels: DiscoveredModel[] = []
  private syncState: RegistrySyncState = {
    status: 'idle',
    modelSource: null,
    lastSyncedAt: null,
    error: null,
    providerBreakdown: '',
    totalDiscovered: 0,
  }

  private subscribers = new Set<(state: RegistrySyncState, models: DiscoveredModel[]) => void>()
  private isInitialized = false
  private activeSyncPromise: Promise<DiscoveredModel[]> | null = null

  private constructor() {
    // Register standard providers
    this.registerProvider(new GoogleProvider())
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new GroqProvider())

    this.init()
  }

  public static getInstance(): ModelRegistryService {
    if (!ModelRegistryService.instance) {
      ModelRegistryService.instance = new ModelRegistryService()
    }
    return ModelRegistryService.instance
  }

  /**
   * Register or extend a new AI Provider dynamically
   */
  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
  }

  public getProvider(id: AIProviderId): AIProvider | undefined {
    return this.providers.get(id)
  }

  public getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Synchronously load cached models from localStorage without blocking UI
   */
  public init(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    try {
      if (typeof localStorage !== 'undefined') {
        const rawMeta = localStorage.getItem(REGISTRY_STORAGE_KEYS.SYNC_META)
        if (rawMeta) {
          const parsedMeta = JSON.parse(rawMeta)
          if (parsedMeta && typeof parsedMeta === 'object') {
            this.syncState = {
              status: 'idle',
              modelSource:
                parsedMeta.modelSource === 'api' ||
                parsedMeta.modelSource === 'cache' ||
                parsedMeta.modelSource === 'mixed'
                  ? parsedMeta.modelSource
                  : null,
              lastSyncedAt: parsedMeta.lastSyncedAt || null,
              error: null,
              providerBreakdown: parsedMeta.providerBreakdown || '',
              totalDiscovered: parsedMeta.totalDiscovered || 0,
            }
          }
        }

        const raw =
          localStorage.getItem(REGISTRY_STORAGE_KEYS.MODELS_CACHE) ||
          localStorage.getItem(REGISTRY_STORAGE_KEYS.LEGACY_CACHE)

        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedModels = parsed
              .map((m) => this.normalizeModel(m))
              .filter((model) => model.isLiveFromAPI)
          }
        }
      }
    } catch {
      // Gracefully continue
    }

    // Keep an empty registry empty until models are discovered from configured APIs.
  }

  /**
   * Read models synchronously from local cache
   */
  public getModels(filter?: {
    provider?: AIProviderId
    capability?: ModelCapability
  }): DiscoveredModel[] {
    let result = [...this.cachedModels]

    if (filter?.provider) {
      result = result.filter(
        (m) => m.provider.toLowerCase() === filter.provider!.toLowerCase()
      )
    }

    if (filter?.capability) {
      result = result.filter((m) => m.capabilities?.includes(filter.capability!))
    }

    return result
  }

  /**
   * Retrieve models specifically supporting multimodal vision
   */
  public getMultimodalModels(): DiscoveredModel[] {
    return this.getModels({ capability: 'vision' })
  }

  /**
   * Find model by ID
   */
  public getModelById(id: string): DiscoveredModel | undefined {
    return this.cachedModels.find((m) => m.id === id)
  }

  /**
   * Current synchronization status
   */
  public getSyncState(): RegistrySyncState {
    return { ...this.syncState }
  }

  /**
   * Validates if a selected model ID exists and meets capability requirements.
   * If not, warns and recommends an available replacement.
   */
  public validateSelectedModel(
    selectedId: string,
    requiredCapability?: ModelCapability
  ): ModelValidationResult {
    let models = this.cachedModels
    if (models.length === 0) {
      try {
        const raw =
          localStorage.getItem(REGISTRY_STORAGE_KEYS.MODELS_CACHE) ||
          localStorage.getItem(REGISTRY_STORAGE_KEYS.LEGACY_CACHE)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedModels = parsed.map((m) => this.normalizeModel(m))
            models = this.cachedModels
          }
        }
      } catch {}
    }

    if (models.length === 0) {
      return {
        valid: false,
        warning: 'Chưa có mô hình AI nào trong kho dữ liệu. Vui lòng thêm API Key và làm mới danh sách mô hình.',
      }
    }

    if (!selectedId) {
      const recommended = requiredCapability
        ? models.find((m) => m.capabilities?.includes(requiredCapability))
        : models[0]

      return {
        valid: false,
        warning: 'Chưa chọn mô hình nào.',
        recommendedReplacement: recommended,
      }
    }

    const current = models.find((m) => m.id === selectedId)

    if (!current) {
      // Model disappeared from API discovery
      const recommended = requiredCapability
        ? models.find((m) => m.capabilities?.includes(requiredCapability))
        : models[0]

      return {
        valid: false,
        warning: `Mô hình "${selectedId}" không còn khả dụng trên tài khoản hoặc API. Vui lòng chuyển sang mô hình khác.`,
        recommendedReplacement: recommended,
      }
    }

    if (requiredCapability && !current.capabilities?.includes(requiredCapability)) {
      // Model lacks required capability (e.g. vision for screenshot analysis)
      const recommended = models.find((m) => m.capabilities?.includes(requiredCapability))

      return {
        valid: false,
        warning: `Mô hình "${current.displayName || current.id}" không hỗ trợ tính năng ${requiredCapability} (ví dụ: thị giác hình ảnh). Vui lòng chọn mô hình Multimodal hỗ trợ Vision.`,
        recommendedReplacement: recommended,
      }
    }

    return {
      valid: true,
    }
  }

  /**
   * Synchronize models dynamically across all registered providers
   * Network errors will preserve cached models gracefully.
   * Concurrent requests are deduplicated via activeSyncPromise lock.
   */
  public async syncAll(options?: {
    force?: boolean
    apiKeyMap?: Record<string, string>
  }): Promise<DiscoveredModel[]> {
    if (this.activeSyncPromise && !options?.force && !options?.apiKeyMap) {
      return this.activeSyncPromise
    }

    this.activeSyncPromise = this.doSyncAll(options).finally(() => {
      this.activeSyncPromise = null
    })

    return this.activeSyncPromise
  }

  private async doSyncAll(options?: {
    force?: boolean
    apiKeyMap?: Record<string, string>
  }): Promise<DiscoveredModel[]> {
    this.syncState = {
      ...this.syncState,
      status: 'syncing',
      error: null,
    }
    this.notifySubscribers()

    // 1. In Electron, sync directly via secure Main Process IPC (which holds decrypted credentials)
    if (!options?.apiKeyMap && credentialsPort.isSupported) {
      try {
        const res = await credentialsPort.syncModels()
        if (res && Array.isArray(res.models)) {
          return this.populateFromElectronSync(res)
        }
      } catch (err: unknown) {
        console.warn('[ModelRegistry] Electron syncModels IPC failed, falling back to provider sync:', err)
      }
    }

    const apiModels: DiscoveredModel[] = []
    const cachedFallbackModels: DiscoveredModel[] = []
    const breakdown: string[] = []

    // Collect API keys safely without logging
    const keys = options?.apiKeyMap || (await this.resolveApiKeys())
    const configuredCount = Object.values(keys).filter(
      (k) => typeof k === 'string' && k.trim().length > 0
    ).length

    // If no API keys are provided/configured at all across all providers
    if (configuredCount === 0) {
      this.cachedModels = []
      this.syncState = {
        status: 'idle',
        modelSource: null,
        lastSyncedAt: Date.now(),
        error:
          'Chưa có API Key nào được cấu hình trong hệ thống. Vui lòng nhập Groq API Key hoặc LLM API Key (Gemini, OpenAI) ở trên để sử dụng mô hình AI.',
        providerBreakdown: 'Chưa có API Key',
        totalDiscovered: 0,
      }
      this.persistCache()
      this.notifySubscribers()
      return []
    }

    const providerTasks = Array.from(this.providers.values()).map(async (provider) => {
      const providerKey = (
        keys[provider.id] ||
        keys[provider.id.toLowerCase()] ||
        (provider.id === 'Google' ? keys['gemini'] : undefined) ||
        ''
      ).trim()

      // If provider has no key, do NOT query and do NOT retain cached models for it!
      if (!providerKey) {
        return
      }

      try {
        const models = await provider.listModels(providerKey)
        if (Array.isArray(models) && models.length > 0) {
          apiModels.push(...models)
          breakdown.push(`${provider.displayName}: ${models.length}`)
        } else {
          // Provider has a configured key, but returned empty list: retain its cached models
          cachedFallbackModels.push(
            ...this.cachedModels.filter(
              (m) => m.provider.toLowerCase() === provider.id.toLowerCase()
            )
          )
        }
      } catch {
        // Provider has a configured key, but network call failed: retain its cached models
        const existingProviderModels = this.cachedModels.filter(
          (m) => m.provider.toLowerCase() === provider.id.toLowerCase()
        )
        if (existingProviderModels.length > 0) {
          cachedFallbackModels.push(...existingProviderModels)
        }
      }
    })

    await Promise.allSettled(providerTasks)

    // API listing endpoints may include retired, inaccessible, or non-chat models.
    // Only models explicitly confirmed in the Settings availability check may enter the registry.
    const verifiedModelIds = this.getVerifiedModelIds()
    const discoveredCount = apiModels.length
    const verifiedApiModels = apiModels.filter((model) => verifiedModelIds.has(verifiedModelKey(model.provider, model.id)))
    apiModels.splice(0, apiModels.length, ...verifiedApiModels)
    const verifiedCachedFallbacks = cachedFallbackModels.filter((model) => verifiedModelIds.has(verifiedModelKey(model.provider, model.id)))
    cachedFallbackModels.splice(0, cachedFallbackModels.length, ...verifiedCachedFallbacks)

    const now = Date.now()

    if (apiModels.length > 0 || cachedFallbackModels.length > 0) {
      // Prefer fresh API results where an ID exists in both sources.
      const uniqueMap = new Map<string, DiscoveredModel>()
      for (const m of apiModels) {
        uniqueMap.set(m.id, m)
      }
      for (const m of cachedFallbackModels) {
        if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m)
      }
      this.cachedModels = Array.from(uniqueMap.values())
      // Only trust pricing returned by this sync; cached model metadata may
      // contain estimates created by older app versions.
      this.registerModelPricing(apiModels)

      if (apiModels.length === 0) {
        const cacheCount = this.cachedModels.length
        this.syncState = {
          ...this.syncState,
          status: 'error',
          modelSource: cacheCount > 0 ? 'cache' : null,
          error:
            cacheCount > 0
              ? `Không nhận được model đã xác nhận từ API. Đang dùng ${cacheCount} model từ cache; hãy kiểm tra API key/kết nối hoặc xác nhận model trong Settings.`
              : discoveredCount > 0
              ? `API liệt kê ${discoveredCount} model nhưng chưa có model nào được xác nhận khả dụng. Hãy kiểm tra model trong Settings trước khi đồng bộ.`
              : 'API không trả về model nào. Hãy kiểm tra API key, quyền truy cập model và kết nối mạng rồi thử đồng bộ lại.',
          providerBreakdown: cacheCount > 0 ? `Cache: ${cacheCount} model` : discoveredCount > 0 ? 'Chưa xác nhận model khả dụng' : 'API trả về 0 model',
          totalDiscovered: cacheCount,
        }
      } else {
        const cacheCount = this.cachedModels.filter(
          (model) => !apiModels.some((apiModel) => apiModel.id === model.id)
        ).length
        this.syncState = {
          ...this.syncState,
          status: 'success',
          modelSource: cacheCount > 0 ? 'mixed' : 'api',
          lastSyncedAt: now,
          error: null,
          providerBreakdown: [
            ...breakdown,
            ...(cacheCount > 0 ? [`Cache: ${cacheCount} model`] : []),
          ].join(', '),
          totalDiscovered: this.cachedModels.length,
        }
      }

      this.persistCache()
    } else {
      // If completely failed, retain previous cached models only if keys were configured
      this.cachedModels = []
      this.syncState = {
        ...this.syncState,
        status: 'idle',
        modelSource: null,
        error: discoveredCount > 0
          ? `API liệt kê ${discoveredCount} model nhưng chưa có model nào được xác nhận khả dụng. Hãy kiểm tra model trong Settings trước khi đồng bộ.`
          : 'API không trả về model nào. Hãy kiểm tra API key hoặc kết nối mạng rồi thử lại.',
        providerBreakdown: discoveredCount > 0 ? 'Chưa xác nhận model khả dụng' : 'API trả về 0 model',
        totalDiscovered: 0,
        lastSyncedAt: now,
      }
      this.persistCache()
    }

    this.notifySubscribers()
    return [...this.cachedModels]
  }

  /**
   * Directly populate registry cache from Electron credential store sync response
   */
  public populateFromElectronSync(res: {
    totalLoaded: number
    providerBreakdown: string
    models: any[]
    sttModels?: any[]
    configuredProviders?: string[]
  }): DiscoveredModel[] {
    if (!res || !Array.isArray(res.models)) return [...this.cachedModels]

    const configured = (res.configuredProviders || []).map((p) => p.toLowerCase())

    // Cache or clear Groq STT models
    if (typeof localStorage !== 'undefined') {
      if (configured.includes('groq')) {
        localStorage.setItem('groq_configured', 'true')
        if (res.sttModels && res.sttModels.length > 0) {
          try {
            localStorage.setItem('cached_groq_stt_models', JSON.stringify(res.sttModels))
          } catch {}
        }
      } else {
        localStorage.removeItem('groq_configured')
        localStorage.removeItem('cached_groq_stt_models')
      }
    }

    // If no providers are configured in Electron store, clear cache completely
    if (res.configuredProviders && res.configuredProviders.length === 0) {
      this.cachedModels = []
      this.syncState = {
        status: 'idle',
        modelSource: null,
        lastSyncedAt: Date.now(),
        error:
          'Chưa có API Key nào được cấu hình trong hệ thống. Vui lòng nhập Groq API Key hoặc LLM API Key (Gemini, OpenAI) ở trên để kích hoạt mô hình AI.',
        providerBreakdown: 'Chưa có API Key',
        totalDiscovered: 0,
      }
      this.persistCache()
      this.notifySubscribers()
      return []
    }

    // Filter existing cache so we only keep cached models for providers that currently have keys configured
    if (configured.length > 0) {
      this.cachedModels = this.cachedModels.filter((m) =>
        configured.includes(m.provider.toLowerCase())
      )
    }

    const verifiedModelIds = this.getVerifiedModelIds()
    const uniqueMap = new Map<string, DiscoveredModel>()
    for (const m of res.models) {
      if (!verifiedModelIds.has(verifiedModelKey(String(m.provider || ''), String(m.id || '')))) continue
      const low = String(m.id || '').toLowerCase()
      if (
        low.includes('whisper') ||
        low.includes('tts') ||
        low.includes('transcribe') ||
        low.includes('audio') ||
        low.includes('speech') ||
        low.includes('embed') ||
        low.includes('guard')
      ) {
        continue
      }
      const normalized = this.normalizeModel({
        ...m,
        isLiveFromAPI: true,
      })
      uniqueMap.set(normalized.id, normalized)
    }

    const apiModels = Array.from(uniqueMap.values())
    if (apiModels.length === 0) {
      const cacheCount = this.cachedModels.length
      this.syncState = {
        ...this.syncState,
        status: cacheCount > 0 ? 'error' : 'idle',
        modelSource: cacheCount > 0 ? 'cache' : null,
        lastSyncedAt: Date.now(),
        error:
          cacheCount > 0
            ? `Không nhận được model đã xác nhận từ API. Đang dùng ${cacheCount} model từ cache; hãy kiểm tra API key/kết nối hoặc xác nhận model trong Settings.`
            : res.models.length > 0
            ? `API liệt kê ${res.models.length} model nhưng chưa có model nào được xác nhận khả dụng. Hãy kiểm tra model trong Settings trước khi đồng bộ.`
            : 'API không trả về model nào. Hãy kiểm tra API key và quyền truy cập model rồi thử đồng bộ lại.',
        providerBreakdown: cacheCount > 0 ? `Cache: ${cacheCount} model` : res.models.length > 0 ? 'Chưa xác nhận model khả dụng' : 'API trả về 0 model',
        totalDiscovered: cacheCount,
      }
      this.persistCache()
      this.notifySubscribers()
      return [...this.cachedModels]
    }

    this.cachedModels = apiModels
    this.registerModelPricing(this.cachedModels)
    this.syncState = {
      status: 'success',
      modelSource: 'api',
      lastSyncedAt: Date.now(),
      error: null,
      providerBreakdown: res.providerBreakdown || `${res.totalLoaded} models`,
      totalDiscovered: this.cachedModels.length,
    }

    this.persistCache()
    this.notifySubscribers()
    return [...this.cachedModels]
  }

  /**
   * Merges a specific provider's models into the existing cache without wiping models from other configured providers.
   * Used when saving a single key (e.g. Groq or Gemini) from the progressive preview flow.
   */
  public mergeProviderModels(options: {
    provider: string
    models: any[]
    sttModels?: any[]
  }): DiscoveredModel[] {
    if (!options || !Array.isArray(options.models)) return [...this.cachedModels]

    const providerKey = options.provider.toLowerCase()
    const isGroq = providerKey.includes('groq')

    // Handle Groq STT cache
    if (isGroq && typeof localStorage !== 'undefined') {
      localStorage.setItem('groq_configured', 'true')
      if (options.sttModels && options.sttModels.length > 0) {
        try {
          localStorage.setItem('cached_groq_stt_models', JSON.stringify(options.sttModels))
        } catch {}
      }
    }

    // Ensure we have current cached models loaded from localStorage if empty
    let currentModels = this.cachedModels
    if (currentModels.length === 0 && typeof localStorage !== 'undefined') {
      try {
        const raw =
          localStorage.getItem(REGISTRY_STORAGE_KEYS.MODELS_CACHE) ||
          localStorage.getItem(REGISTRY_STORAGE_KEYS.LEGACY_CACHE)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentModels = parsed.map((m) => this.normalizeModel(m))
          }
        }
      } catch {}
    }

    // Filter incoming models for this provider
    const uniqueMap = new Map<string, DiscoveredModel>()
    for (const m of options.models) {
      const low = String(m.id || '').toLowerCase()
      if (
        low.includes('whisper') ||
        low.includes('tts') ||
        low.includes('transcribe') ||
        low.includes('audio') ||
        low.includes('speech') ||
        low.includes('embed') ||
        low.includes('guard')
      ) {
        continue
      }
      const targetProviderName = isGroq
        ? 'Groq'
        : providerKey.includes('gemini') || providerKey.includes('google')
        ? 'Google'
        : providerKey.includes('openai')
        ? 'OpenAI'
        : m.provider || options.provider

      const normalized = this.normalizeModel({
        ...m,
        provider: targetProviderName,
        isLiveFromAPI: true,
      })
      uniqueMap.set(normalized.id, normalized)
    }

    const newProviderModels = Array.from(uniqueMap.values())

    // Helper to check if a model belongs to the updated provider
    const isTargetProvider = (modelProvider: string) => {
      const p = String(modelProvider || '').toLowerCase()
      if (isGroq) return p === 'groq'
      if (providerKey.includes('gemini') || providerKey.includes('google')) {
        return p === 'google' || p === 'gemini'
      }
      if (providerKey.includes('openai')) return p === 'openai'
      return p === providerKey
    }

    // Record only models that the API key flow already tested as available.
    const verifiedIds = this.getVerifiedModelIds()
    const replacedProviderIds = new Set(
      currentModels.filter((model) => isTargetProvider(model.provider)).map((model) => verifiedModelKey(model.provider, model.id))
    )
    for (const id of replacedProviderIds) verifiedIds.delete(id)
    for (const model of newProviderModels) verifiedIds.add(verifiedModelKey(model.provider, model.id))
    this.persistVerifiedModelIds(verifiedIds)

    // Keep all models from OTHER providers
    const otherModels = currentModels.filter((m) => !isTargetProvider(m.provider))

    // Combine other models + new provider models
    this.cachedModels = [...otherModels, ...newProviderModels]
    this.registerModelPricing(this.cachedModels)

    // Compute updated breakdown
    const providerCounts: Record<string, number> = {}
    for (const m of this.cachedModels) {
      providerCounts[m.provider] = (providerCounts[m.provider] || 0) + 1
    }
    const breakdown = Object.entries(providerCounts)
      .map(([p, count]) => `${p}: ${count} LLM`)
      .join(', ')

    this.syncState = {
      status: 'success',
      modelSource: 'api',
      lastSyncedAt: Date.now(),
      error: null,
      providerBreakdown: breakdown || `${this.cachedModels.length} models`,
      totalDiscovered: this.cachedModels.length,
    }

    this.persistCache()
    this.notifySubscribers()
    return [...this.cachedModels]
  }

  /**
   * Removes a provider's models upon revocation without wiping other providers
   */
  public removeProviderModels(provider: string): DiscoveredModel[] {
    const providerKey = provider.toLowerCase()
    const isGroq = providerKey.includes('groq')

    if (isGroq && typeof localStorage !== 'undefined') {
      localStorage.removeItem('groq_configured')
      localStorage.removeItem('cached_groq_stt_models')
    }

    const isTargetProvider = (modelProvider: string) => {
      const p = String(modelProvider || '').toLowerCase()
      if (isGroq) return p === 'groq'
      if (providerKey.includes('gemini') || providerKey.includes('google')) {
        return p === 'google' || p === 'gemini'
      }
      if (providerKey.includes('openai')) return p === 'openai'
      return p === providerKey
    }

    this.cachedModels = this.cachedModels.filter((m) => !isTargetProvider(m.provider))
    const verifiedIds = this.getVerifiedModelIds()
    const retainedVerifiedKeys = new Set(this.cachedModels.map((model) => verifiedModelKey(model.provider, model.id)))
    for (const key of Array.from(verifiedIds)) if (!retainedVerifiedKeys.has(key)) verifiedIds.delete(key)
    this.persistVerifiedModelIds(verifiedIds)

    const providerCounts: Record<string, number> = {}
    for (const m of this.cachedModels) {
      providerCounts[m.provider] = (providerCounts[m.provider] || 0) + 1
    }
    const breakdown = Object.entries(providerCounts)
      .map(([p, count]) => `${p}: ${count} LLM`)
      .join(', ')

    this.syncState = {
      status: this.cachedModels.length > 0 ? 'success' : 'idle',
      modelSource: this.cachedModels.length > 0 ? 'api' : null,
      lastSyncedAt: Date.now(),
      error: null,
      providerBreakdown: breakdown || '0 models',
      totalDiscovered: this.cachedModels.length,
    }

    this.persistCache()
    this.notifySubscribers()
    return [...this.cachedModels]
  }

  private getVerifiedModelIds(): Set<string> {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(REGISTRY_STORAGE_KEYS.VERIFIED_MODELS) : null
      const ids = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
    } catch {
      return new Set()
    }
  }

  private persistVerifiedModelIds(ids: Set<string>): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(REGISTRY_STORAGE_KEYS.VERIFIED_MODELS, JSON.stringify(Array.from(ids)))
      }
    } catch {}
  }

  /**
   * Run background sync on startup without blocking main UI thread
   */
  public syncInBackground(delayMs = 1200): void {
    if (typeof window === 'undefined') return

    setTimeout(() => {
      this.syncAll().catch((err) => {
        console.warn('[ModelRegistry] Background sync warning:', err?.message || err)
      })
    }, delayMs)
  }

  /**
   * Subscribe to registry sync state and model updates
   */
  public subscribe(
    listener: (state: RegistrySyncState, models: DiscoveredModel[]) => void
  ): () => void {
    this.subscribers.add(listener)
    // Immediately invoke with current state
    listener(this.getSyncState(), this.getModels())

    return () => {
      this.subscribers.delete(listener)
    }
  }

  private notifySubscribers(): void {
    const state = this.getSyncState()
    const models = this.getModels()
    for (const listener of this.subscribers) {
      try {
        listener(state, models)
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ai-models-updated', {
          detail: { state, count: models.length },
        })
      )
    }
  }

  private persistCache(): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        REGISTRY_STORAGE_KEYS.MODELS_CACHE,
        JSON.stringify(this.cachedModels)
      )
      // Mirror to legacy key for backward compatibility
      localStorage.setItem(
        REGISTRY_STORAGE_KEYS.LEGACY_CACHE,
        JSON.stringify(this.cachedModels)
      )
      localStorage.setItem(
        REGISTRY_STORAGE_KEYS.SYNC_META,
        JSON.stringify({
          modelSource: this.syncState.modelSource,
          lastSyncedAt: this.syncState.lastSyncedAt,
          totalDiscovered: this.syncState.totalDiscovered,
          providerBreakdown: this.syncState.providerBreakdown,
        })
      )
    } catch {}
  }

  private async resolveApiKeys(): Promise<Record<string, string>> {
    // Plaintext keys are deprecated in Renderer. Model sync is performed securely via Main Process IPC.
    return {}
  }

  private normalizeModel(raw: any): DiscoveredModel {
    const id = String(raw.id || 'unknown')
    const displayName = String(raw.displayName || raw.name || id)
    const provider = String(raw.provider || 'Google')
    const capabilities: ModelCapability[] = Array.isArray(raw.capabilities)
      ? raw.capabilities
      : ['text']

    // Ensure vision is added if model is known to be multimodal
    const low = id.toLowerCase()
    if (
      !capabilities.includes('vision') &&
      (low.includes('gemini') ||
        low.includes('4o') ||
        low.includes('vision') ||
        low.startsWith('o1'))
    ) {
      capabilities.push('vision')
    }

    return {
      id,
      displayName,
      provider,
      capabilities,
      contextWindow: String(raw.contextWindow || '128k tokens'),
      contextTokens:
        typeof raw.contextTokens === 'number'
          ? raw.contextTokens
          : typeof raw.contextWindow === 'number'
          ? raw.contextWindow
          : 128000,
      tier: raw.tier === 'Pro' ? 'Pro' : 'Free',
      badgeColor: raw.badgeColor || 'violet',
      description: raw.description,
      recommendedFor: raw.recommendedFor,
      pricing: raw.pricing,
      supportedModalities: raw.supportedModalities || (capabilities.includes('vision') ? ['text', 'image'] : ['text']),
      metadata: raw.metadata,
      isLiveFromAPI: Boolean(raw.isLiveFromAPI),
      lastDiscoveredAt: raw.lastDiscoveredAt || Date.now(),
    }
  }

  private registerModelPricing(models: DiscoveredModel[]): void {
    for (const model of models) {
      if (model.pricing) {
        pricingRegistry.registerModelPricing(model.provider, model.id, model.pricing)
      }
    }
  }
}

export const modelRegistryService = ModelRegistryService.getInstance()
