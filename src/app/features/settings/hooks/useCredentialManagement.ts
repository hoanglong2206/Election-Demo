import { useState, useEffect, useCallback, useRef } from 'react'
import { credentialsPort } from '@/infrastructure/ipc'
import {
  getAllAIModels,
  getAvailableSTTEngines,
  syncActiveAIModels,
  saveAIModelId,
  type AIModelConfig,
  type STTEngineConfig,
} from '@/services/ai-model/aiModels'
import { modelRegistryService } from '@/services/ai-model/model-registry'
import {
  settingsManager,
  migratePlaintextSecretsToSecureStore,
} from '@/services/settings'
import type { VerifyState, LLMProviderOption, CredentialStatus } from '../types'

interface UseCredentialManagementProps {
  llmProvider: LLMProviderOption
  selectedLLM: string
  selectedSTT: string
  setSelectedLLM: (id: string) => void
  setSelectedSTT: (id: string) => void
  setModelsList: (models: AIModelConfig[]) => void
  setSttEnginesList: (engines: STTEngineConfig[]) => void
  autoDismissMs?: number
}

export function useCredentialManagement({
  llmProvider,
  selectedLLM,
  selectedSTT,
  setSelectedLLM,
  setSelectedSTT,
  setModelsList,
  setSttEnginesList,
  autoDismissMs = 4000,
}: UseCredentialManagementProps) {
  const isMountedRef = useRef(true)
  const callbacksRef = useRef({
    setSelectedLLM,
    setSelectedSTT,
    setModelsList,
    setSttEnginesList,
  })

  useEffect(() => {
    callbacksRef.current = {
      setSelectedLLM,
      setSelectedSTT,
      setModelsList,
      setSttEnginesList,
    }
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [credentialStatuses, setCredentialStatuses] = useState<
    Record<string, CredentialStatus>
  >({})
  const [secureStorageAvailable, setSecureStorageAvailable] = useState<boolean>(true)
  const [secureStorageWarning, setSecureStorageWarning] = useState<string | null>(null)

  const [groqVerify, setGroqVerify] = useState<{
    state: VerifyState
    message?: string
  }>({ state: 'idle' })

  const [llmVerify, setLlmVerify] = useState<{
    state: VerifyState
    message?: string
    detected?: string
  }>({ state: 'idle' })

  const [syncMeta, setSyncMeta] = useState(() => modelRegistryService.getSyncState())
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    text: string
    isError: boolean
    isWarning?: boolean
  } | null>(null)

  // Auto-dismiss verify messages
  useEffect(() => {
    if (groqVerify.message && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) setGroqVerify({ state: 'idle' })
      }, autoDismissMs)
      return () => clearTimeout(timer)
    }
  }, [groqVerify.message, autoDismissMs])

  useEffect(() => {
    if (llmVerify.message && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) setLlmVerify({ state: 'idle' })
      }, autoDismissMs)
      return () => clearTimeout(timer)
    }
  }, [llmVerify.message, autoDismissMs])

  const syncModelsSelection = useCallback((models: AIModelConfig[]) => {
    callbacksRef.current.setModelsList(models)
    if (models.length > 0 && (!selectedLLM || !models.some((m) => m.id === selectedLLM))) {
      callbacksRef.current.setSelectedLLM(models[0].id)
      saveAIModelId(models[0].id)
    } else if (models.length === 0) {
      callbacksRef.current.setSelectedLLM('')
      saveAIModelId('')
    }
  }, [selectedLLM])

  // Initialize credential store & legacy migration
  useEffect(() => {
    let isCancelled = false
    async function initCredentials() {
      if (!credentialsPort.isSupported) return
      try {
        const available = await credentialsPort.isAvailable()
        if (isCancelled) return
        setSecureStorageAvailable(available)
        if (!available) {
          setSecureStorageWarning(
            'Hệ thống mã hóa OS Credential Store (DPAPI/Keychain) không khả dụng trên thiết bị này. Ứng dụng từ chối lưu plaintext API key.'
          )
        } else {
          const migRes = await migratePlaintextSecretsToSecureStore()
          if (isCancelled) return
          if (migRes.warning) {
            setSecureStorageWarning(migRes.warning)
          }
        }

        const statuses = await credentialsPort.getAllStatuses()
        if (isCancelled) return
        setCredentialStatuses(statuses)
        if (statuses['groq']?.configured) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('groq_configured', 'true')
          }
          const updatedSTT = getAvailableSTTEngines('groq_configured')
          callbacksRef.current.setSttEnginesList(updatedSTT)
        }
      } catch (err) {
        console.warn('[useCredentialManagement] Error checking credential store:', err)
      }
    }
    void initCredentials()
    return () => {
      isCancelled = true
    }
  }, [])

  // Groq key operations
  const handleSaveGroqKey = useCallback(
    async (
      key: string,
      sttModels: STTEngineConfig[] = [],
      availableModels: AIModelConfig[] = []
    ): Promise<boolean> => {
      if (!credentialsPort.isSupported) return false
      setGroqVerify({ state: 'checking' })
      const res = await credentialsPort.saveApiKey('groq', key)
      if (res.success) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('groq_configured', 'true')
          if (sttModels.length > 0) {
            localStorage.setItem('cached_groq_stt_models', JSON.stringify(sttModels))
          }
        }
        modelRegistryService.mergeProviderModels({ provider: 'Groq', models: availableModels, sttModels })
        const statuses = await credentialsPort.getAllStatuses()
        setCredentialStatuses(statuses)
        setGroqVerify({ state: 'valid', message: 'Khóa Groq API đã được lưu an toàn (DPAPI).' })
        callbacksRef.current.setSttEnginesList(getAvailableSTTEngines('groq_configured'))
        syncModelsSelection(getAllAIModels())
        setSyncStatus(null)
        setSyncMeta(modelRegistryService.getSyncState())
        return true
      }
      setGroqVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    },
    [syncModelsSelection]
  )

  const handleDeleteGroqKey = useCallback(async (): Promise<boolean> => {
    if (!credentialsPort.isSupported) return false
    const res = await credentialsPort.deleteApiKey('groq')
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('groq_configured')
        localStorage.removeItem('cached_groq_stt_models')
      }
      const statuses = await credentialsPort.getAllStatuses()
      setCredentialStatuses(statuses)
      setGroqVerify({ state: 'idle' })
      const updatedSTT = getAvailableSTTEngines('')
      callbacksRef.current.setSttEnginesList(updatedSTT)
      if (selectedSTT.startsWith('whisper-')) {
        callbacksRef.current.setSelectedSTT(updatedSTT[0]?.id || 'ggml-tiny.bin')
      }
      modelRegistryService.removeProviderModels('Groq')
      syncModelsSelection(getAllAIModels())
      setSyncStatus(null)
      setSyncMeta(modelRegistryService.getSyncState())
      return true
    }
    return false
  }, [selectedSTT, syncModelsSelection])

  const handleVerifyGroq = useCallback(async () => {
    if (!credentialsPort.isSupported) return
    setGroqVerify({ state: 'checking' })
    const res = await credentialsPort.verifyApiKey('groq')
    setGroqVerify({ state: res.valid ? 'valid' : 'invalid', message: res.message })
  }, [])

  // LLM key operations
  const handleSaveLLMKey = useCallback(
    async (
      provider: string,
      key: string,
      availableModels: AIModelConfig[] = []
    ): Promise<boolean> => {
      if (!credentialsPort.isSupported) return false
      setLlmVerify({ state: 'checking' })
      const res = await credentialsPort.saveApiKey(provider, key)
      if (res.success) {
        if (availableModels.length > 0) {
          modelRegistryService.mergeProviderModels({ provider, models: availableModels })
        }
        const statuses = await credentialsPort.getAllStatuses()
        setCredentialStatuses(statuses)
        setLlmVerify({ state: 'valid', message: 'Khóa LLM API đã được lưu an toàn (DPAPI).' })
        settingsManager.set('llmProvider', llmProvider)
        syncModelsSelection(getAllAIModels())
        setSyncStatus(null)
        setSyncMeta(modelRegistryService.getSyncState())
        return true
      }
      setLlmVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    },
    [llmProvider, syncModelsSelection]
  )

  const handleDeleteLLMKey = useCallback(
    async (provider: string): Promise<boolean> => {
      if (!credentialsPort.isSupported) return false
      const res = await credentialsPort.deleteApiKey(provider)
      if (res.success) {
        const statuses = await credentialsPort.getAllStatuses()
        setCredentialStatuses(statuses)
        setLlmVerify({ state: 'idle' })
        modelRegistryService.removeProviderModels(provider)
        syncModelsSelection(getAllAIModels())
        setSyncStatus(null)
        setSyncMeta(modelRegistryService.getSyncState())
        return true
      }
      return false
    },
    [syncModelsSelection]
  )

  const handleVerifyLLM = useCallback(async () => {
    if (!credentialsPort.isSupported) return
    setLlmVerify({ state: 'checking' })
    let targetProvider: string
    if (llmProvider === 'OpenAI') targetProvider = 'openai'
    else if (llmProvider === 'Google') targetProvider = 'gemini'
    else {
      if (credentialStatuses['openai']?.configured) targetProvider = 'openai'
      else targetProvider = 'gemini'
    }

    const res = await credentialsPort.verifyApiKey(targetProvider)
    if (res.valid) {
      setLlmVerify({
        state: 'valid',
        message: res.message,
        detected: res.provider,
      })
    } else {
      setLlmVerify({ state: 'invalid', message: res.message })
    }
  }, [credentialStatuses, llmProvider])

  const handleVerifyRawKey = useCallback(
    async (provider: string, rawKey: string) => {
      if (!credentialsPort.isSupported) {
        return { valid: false, provider, message: 'Dịch vụ xác thực không khả dụng' }
      }
      return await credentialsPort.verifyApiKey(provider, rawKey)
    },
    []
  )

  const handleTestModelAvailability = useCallback(
    async (provider: string, rawKey: string, modelId: string) => {
      if (!credentialsPort.isSupported) {
        return { available: false, message: 'Cần khởi động lại ứng dụng để nạp chức năng kiểm tra model.' }
      }
      return credentialsPort.testModelAvailability(provider, rawKey, modelId)
    },
    []
  )

  const handleSyncModels = useCallback(async () => {
    setIsSyncing(true)
    setSyncStatus((prev) =>
      prev
        ? {
            text: 'Đang kết nối và đồng bộ danh sách mô hình từ API...',
            isError: false,
            isWarning: false,
          }
        : null
    )
    try {
      const res = await syncActiveAIModels()
      syncModelsSelection(getAllAIModels())
      const state = modelRegistryService.getSyncState()
      setSyncMeta(state)

      if (state.status === 'error' || !res.success) {
        setSyncStatus({
          text:
            state.error ||
            res.error ||
            'API không trả về model nào. Hãy kiểm tra API key rồi thử lại.',
          isError: true,
        })
      } else if (state.modelSource === 'mixed') {
        setSyncStatus({
          text: `Đồng bộ một phần: ${state.providerBreakdown}. Một số model đang dùng cache từ lần đồng bộ trước.`,
          isError: false,
          isWarning: true,
        })
      } else {
        setSyncStatus({
          text: `Đồng bộ API thành công! Đã nạp ${res.totalLoaded} model (${res.providerBreakdown}).`,
          isError: false,
        })
      }
    } catch (err) {
      setSyncStatus({
        text: (err as Error)?.message || 'Lỗi khi đồng bộ danh sách model từ API.',
        isError: true,
      })
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false)
      }
    }
  }, [selectedLLM])

  return {
    credentialStatuses,
    secureStorageAvailable,
    secureStorageWarning,
    groqVerify,
    llmVerify,
    syncMeta,
    isSyncing,
    syncStatus,
    handleSaveGroqKey,
    handleDeleteGroqKey,
    handleVerifyGroq,
    handleSaveLLMKey,
    handleDeleteLLMKey,
    handleVerifyLLM,
    handleVerifyRawKey,
    handleTestModelAvailability,
    handleSyncModels,
    setLlmVerify,
  }
}
