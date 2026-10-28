import { useState, useEffect, useCallback, useRef } from 'react'
import { credentialsPort } from '@/infrastructure/ipc'
import {
  getAllAIModels,
  getAvailableSTTEngines,
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
  selectedLLM?: string
  selectedSTT: string
  setSelectedLLM: (id: string) => void
  setSelectedSTT: (id: string) => void
  setModelsList: (models: AIModelConfig[]) => void
  setSttEnginesList: (engines: STTEngineConfig[]) => void
  syncModelsSelection?: (models: AIModelConfig[]) => void
  setSyncMeta?: (state: any) => void
  setSyncStatus?: (status: any) => void
  autoDismissMs?: number
}

export function useCredentialManagement({
  llmProvider,
  selectedSTT,
  setSelectedLLM,
  setSelectedSTT,
  setModelsList,
  setSttEnginesList,
  syncModelsSelection = () => {},
  setSyncMeta = () => {},
  setSyncStatus = () => {},
  autoDismissMs = 4000,
}: UseCredentialManagementProps) {
  const isMountedRef = useRef(true)
  const callbacksRef = useRef({
    setSelectedLLM,
    setSelectedSTT,
    setModelsList,
    setSttEnginesList,
    syncModelsSelection,
    setSyncMeta,
    setSyncStatus,
  })

  useEffect(() => {
    callbacksRef.current = {
      setSelectedLLM,
      setSelectedSTT,
      setModelsList,
      setSttEnginesList,
      syncModelsSelection,
      setSyncMeta,
      setSyncStatus,
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
        callbacksRef.current.syncModelsSelection(getAllAIModels())
        callbacksRef.current.setSyncStatus(null)
        callbacksRef.current.setSyncMeta(modelRegistryService.getSyncState())
        return true
      }
      setGroqVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    },
    []
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
      callbacksRef.current.syncModelsSelection(getAllAIModels())
      callbacksRef.current.setSyncStatus(null)
      callbacksRef.current.setSyncMeta(modelRegistryService.getSyncState())
      return true
    }
    return false
  }, [selectedSTT])

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
        callbacksRef.current.syncModelsSelection(getAllAIModels())
        callbacksRef.current.setSyncStatus(null)
        callbacksRef.current.setSyncMeta(modelRegistryService.getSyncState())
        return true
      }
      setLlmVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    },
    [llmProvider]
  )

  const handleDeleteLLMKey = useCallback(async (provider: string): Promise<boolean> => {
    if (!credentialsPort.isSupported) return false
    const res = await credentialsPort.deleteApiKey(provider)
    if (res.success) {
      const statuses = await credentialsPort.getAllStatuses()
      setCredentialStatuses(statuses)
      setLlmVerify({ state: 'idle' })
      modelRegistryService.removeProviderModels(provider)
      callbacksRef.current.syncModelsSelection(getAllAIModels())
      callbacksRef.current.setSyncStatus(null)
      callbacksRef.current.setSyncMeta(modelRegistryService.getSyncState())
      return true
    }
    return false
  }, [])

  const handleVerifyLLM = useCallback(async () => {
    if (!credentialsPort.isSupported) return
    setLlmVerify({ state: 'checking' })
    let targetProvider: string
    if (llmProvider === 'OpenAI') targetProvider = 'openai'
    else if (llmProvider === 'Google') targetProvider = 'gemini'
    else {
      targetProvider = credentialStatuses['openai']?.configured ? 'openai' : 'gemini'
    }

    const res = await credentialsPort.verifyApiKey(targetProvider)
    setLlmVerify({
      state: res.valid ? 'valid' : 'invalid',
      message: res.message,
      detected: res.valid ? res.provider : undefined,
    })
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

  return {
    credentialStatuses,
    secureStorageAvailable,
    secureStorageWarning,
    groqVerify,
    llmVerify,
    handleSaveGroqKey,
    handleDeleteGroqKey,
    handleVerifyGroq,
    handleSaveLLMKey,
    handleDeleteLLMKey,
    handleVerifyLLM,
    handleVerifyRawKey,
    handleTestModelAvailability,
    setLlmVerify,
  }
}
