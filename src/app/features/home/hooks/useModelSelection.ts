import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAllAIModels,
  getSavedAIModelId,
  getSelectedModelConfig,
  measureRealAIPing,
  measureRealSTTLatency,
  getCachedLatency,
  setCachedLatency,
  getAvailableSTTEngines,
  getSavedSTTEngineId,
  type AIModelConfig,
} from '@/services/ai-model/aiModels'
import type { STTEngineConfig } from '@/services/ai-model/types'

export interface UseModelSelectionReturn {
  // Settings models
  settingModelId: string
  settingSTTId: string
  aiModels: AIModelConfig[]
  sttEngines: STTEngineConfig[]
  settingModel: AIModelConfig
  settingSTTEngine: STTEngineConfig

  // Inspected state
  inspectedModelId: string
  inspectedSTTId: string
  effectiveInspectedModelId: string
  inspectedModel: AIModelConfig
  inspectedSTTEngine: STTEngineConfig
  hasModels: boolean

  // LLM Dropdown & Ping
  isModelDropdownOpen: boolean
  isPinging: boolean
  livePing: number
  displayedInspectedPing: number
  pingError: string | null
  modelDropdownRef: React.RefObject<HTMLDivElement | null>
  setIsModelDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  handleModelInspectChange: (modelId: string) => void
  handleTestPing: (targetId?: string) => Promise<void>

  // STT Dropdown & Ping
  isSTTDropdownOpen: boolean
  isSTTPinging: boolean
  liveSTTLatency: number
  displayedInspectedSTTLatency: number
  sttPingError: string | null
  sttDropdownRef: React.RefObject<HTMLDivElement | null>
  setIsSTTDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  handleSTTInspectChange: (sttId: string) => void
  handleTestSTTPing: (targetId?: string) => Promise<void>
}

