import { useState, useEffect, useRef } from 'react'
import {
  getAllAIModels,
  getSavedAIModelId,
  saveAIModelId,
  getAvailableSTTEngines,
  syncLocalSTTModelsFromStatus,
  LOCAL_WHISPER_ENGINE,
  getSavedSTTEngineId,
  saveSTTEngineId,
  getSavedVADThreshold,
  saveVADThreshold,
  getSavedResponseLanguage,
  saveResponseLanguage,
  syncActiveAIModels,
  measureRealAIPing,
  EMPTY_PLACEHOLDER_MODEL,
  type AIModelConfig,
  type STTEngineConfig,
} from '../../services/ai-model/aiModels'
import { modelRegistryService } from '../../services/ai-model/model-registry'
import {
  PRESET_AUDIO_DEVICES,
  getSavedAudioDeviceId,
  saveAudioDeviceId,
} from '../../services/audioDevices'
import { normalizeResponseLanguage } from '../../services/ai-model/language'
import { type VerifyState, type LLMProviderOption } from './types'
import { SettingsHeader } from './components/SettingsHeader'
import { APIKeysCard } from './components/APIKeysCard'
import { STTEngineCard } from './components/STTEngineCard'
import { LLMEngineCard } from './components/LLMEngineCard'
import { MultimodalModelCard } from './components/MultimodalModelCard'
import { MeetingAudioConfigCard } from './components/MeetingAudioConfigCard'
import { Coins, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { showToast } from '@/components/ui/toast'
import {
  getAppSettings,
  updateAppSettings,
  settingsManager,
  migratePlaintextSecretsToSecureStore,
} from '../../services/settings'

interface SettingsProps {
  onViewChange?: (view: any) => void
}

export function Settings({ onViewChange }: SettingsProps = {}) {
  const currentSettings = getAppSettings()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // ── Secure OS Credential Store State ────────────────────────────────────────
  const [credentialStatuses, setCredentialStatuses] = useState<
    Record<string, { configured: boolean; maskedKey?: string }>
  >({})
  const [secureStorageAvailable, setSecureStorageAvailable] = useState<boolean>(true)
  const [secureStorageWarning, setSecureStorageWarning] = useState<string | null>(null)

  // ── 1. Groq API Key State ──────────────────────────────────────────────────
  const [groqVerify, setGroqVerify] = useState<{
    state: VerifyState
    message?: string
  }>({ state: 'idle' })

  // ── 2. Generic LLM API Key State ───────────────────────────────────────────
  const [llmProvider, setLlmProvider] = useState<LLMProviderOption>(
    currentSettings.apiKeys.llmProvider
  )
  const [llmVerify, setLlmVerify] = useState<{
    state: VerifyState
    message?: string
    detected?: string
  }>({ state: 'idle' })

  // ── 3. Decoupled AI Engines State ──────────────────────────────────────────
  const [sttEnginesList, setSttEnginesList] = useState<STTEngineConfig[]>(() =>
    getAvailableSTTEngines()
  )
  const [selectedSTT, setSelectedSTT] = useState(getSavedSTTEngineId)
  const [selectedLLM, setSelectedLLM] = useState(getSavedAIModelId)
  const [selectedMultimodal, setSelectedMultimodal] = useState<string>(
    () => (settingsManager.get('selectedMultimodal') as string) || ''
  )
  const [modelRouterPolicy, setModelRouterPolicy] = useState(currentSettings.modelRouter.policy)
  const [modelsList, setModelsList] = useState<AIModelConfig[]>(() => getAllAIModels())

  // ── 4. Audio & Meeting Advanced State ──────────────────────────────────────
  const [selectedDevice, setSelectedDevice] = useState(getSavedAudioDeviceId)
  const [vadThreshold, setVadThreshold] = useState(getSavedVADThreshold)
  const [responseLang, setResponseLang] = useState(getSavedResponseLanguage)

  // ── Sync & Feedback State ──────────────────────────────────────────────────
  const [syncMeta, setSyncMeta] = useState(() => modelRegistryService.getSyncState())
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    text: string
    isError: boolean
    isWarning?: boolean
  } | null>(null)
  useEffect(() => {
    if (groqVerify.message) {
      const timer = setTimeout(() => {
        setGroqVerify({ state: 'idle' })
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [groqVerify.message])

  useEffect(() => {
    if (llmVerify.message) {
      const timer = setTimeout(() => {
        setLlmVerify({ state: 'idle' })
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [llmVerify.message])

  // ── Native Whisper Engine State ────────────────────────────────────────────
  const [isCheckingNative, setIsCheckingNative] = useState(false)
  const [nativeTestResult, setNativeTestResult] = useState<{
    latencyMs: number
    isNative: boolean
    text: string
  } | null>(null)

  // ── Latency / Ping Measurement State ──────────────────────────────────────
  const [liveLLMPing, setLiveLLMPing] = useState<number | null>(() => {
    const saved = getSavedAIModelId()
    const found = getAllAIModels().find((m) => m.id === saved)
    return found?.pingMs ?? null
  })
  const [isPingingLLM, setIsPingingLLM] = useState<boolean>(false)
  const [isCheckingGroqSTT, setIsCheckingGroqSTT] = useState<boolean>(false)
  const [groqSTTTestResult, setGroqSTTTestResult] = useState<{
    latencyMs: number
    text: string
  } | null>(() => {
    const saved = getSavedSTTEngineId()
    const found = getAvailableSTTEngines().find((e) => e.id === saved)
    if (found && found.provider !== 'Local') {
      return {
        latencyMs: found.latencyMs || 180,
        text: `Ping Groq LPU: ${found.latencyMs || 180}ms`,
      }
    }
    return null
  })
  const llmPingReqRef = useRef(0)
  const groqPingReqRef = useRef(0)

  useEffect(() => {
    if (window.api?.nativeWhisper) {
      window.api.nativeWhisper
        .getStatus()
        .then((st: { availableModels?: unknown }) => {
          if (st?.availableModels && Array.isArray(st.availableModels)) {
            syncLocalSTTModelsFromStatus(st.availableModels)
            const updated = getAvailableSTTEngines()
            setSttEnginesList(updated)
            if (!updated.some((e) => e.id === selectedSTT)) {
              const nextId = updated[0]?.id || 'ggml-tiny.bin'
              setSelectedSTT(nextId)
              saveSTTEngineId(nextId)
            }
          }
        })
        .catch(() => {})
    }
  }, [selectedSTT])

  // Listen to models sync updates
  useEffect(() => {
    const handleModelsUpdate = () => {
      setModelsList(getAllAIModels())
      setSyncMeta(modelRegistryService.getSyncState())
    }
    window.addEventListener('ai-models-updated', handleModelsUpdate)
    return () => window.removeEventListener('ai-models-updated', handleModelsUpdate)
  }, [])

  useEffect(() => {
    if (selectedLLM && !modelsList.some((model) => model.id === selectedLLM)) {
      const nextModelId = modelsList[0]?.id || ''
      const timer = setTimeout(() => {
        setSelectedLLM(nextModelId)
        saveAIModelId(nextModelId)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [modelsList, selectedLLM])

  // ── Secure Credential Store Initialization & Plaintext Migration ───────────
  useEffect(() => {
    async function initCredentials() {
      if (window.api?.credentials) {
        try {
          const available = await window.api.credentials.isAvailable()
          setSecureStorageAvailable(available)
          if (!available) {
            setSecureStorageWarning(
              'Hệ thống mã hóa OS Credential Store (DPAPI/Keychain) không khả dụng trên thiết bị này. Ứng dụng từ chối lưu plaintext API key.'
            )
          } else {
            // Migrate any legacy plaintext keys from localStorage
            const migRes = await migratePlaintextSecretsToSecureStore()
            if (migRes.warning) {
              setSecureStorageWarning(migRes.warning)
            }
          }

          const statuses = await window.api.credentials.getAllStatuses()
          setCredentialStatuses(statuses)
          if (statuses['groq']?.configured) {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('groq_configured', 'true')
            }
            const updatedSTT = getAvailableSTTEngines('groq_configured')
            setSttEnginesList(updatedSTT)
          }
        } catch (err) {
          console.warn('[Settings] Error checking credential store:', err)
        }
      }
    }
    initCredentials()
  }, [])

  // ── Groq Key Handlers (Secure IPC to OS Credential Store) ──────────────────
  const handleSaveGroqKey = async (
    key: string,
    sttModels: STTEngineConfig[] = [],
    availableModels: AIModelConfig[] = []
  ): Promise<boolean> => {
    if (!window.api?.credentials) return false
    setGroqVerify({ state: 'checking' })
    const res = await window.api.credentials.saveApiKey('groq', key)
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('groq_configured', 'true')
        if (sttModels.length > 0) {
          localStorage.setItem('cached_groq_stt_models', JSON.stringify(sttModels))
        }
      }
      modelRegistryService.mergeProviderModels({ provider: 'Groq', models: availableModels, sttModels })
      const statuses = await window.api.credentials.getAllStatuses()
      setCredentialStatuses(statuses)
      setGroqVerify({ state: 'valid', message: 'Khóa Groq API đã được lưu an toàn (DPAPI).' })
      const updatedSTT = getAvailableSTTEngines('groq_configured')
      setSttEnginesList(updatedSTT)
      const updatedModels = getAllAIModels()
      setModelsList(updatedModels)
      if (updatedModels.length > 0 && (!selectedLLM || !updatedModels.some((m) => m.id === selectedLLM))) {
        setSelectedLLM(updatedModels[0].id)
        saveAIModelId(updatedModels[0].id)
      }
      setSyncStatus(null)
      setSyncMeta(modelRegistryService.getSyncState())
      return true
    } else {
      setGroqVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    }
  }

  const handleDeleteGroqKey = async (): Promise<boolean> => {
    if (!window.api?.credentials) return false
    const res = await window.api.credentials.deleteApiKey('groq')
    if (res.success) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('groq_configured')
        localStorage.removeItem('cached_groq_stt_models')
      }
      const statuses = await window.api.credentials.getAllStatuses()
      setCredentialStatuses(statuses)
      setGroqVerify({ state: 'idle' })
      const updatedSTT = getAvailableSTTEngines('')
      setSttEnginesList(updatedSTT)
      if (selectedSTT.startsWith('whisper-')) {
        const nextId = updatedSTT[0]?.id || 'ggml-tiny.bin'
        setSelectedSTT(nextId)
        saveSTTEngineId(nextId)
      }
      modelRegistryService.removeProviderModels('Groq')
      const updatedModels = getAllAIModels()
      setModelsList(updatedModels)
      if (updatedModels.length > 0 && !updatedModels.some((m) => m.id === selectedLLM)) {
        setSelectedLLM(updatedModels[0].id)
        saveAIModelId(updatedModels[0].id)
      } else if (updatedModels.length === 0) {
        setSelectedLLM('')
        saveAIModelId('')
      }
      setSyncStatus(null)
      setSyncMeta(modelRegistryService.getSyncState())
      return true
    }
    return false
  }

  const handleVerifyGroq = async () => {
    if (!window.api?.credentials) return
    setGroqVerify({ state: 'checking' })
    const res = await window.api.credentials.verifyApiKey('groq')
    if (res.valid) {
      setGroqVerify({ state: 'valid', message: res.message })
    } else {
      setGroqVerify({ state: 'invalid', message: res.message })
    }
  }

  // ── LLM Key Handlers (Secure IPC to OS Credential Store) ───────────────────
  const handleSaveLLMKey = async (
    provider: string,
    key: string,
    availableModels: AIModelConfig[] = []
  ): Promise<boolean> => {
    if (!window.api?.credentials) return false
    setLlmVerify({ state: 'checking' })
    const res = await window.api.credentials.saveApiKey(provider, key)
    if (res.success) {
      // A key can be valid while every listed model is unavailable/quota-blocked.
      // Keep previously confirmed models in that case instead of replacing them with an empty set.
      if (availableModels.length > 0) {
        modelRegistryService.mergeProviderModels({ provider, models: availableModels })
      }
      const statuses = await window.api.credentials.getAllStatuses()
      setCredentialStatuses(statuses)
      setLlmVerify({ state: 'valid', message: 'Khóa LLM API đã được lưu an toàn (DPAPI).' })
      settingsManager.set('llmProvider', llmProvider)
      const updatedModels = getAllAIModels()
      setModelsList(updatedModels)
      if (updatedModels.length > 0 && (!selectedLLM || !updatedModels.some((m) => m.id === selectedLLM))) {
        setSelectedLLM(updatedModels[0].id)
        saveAIModelId(updatedModels[0].id)
      }
      setSyncStatus(null)
      setSyncMeta(modelRegistryService.getSyncState())
      return true
    } else {
      setLlmVerify({ state: 'invalid', message: res.error || 'Lỗi khi lưu khóa' })
      return false
    }
  }

  const handleVerifyRawKey = async (provider: string, rawKey: string) => {
    if (!window.api?.credentials?.verifyApiKey) {
      return { valid: false, provider, message: 'Dịch vụ xác thực không khả dụng' }
    }
    return await window.api.credentials.verifyApiKey(provider, rawKey)
  }

  const handleDeleteLLMKey = async (provider: string): Promise<boolean> => {
    if (!window.api?.credentials) return false
    const res = await window.api.credentials.deleteApiKey(provider)
    if (res.success) {
      const statuses = await window.api.credentials.getAllStatuses()
      setCredentialStatuses(statuses)
      setLlmVerify({ state: 'idle' })
      modelRegistryService.removeProviderModels(provider)
      const updatedModels = getAllAIModels()
      setModelsList(updatedModels)
      if (updatedModels.length > 0 && !updatedModels.some((m) => m.id === selectedLLM)) {
        setSelectedLLM(updatedModels[0].id)
        saveAIModelId(updatedModels[0].id)
      } else if (updatedModels.length === 0) {
        setSelectedLLM('')
        saveAIModelId('')
      }
      setSyncStatus(null)
      setSyncMeta(modelRegistryService.getSyncState())
      return true
    }
    return false
  }

  const handleVerifyLLM = async () => {
    if (!window.api?.credentials) return
    setLlmVerify({ state: 'checking' })
    let targetProvider: string
    if (llmProvider === 'OpenAI') targetProvider = 'openai'
    else if (llmProvider === 'Google') targetProvider = 'gemini'
    else {
      // Auto: check which provider has a key configured
      if (credentialStatuses['openai']?.configured) targetProvider = 'openai'
      else targetProvider = 'gemini'
    }

    const res = await window.api.credentials.verifyApiKey(targetProvider)
    if (res.valid) {
      setLlmVerify({
        state: 'valid',
        message: res.message,
        detected: res.provider,
      })
    } else {
      setLlmVerify({ state: 'invalid', message: res.message })
    }
  }

  // ── Check Native Whisper Engine ───────────────────────────────────────────
  const handleCheckNativeEngine = async () => {
    setIsCheckingNative(true)
    setNativeTestResult(null)
    try {
      if (window.api?.nativeWhisper) {
        // 1. Pre-flight health check on binary and model
        if (typeof window.api.nativeWhisper.healthCheck === 'function') {
          try {
            const health = await window.api.nativeWhisper.healthCheck(selectedSTT)
            if (health && !health.healthy) {
              setNativeTestResult({
                latencyMs: 0,
                isNative: false,
                text: `Health Check Failed: ${health.error}`,
              })
              return
            }
          } catch (healthErr: unknown) {
            const msg = healthErr instanceof Error ? healthErr.message : String(healthErr)
            console.warn('[Settings] healthCheck IPC warning:', msg)
            if (msg.includes('No handler registered')) {
              setNativeTestResult({
                latencyMs: 0,
                isNative: false,
                text: 'Cần khởi động lại ứng dụng Electron (nhấn Ctrl+C ở terminal và chạy lại "bun run dev") để nhận diện các IPC handler mới.',
              })
              return
            }
          }
        }

        // 2. Perform test transcription
        const testRes = await window.api.nativeWhisper.transcribe(
          'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
          { modelId: selectedSTT }
        )
        setNativeTestResult({
          latencyMs: testRes.latencyMs,
          isNative: testRes.isNative,
          text: testRes.text,
        })
      }
    } catch (err: unknown) {
      console.error('Error checking native whisper:', err)
      const errStr = err instanceof Error ? err.message : String(err)
      const isUnregistered = errStr.includes('No handler registered')
      setNativeTestResult({
        latencyMs: 0,
        isNative: false,
        text: isUnregistered
          ? 'Cần khởi động lại ứng dụng Electron (Ctrl+C và chạy lại "bun run dev") để nạp các IPC handler mới.'
          : errStr,
      })
    } finally {
      setIsCheckingNative(false)
    }
  }

  // ── Measure Latency & Real Ping ───────────────────────────────────────────
  const handleTestLLMPing = async (targetModelId?: string) => {
    const idToTest = targetModelId || selectedLLM
    if (!idToTest) return
    const reqId = ++llmPingReqRef.current
    setIsPingingLLM(true)
    try {
      const ping = await measureRealAIPing(idToTest)
      if (isMountedRef.current && reqId === llmPingReqRef.current) {
        setLiveLLMPing(ping)
      }
    } catch {
      if (isMountedRef.current && reqId === llmPingReqRef.current) {
        const target = modelsList.find((m) => m.id === idToTest)
        setLiveLLMPing(target?.pingMs || 120)
      }
    } finally {
      if (isMountedRef.current && reqId === llmPingReqRef.current) {
        setIsPingingLLM(false)
      }
    }
  }

  const handleTestGroqSTTPing = async (targetSTTId?: string) => {
    const idToTest = targetSTTId || selectedSTT || 'whisper-large-v3-turbo'
    const reqId = ++groqPingReqRef.current
    setIsCheckingGroqSTT(true)
    try {
      const ping = await measureRealAIPing(idToTest)
      if (isMountedRef.current && reqId === groqPingReqRef.current) {
        setGroqSTTTestResult({
          latencyMs: ping,
          text: `Ping Groq LPU: ${ping}ms`,
        })
      }
    } catch {
      if (isMountedRef.current && reqId === groqPingReqRef.current) {
        const found = sttEnginesList.find((e) => e.id === idToTest)
        setGroqSTTTestResult({
          latencyMs: found?.latencyMs || 180,
          text: `Ping Groq LPU: ~${found?.latencyMs || 180}ms`,
        })
      }
    } finally {
      if (isMountedRef.current && reqId === groqPingReqRef.current) {
        setIsCheckingGroqSTT(false)
      }
    }
  }

  // ── Auto-measure real ping on mount and when selected engines change ────────
  useEffect(() => {
    if (selectedLLM) {
      const timer = setTimeout(() => {
        void handleTestLLMPing(selectedLLM)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedLLM])

  useEffect(() => {
    const active = sttEnginesList.find((e) => e.id === selectedSTT)
    if (active && active.provider !== 'Local') {
      const timer = setTimeout(() => {
        void handleTestGroqSTTPing(selectedSTT)
      }, 0)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setGroqSTTTestResult(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedSTT, sttEnginesList])

  // ── Sync Models from API ───────────────────────────────────────────────────
  const handleSyncModels = async () => {
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
      const newModels = getAllAIModels()
      const state = modelRegistryService.getSyncState()
      setModelsList(newModels)
      setSyncMeta(state)

      if (newModels.length > 0 && !newModels.some((m) => m.id === selectedLLM)) {
        setSelectedLLM(newModels[0].id)
        saveAIModelId(newModels[0].id)
      } else if (newModels.length === 0) {
        setSelectedLLM('')
        saveAIModelId('')
      }

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
      setIsSyncing(false)
    }
  }

  // ── Save Non-Secret Settings ──────────────────────────────────────────────
  const handleSave = async () => {
    updateAppSettings({
      apiKeys: {
        llmProvider,
      },
      engines: {
        selectedLLM,
        selectedSTT,
        sttLanguage: 'auto',
        selectedMultimodal,
      },
      audio: {
        audioDeviceId: selectedDevice,
        vadThreshold: parseFloat(vadThreshold) || 0.8,
        responseLang: normalizeResponseLanguage(responseLang),
      },
    })

    settingsManager.set('selectedMultimodal', selectedMultimodal)
    saveSTTEngineId(selectedSTT)
    saveAIModelId(selectedLLM)
    saveAudioDeviceId(selectedDevice)
    saveVADThreshold(vadThreshold)
    saveResponseLanguage(responseLang)

    showToast('Đã lưu và đồng bộ toàn bộ cấu hình AI thành công!', 'success')
  }

  const currentSTT =
    sttEnginesList.find((e) => e.id === selectedSTT) ||
    sttEnginesList[0] ||
    LOCAL_WHISPER_ENGINE
  const currentLLM =
    modelsList.find((m) => m.id === selectedLLM) ||
    modelsList[0] ||
    EMPTY_PLACEHOLDER_MODEL
  const currentDevice =
    PRESET_AUDIO_DEVICES.find((d) => d.deviceId === selectedDevice) || PRESET_AUDIO_DEVICES[0]

  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-fade-in custom-scrollbar">
        {/* Header & Save Action */}
        <SettingsHeader onSave={handleSave} />

        {/* 1. API Keys Management (OS Credential Store) */}
        <APIKeysCard
          secureStorageAvailable={secureStorageAvailable}
          secureStorageWarning={secureStorageWarning}
          groqStatus={credentialStatuses['groq']}
          llmStatus={
            credentialStatuses[
              llmProvider === 'OpenAI'
                ? 'openai'
                : 'gemini'
            ] ||
            credentialStatuses['gemini'] ||
            credentialStatuses['openai']
          }
          onSaveGroqKey={handleSaveGroqKey}
          onDeleteGroqKey={handleDeleteGroqKey}
          groqVerify={groqVerify}
          onVerifyGroq={handleVerifyGroq}
          llmProvider={llmProvider}
          onLlmProviderChange={(provider) => {
            setLlmProvider(provider)
            setLlmVerify({ state: 'idle' })
            settingsManager.set('llmProvider', provider)
          }}
          onSaveLLMKey={handleSaveLLMKey}
          onDeleteLLMKey={handleDeleteLLMKey}
          llmVerify={llmVerify}
          onVerifyLLM={handleVerifyLLM}
          onVerifyRawKey={handleVerifyRawKey}
          onTestModelAvailability={async (provider, rawKey, modelId) => {
            if (!window.api?.credentials?.testModelAvailability) {
              return { available: false, message: 'Cần khởi động lại ứng dụng để nạp chức năng kiểm tra model.' }
            }
            return window.api.credentials.testModelAvailability(provider, rawKey, modelId)
          }}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onSyncModels={handleSyncModels}
        />

        {/* 2. Decoupled AI Engines: STT & LLM */}
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3.5 [&>*]:min-w-0">
          <STTEngineCard
            sttEnginesList={sttEnginesList}
            selectedSTT={selectedSTT}
            onSelectSTT={(id) => {
              setSelectedSTT(id)
              saveSTTEngineId(id)
            }}
            currentSTT={currentSTT}
            isCheckingNative={isCheckingNative}
            nativeTestResult={nativeTestResult}
            onCheckNativeEngine={handleCheckNativeEngine}
            isCheckingGroqSTT={isCheckingGroqSTT}
            groqTestResult={groqSTTTestResult}
            onCheckGroqSTT={() => handleTestGroqSTTPing()}
          />

          <LLMEngineCard
            modelsList={modelsList}
            selectedLLM={selectedLLM}
            onSelectLLM={(id) => {
              setSelectedLLM(id)
              saveAIModelId(id)
            }}
            currentLLM={currentLLM}
            isSyncing={isSyncing}
            lastSyncedAt={syncMeta.lastSyncedAt}
            modelSource={syncMeta.modelSource}
            credentialStatuses={credentialStatuses}
            livePing={liveLLMPing}
            isPinging={isPingingLLM}
            onTestPing={() => handleTestLLMPing()}
          />
        </div>

        {/* 3. Multimodal Vision Model (Screenshot Question Analyzer) */}
        <MultimodalModelCard
          selectedMultimodal={selectedMultimodal}
          onSelectMultimodal={(id) => {
            setSelectedMultimodal(id)
            settingsManager.set('selectedMultimodal', id)
          }}
        />

        {/* 4. Meeting & Audio Advanced Configurations */}
        <MeetingAudioConfigCard
          vadThreshold={vadThreshold}
          onVadThresholdChange={setVadThreshold}
          responseLang={responseLang}
          onResponseLangChange={setResponseLang}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
          currentDevice={currentDevice}
          modelRouterPolicy={modelRouterPolicy}
          onModelRouterPolicyChange={(policy) => {
            setModelRouterPolicy(policy)
            settingsManager.updateSettings({ modelRouter: { enabled: true, policy } })
          }}
        />

        {/* 5. API Cost & Token Usage Tracker Navigation Card */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-white/[0.02] to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <Coins className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-white/95">
                  Theo Dõi Chi Phí & Token Usage API
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-mono"
                >
                  Feature Riêng
                </Badge>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                Bảng điều khiển trực quan với biểu đồ chi tiêu 30 ngày, Donut chart phân bổ model, quản lý ngân sách và nhật ký request.
              </p>
            </div>
          </div>
          {onViewChange && (
            <Button
              type="button"
              onClick={() => onViewChange('cost-tracker')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 gap-1.5 shrink-0 shadow-sm font-medium transition-all"
            >
              <span>Mở Dashboard Chi Phí</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
