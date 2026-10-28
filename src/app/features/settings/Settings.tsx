import { SettingsHeader } from './components/header'
import {
  APIKeysCard,
  STTEngineCard,
  LLMEngineCard,
  MultimodalModelCard,
  MeetingAudioConfigCard,
  CostTrackerNavCard,
} from './components/cards'
import {
  useSettingsForm,
  useModelSync,
  useCredentialManagement,
  useWhisperEngineCheck,
  useAIPingMeasurement,
} from './hooks'
import { saveAIModelId, saveSTTEngineId } from '@/services/ai-model/aiModels'
import { settingsManager } from '@/services/settings'

export interface SettingsProps {
  onViewChange?: (view: any) => void
}

export function Settings({ onViewChange }: SettingsProps = {}) {
  // 1. Settings Form State
  const {
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
  } = useSettingsForm()

  // 2. AI Model Sync
  const {
    syncMeta,
    setSyncMeta,
    isSyncing,
    syncStatus,
    setSyncStatus,
    syncModelsSelection,
    handleSyncModels,
  } = useModelSync({
    selectedLLM,
    setSelectedLLM,
    setModelsList,
  })

  // 3. Credential Management (OS Credential Store)
  const {
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
  } = useCredentialManagement({
    llmProvider,
    selectedLLM,
    selectedSTT,
    setSelectedLLM,
    setSelectedSTT,
    setModelsList,
    setSttEnginesList,
    syncModelsSelection,
    setSyncMeta,
    setSyncStatus,
  })

  // 3. Local Whisper Native Engine Check
  const { isCheckingNative, nativeTestResult, handleCheckNativeEngine } =
    useWhisperEngineCheck({
      selectedSTT,
      setSelectedSTT,
      setSttEnginesList,
    })

  // 4. Live AIPing Measurements (LLM & Groq LPU)
  const {
    liveLLMPing,
    isPingingLLM,
    isCheckingGroqSTT,
    groqSTTTestResult,
    handleTestLLMPing,
    handleTestGroqSTTPing,
  } = useAIPingMeasurement({
    selectedLLM,
    selectedSTT,
    modelsList,
    sttEnginesList,
  })

  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-fade-in custom-scrollbar">
        {/* Header & Save Action */}
        <SettingsHeader onSave={handleSaveSettings} />

        {/* 1. API Keys Management (OS Credential Store) */}
        <APIKeysCard
          secureStorageAvailable={secureStorageAvailable}
          secureStorageWarning={secureStorageWarning}
          groqStatus={credentialStatuses['groq']}
          llmStatus={
            credentialStatuses[
              llmProvider === 'OpenAI' ? 'openai' : 'gemini'
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
          onTestModelAvailability={handleTestModelAvailability}
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
          segmentationMode={segmentationMode}
          onSegmentationModeChange={(mode) => {
            setSegmentationMode(mode)
            settingsManager.set('segmentationMode', mode)
          }}
          silenceEndMs={silenceEndMs}
          onSilenceEndMsChange={(ms) => {
            setSilenceEndMs(ms)
            settingsManager.set('silenceEndMs', ms)
          }}
          maxSegmentMs={maxSegmentMs}
          onMaxSegmentMsChange={(ms) => {
            setMaxSegmentMs(ms)
            settingsManager.set('maxSegmentMs', ms)
          }}
        />

        {/* 5. API Cost & Token Usage Tracker Navigation Card */}
        <CostTrackerNavCard onViewChange={onViewChange} />
      </div>
    </div>
  )
}
