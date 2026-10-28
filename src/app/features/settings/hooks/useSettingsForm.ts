import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAllAIModels,
  getSavedAIModelId,
  saveAIModelId,
  getAvailableSTTEngines,
  LOCAL_WHISPER_ENGINE,
  getSavedSTTEngineId,
  saveSTTEngineId,
  getSavedVADThreshold,
  saveVADThreshold,
  getSavedResponseLanguage,
  saveResponseLanguage,
  EMPTY_PLACEHOLDER_MODEL,
  type AIModelConfig,
  type STTEngineConfig,
} from '@/services/ai-model/aiModels'
import {
  PRESET_AUDIO_DEVICES,
  getSavedAudioDeviceId,
  saveAudioDeviceId,
} from '@/services/audio-devices'
import { normalizeResponseLanguage } from '@/services/ai-model/language'
import {
  getAppSettings,
  updateAppSettings,
  settingsManager,
} from '@/services/settings'
import { showToast } from '@/components/ui/toast'
import type { LLMProviderOption } from '../types'

export function useSettingsForm() {
  const currentSettings = getAppSettings()

  // 1. Core Engine States
  const [llmProvider, setLlmProvider] = useState<LLMProviderOption>(
    currentSettings.apiKeys.llmProvider
  )
  const [sttEnginesList, setSttEnginesList] = useState<STTEngineConfig[]>(() =>
    getAvailableSTTEngines()
  )
  const [selectedSTT, setSelectedSTT] = useState(getSavedSTTEngineId)
  const [selectedLLM, setSelectedLLM] = useState(getSavedAIModelId)
  const [selectedMultimodal, setSelectedMultimodal] = useState<string>(
    () => (settingsManager.get('selectedMultimodal') as string) || ''
  )
  const [modelsList, setModelsList] = useState<AIModelConfig[]>(() => getAllAIModels())

  // 2. Audio & Meeting Configuration States
  const [selectedDevice, setSelectedDevice] = useState(getSavedAudioDeviceId)
  const [vadThreshold, setVadThreshold] = useState(getSavedVADThreshold)
  const [responseLang, setResponseLang] = useState(getSavedResponseLanguage)
  const [modelRouterPolicy, setModelRouterPolicy] = useState(currentSettings.modelRouter.policy)
  const [segmentationMode, setSegmentationMode] = useState<'sentence' | 'fixed'>(
    () => (settingsManager.get('segmentationMode') as 'sentence' | 'fixed') || 'sentence'
  )
  const [silenceEndMs, setSilenceEndMs] = useState<number>(
    () => (settingsManager.get('silenceEndMs') as number) || 400
  )
  const [maxSegmentMs, setMaxSegmentMs] = useState<number>(
    () => (settingsManager.get('maxSegmentMs') as number) || 4500
  )

  // Listen to models sync updates event
  useEffect(() => {
    const handleModelsUpdate = () => {
      setModelsList(getAllAIModels())
    }
    window.addEventListener('ai-models-updated', handleModelsUpdate)
    return () => window.removeEventListener('ai-models-updated', handleModelsUpdate)
  }, [])

  // Auto-correct selected LLM if missing from current list
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

  // Save non-secret settings handler
  const handleSaveSettings = useCallback(async () => {
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
  }, [
    llmProvider,
    selectedLLM,
    selectedSTT,
    selectedMultimodal,
    selectedDevice,
    vadThreshold,
    responseLang,
  ])

  const currentSTT = useMemo(
    () =>
      sttEnginesList.find((e) => e.id === selectedSTT) ||
      sttEnginesList[0] ||
      LOCAL_WHISPER_ENGINE,
    [sttEnginesList, selectedSTT]
  )

  const currentLLM = useMemo(
    () =>
      modelsList.find((m) => m.id === selectedLLM) ||
      modelsList[0] ||
      EMPTY_PLACEHOLDER_MODEL,
    [modelsList, selectedLLM]
  )

  const currentDevice = useMemo(
    () =>
      PRESET_AUDIO_DEVICES.find((d) => d.deviceId === selectedDevice) ||
      PRESET_AUDIO_DEVICES[0],
    [selectedDevice]
  )

  return {
    llmProvider,
    setLlmProvider,
    sttEnginesList,
    setSttEnginesList,
    selectedSTT,
    setSelectedSTT,
    selectedLLM,
    setSelectedLLM,
    selectedMultimodal,
    setSelectedMultimodal,
    modelsList,
    setModelsList,
    selectedDevice,
    setSelectedDevice,
    vadThreshold,
    setVadThreshold,
    responseLang,
    setResponseLang,
    modelRouterPolicy,
    setModelRouterPolicy,
    segmentationMode,
    setSegmentationMode,
    silenceEndMs,
    setSilenceEndMs,
    maxSegmentMs,
    setMaxSegmentMs,
    handleSaveSettings,
    currentSTT,
    currentLLM,
    currentDevice,
  }
}