export function useModelSelection(): UseModelSelectionReturn {
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Settings state
  const [settingModelId, setSettingModelId] = useState<string>(getSavedAIModelId)
  const [settingSTTId, setSettingSTTId] = useState<string>(getSavedSTTEngineId)
  const [aiModels, setAiModels] = useState<AIModelConfig[]>(getAllAIModels)
  const [sttEngines, setSttEngines] = useState<STTEngineConfig[]>(getAvailableSTTEngines)

  const settingModel = getSelectedModelConfig(settingModelId)
  const settingSTTEngine = sttEngines.find((e) => e.id === settingSTTId) || sttEngines[0]

  // Inspected state
  const [inspectedModelId, setInspectedModelId] = useState<string>(getSavedAIModelId)
  const [inspectedSTTId, setInspectedSTTId] = useState<string>(getSavedSTTEngineId)

  const effectiveInspectedModelId =
    aiModels.find((model) => model.id === inspectedModelId)?.id ||
    aiModels[0]?.id ||
    inspectedModelId
  const inspectedModel = getSelectedModelConfig(effectiveInspectedModelId)
  const inspectedSTTEngine = sttEngines.find((e) => e.id === inspectedSTTId) || sttEngines[0]
  const hasModels = aiModels.length > 0

  // LLM Ping & Dropdown
  const [isPinging, setIsPinging] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)
  const [livePing, setLivePing] = useState<number>(() => {
    const cached = getCachedLatency(effectiveInspectedModelId)
    return cached ?? inspectedModel.pingMs ?? 120
  })
  const cachedInspectedPing = getCachedLatency(effectiveInspectedModelId)
  const displayedInspectedPing = cachedInspectedPing ?? livePing
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const pingRequestIdRef = useRef(0)

  // STT Ping & Dropdown
  const [isSTTDropdownOpen, setIsSTTDropdownOpen] = useState(false)
  const sttDropdownRef = useRef<HTMLDivElement>(null)
  const [isSTTPinging, setIsSTTPinging] = useState(false)
  const [sttPingError, setSttPingError] = useState<string | null>(null)
  const [liveSTTLatency, setLiveSTTLatency] = useState<number>(() => {
    const cached = getCachedLatency(inspectedSTTId)
    return cached ?? inspectedSTTEngine?.latencyMs ?? 150
  })
  const cachedInspectedSTTLatency = getCachedLatency(inspectedSTTId)
  const displayedInspectedSTTLatency = cachedInspectedSTTLatency ?? liveSTTLatency
  const sttPingRequestIdRef = useRef(0)

  // Sync AI Models from custom event & storage
  useEffect(() => {
    const handleModelsUpdate = () => {
      setAiModels(getAllAIModels())
      setSttEngines(getAvailableSTTEngines())
      setSettingModelId(getSavedAIModelId())
      setSettingSTTId(getSavedSTTEngineId())
    }
    window.addEventListener('ai-models-updated', handleModelsUpdate)
    window.addEventListener('storage', handleModelsUpdate)
    return () => {
      window.removeEventListener('ai-models-updated', handleModelsUpdate)
      window.removeEventListener('storage', handleModelsUpdate)
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
      if (sttDropdownRef.current && !sttDropdownRef.current.contains(event.target as Node)) {
        setIsSTTDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTestPing = useCallback(async (targetId?: string) => {
    const idToTest =
      typeof targetId === 'string' && targetId.trim()
        ? targetId.trim()
        : effectiveInspectedModelId
    if (!idToTest) return
    const reqId = ++pingRequestIdRef.current
    setIsPinging(true)
    setPingError(null)
    try {
      const realLatency = await measureRealAIPing(idToTest)
      if (isMountedRef.current && reqId === pingRequestIdRef.current) {
        setLivePing(realLatency)
        setCachedLatency(idToTest, realLatency)
        setPingError(null)
      }
    } catch {
      if (isMountedRef.current && reqId === pingRequestIdRef.current) {
        setPingError('Không đo được ping')
        const cached = getCachedLatency(idToTest)
        if (cached) {
          setLivePing(cached)
        } else {
          const target = getSelectedModelConfig(idToTest)
          setLivePing(target.pingMs || 120)
        }
      }
    } finally {
      if (isMountedRef.current && reqId === pingRequestIdRef.current) {
        setIsPinging(false)
      }
    }
  }, [effectiveInspectedModelId])

  const handleModelInspectChange = useCallback((modelId: string) => {
    setInspectedModelId(modelId)
    setIsModelDropdownOpen(false)
    setPingError(null)
    const cached = getCachedLatency(modelId)
    if (cached) {
      setLivePing(cached)
    }
    void handleTestPing(modelId)
  }, [handleTestPing])

  // Auto-measure real ping if not cached
  useEffect(() => {
    if (
      !effectiveInspectedModelId ||
      (getCachedLatency(effectiveInspectedModelId) !== null &&
        getCachedLatency(effectiveInspectedModelId) !== undefined)
    )
      return

    const timer = setTimeout(() => {
      void handleTestPing(effectiveInspectedModelId)
    }, 0)
    return () => clearTimeout(timer)
  }, [effectiveInspectedModelId, handleTestPing])

  const handleTestSTTPing = useCallback(async (targetId?: string) => {
    const idToTest =
      typeof targetId === 'string' && targetId.trim()
        ? targetId.trim()
        : inspectedSTTId
    if (!idToTest) return
    const reqId = ++sttPingRequestIdRef.current
    setIsSTTPinging(true)
    setSttPingError(null)
    try {
      const realLatency = await measureRealSTTLatency(idToTest)
      if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
        setLiveSTTLatency(realLatency)
        setCachedLatency(idToTest, realLatency)
        setSttPingError(null)
      }
    } catch {
      if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
        setSttPingError('Không đo được độ trễ')
        const cached = getCachedLatency(idToTest)
        if (cached) {
          setLiveSTTLatency(cached)
        } else {
          const target = sttEngines.find((e) => e.id === idToTest)
          setLiveSTTLatency(target?.latencyMs || 150)
        }
      }
    } finally {
      if (isMountedRef.current && reqId === sttPingRequestIdRef.current) {
        setIsSTTPinging(false)
      }
    }
  }, [inspectedSTTId, sttEngines])

  const handleSTTInspectChange = useCallback((sttId: string) => {
    setInspectedSTTId(sttId)
    setIsSTTDropdownOpen(false)
    setSttPingError(null)
    const cached = getCachedLatency(sttId)
    if (cached) {
      setLiveSTTLatency(cached)
    }
    void handleTestSTTPing(sttId)
  }, [handleTestSTTPing])

  // Auto-measure real STT latency if not cached
  useEffect(() => {
    if (
      !inspectedSTTId ||
      (getCachedLatency(inspectedSTTId) !== null &&
        getCachedLatency(inspectedSTTId) !== undefined)
    )
      return

    const timer = setTimeout(() => {
      void handleTestSTTPing(inspectedSTTId)
    }, 0)
    return () => clearTimeout(timer)
  }, [inspectedSTTId, handleTestSTTPing])

  return {
    settingModelId,
    settingSTTId,
    aiModels,
    sttEngines,
    settingModel,
    settingSTTEngine,
    inspectedModelId,
    inspectedSTTId,
    effectiveInspectedModelId,
    inspectedModel,
    inspectedSTTEngine,
    hasModels,
    isModelDropdownOpen,
    isPinging,
    livePing,
    displayedInspectedPing,
    pingError,
    modelDropdownRef,
    setIsModelDropdownOpen,
    handleModelInspectChange,
    handleTestPing,
    isSTTDropdownOpen,
    isSTTPinging,
    liveSTTLatency,
    displayedInspectedSTTLatency,
    sttPingError,
    sttDropdownRef,
    setIsSTTDropdownOpen,
    handleSTTInspectChange,
    handleTestSTTPing,
  }
}
