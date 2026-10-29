import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import { getSavedMeetingContext, isValidCvContent, isValidJdContent } from '@/services/meeting-context'
import {
  getSavedAIModelId,
  getSelectedModelConfig,
  getSavedSTTEngineId,
  getAvailableSTTEngines,
  needsVietnameseTranslation,
} from '@/services/ai-model/aiModels'
import {
  PRESET_AUDIO_DEVICES,
  getSavedAudioDeviceId,
} from '@/services/audio-devices'
import {
  jdKeywordExtractor,
  whisperPromptBuilder,
} from '@/services/ai-model/stt'
import {
  profileContextService,
  type ProfilePresetSnapshot,
} from '@/services/profile-preset'
import type { HistorySuggestion } from '@/services/session-history'
import type { ScreenCaptureState } from '@/services/screen-capture'
import type { MeetingModeProps } from './types'
import {
  useTranscript,
  useMeetingSession,
  useBackgroundAnalysis,
  useExchangeScan,
  useMeetingSummary,
  useCopilotGeneration,
  useIntentTrigger,
  useAudioCapture,
  useScreenCapture,
  useSessionRecovery,
  useMeetingHotkeys,
} from './hooks'
import {
  MeetingHeader,
  MeetingFooter,
  MissingContextGuard,
  LiveTranscriptPane,
  CopilotSuggestionPane,
  UnfinishedSessionBanner,
} from './components'
import {
  ScreenCaptureSourcePicker,
  ScreenshotCropOverlay,
} from '@/components/shared'
import { sessionsPort } from '@/infrastructure/ipc'

export function MeetingMode({ mode: controlledMode, onViewChange }: MeetingModeProps) {
  const [internalMode] = useState<AppMode>('interview')
  const mode = controlledMode ?? internalMode

  // Persistent settings & configs
  const [contextData, setContextData] = useState(() => getSavedMeetingContext())
  const [profileSnapshot, setProfileSnapshot] = useState<ProfilePresetSnapshot>(
    () => profileContextService.getActiveSnapshot()
  )

  useEffect(() => {
    const handleContextUpdate = () => {
      setContextData(getSavedMeetingContext())
      setProfileSnapshot(profileContextService.getActiveSnapshot())
    }
    const unsubProfile = profileContextService.subscribe(() => {
      handleContextUpdate()
    })
    window.addEventListener('meeting-context-updated', handleContextUpdate)
    window.addEventListener('storage', handleContextUpdate)
    return () => {
      unsubProfile()
      window.removeEventListener('meeting-context-updated', handleContextUpdate)
      window.removeEventListener('storage', handleContextUpdate)
    }
  }, [])

  const selectedModelId = getSavedAIModelId()
  const currentModel = getSelectedModelConfig(selectedModelId)
  const selectedDeviceId = getSavedAudioDeviceId()
  const matchedDevice = PRESET_AUDIO_DEVICES.find((d) => d.deviceId === selectedDeviceId)
  const currentDeviceLabel = matchedDevice?.label || 'Loopback Output'

  const savedSTTEngineId = getSavedSTTEngineId()
  const availableSTTEngines = getAvailableSTTEngines()
  const currentSTTEngine =
    availableSTTEngines.find((e) => e.id === savedSTTEngineId) || availableSTTEngines[0]
  const sttEngineLabel = currentSTTEngine ? currentSTTEngine.name.split(' (')[0] : 'Whisper'

  const activeCV =
    mode === 'interview'
      ? profileSnapshot.resumeContext || contextData.cvSummary || ''
      : contextData.cvSummary || ''
  const activeJD =
    mode === 'interview'
      ? profileSnapshot.jobDescription || contextData.jobDescription || ''
      : contextData.jobDescription || ''
  const activeKeywords = useMemo(() => {
    return mode === 'interview'
      ? profileSnapshot.keywords || contextData.keywords || []
      : contextData.discussionKeywords || []
  }, [mode, profileSnapshot.keywords, contextData.keywords, contextData.discussionKeywords])

  const hasCV = isValidCvContent(activeCV)
  const hasJD = isValidJdContent(activeJD)
  const hasInterviewContext = hasCV && hasJD
  const hasDiscussionContext = Boolean(contextData.discussionTopic && contextData.discussionTopic.trim())
  const hasActiveContext = mode === 'interview' ? hasInterviewContext : hasDiscussionContext

  // Context-Aware Whisper Initial Prompt
  const whisperPrompt = useMemo(() => {
    let kws = activeKeywords
    if (!kws || kws.length === 0) {
      if (mode === 'interview' && activeJD) {
        kws = jdKeywordExtractor.extractKeywords(activeJD)
      } else if (mode === 'discussion' && contextData.discussionTopic) {
        kws = jdKeywordExtractor.extractKeywords(contextData.discussionTopic)
      }
    }
    return whisperPromptBuilder.buildPrompt(kws || [], {
      contextType: mode,
    })
  }, [activeKeywords, activeJD, contextData.discussionTopic, mode])

  const scrollRef = useRef<HTMLDivElement>(null)
  const aiSuggestionsHistoryRef = useRef<HistorySuggestion[]>([])

  // 1. Session Manager
  const session = useMeetingSession({
    mode,
    profileSnapshot,
    discussionTopic: contextData.discussionTopic,
    currentModelName: currentModel.name,
    currentModelProvider: currentModel.provider,
    currentDeviceLabel,
    hasInterviewContext,
    hasDiscussionContext,
    hasActiveContext,
    activeCV,
  })

  // 2. Meeting Summary
  const summary = useMeetingSummary()

  // 3. Background Context Analysis & Cache Prewarm
  const background = useBackgroundAnalysis({
    mode,
    activeCV,
    activeJD,
    discussionTopic: contextData.discussionTopic,
    sessionId: session.sessionId,
    profileSnapshot,
  })

  // 4. Exchange Scan
  const exchange = useExchangeScan()

  // 5. Copilot Generation
  const copilot = useCopilotGeneration({
    mode,
    sessionId: session.sessionId,
    activeCV,
    activeJD,
    cvAnalysis: background.cvAnalysis,
    discussionAnalysis: background.discussionAnalysis,
    discussionTopic: contextData.discussionTopic,
    meetingSummary: summary.meetingSummary,
    latestIntent: null, // Hook will read latest from trigger via caller
    aiSuggestionsHistoryRef,
    setContextUsage: () => {}, // Managed via trigger
  })

  // 6. Transcript
  const transcript = useTranscript({
    responseLang: copilot.responseLang,
  })

  // 7. Intent Trigger
  const trigger = useIntentTrigger({
    mode,
    sessionId: session.sessionId,
    validLines: transcript.validLines,
    isListening: false, // Updated with audio capture below
    isCapturing: false,
    isGeneratingAIResponse: copilot.isGeneratingAIResponse,
    cancelCurrentStream: copilot.cancelStream,
    onTriggerCopilot: async (targetExchange) => {
      exchange.setLatestExchange(targetExchange)
      await copilot.handleGenerateCopilotResponse(transcript.validLines, null, targetExchange)
    },
  })

  // 8. Screen Capture & Multimodal
  const capture = useScreenCapture({
    mode,
    sessionId: session.sessionId,
    activeCV,
    activeJD,
    discussionTopic: contextData.discussionTopic,
    responseLang: copilot.responseLang,
    setAiError: copilot.setAiError,
  })

  // 9. Audio Capture
  const handleStoppedListening = useCallback(async () => {
    if (transcript.validLines.length > 0) {
      const scanned = exchange.scanExchange(transcript.validLines, mode)
      if (scanned) {
        trigger.setIsLatestAQuestion(scanned.isQuestion)
      }

      if (mode === 'interview') {
        void summary.handleGenerateSummary(transcript.validLines, mode, copilot.responseLang)
        await copilot.handleGenerateCopilotResponse(transcript.validLines, null, scanned)
      } else {
        const readySummary = summary.meetingSummary || ''
        const copilotPromise = copilot.handleGenerateCopilotResponse(
          transcript.validLines,
          readySummary,
          scanned
        )
        const summaryPromise = summary.handleGenerateSummary(
          transcript.validLines,
          mode,
          copilot.responseLang
        )
        await Promise.allSettled([copilotPromise, summaryPromise])
      }
    } else {
      copilot.setAiError(
        'Chưa nhận diện được câu nào trong phiên thu âm này, nên không có gì để AI phân tích.'
      )
    }
  }, [transcript.validLines, exchange, mode, summary, copilot, trigger])

  const audio = useAudioCapture({
    mode,
    sessionId: session.sessionId,
    sttLang: transcript.sttLang,
    activeKeywords,
    fallbackPrompt: whisperPrompt,
    selectedDeviceId,
    onStoppedListening: handleStoppedListening,
  })

  // 10. Session Recovery
  const recovery = useSessionRecovery({
    sessionId: session.sessionId,
    sessionTitle: session.currentSessionTitle,
    mode,
    meetingStartTime: session.meetingStartTime,
    validLines: transcript.validLines,
    visualQuestionsHistory: capture.visualQuestionsHistory,
    isSavedToHistory: session.isSavedToHistory,
    onSessionRestored: session.setSessionId,
  })

  // 11. Hotkeys
  useMeetingHotkeys({
    onTriggerScreenCapture: capture.handleTriggerScreenCapture,
  })

  // Master Clear Transcript & Reset
  const handleMasterClearTranscript = useCallback(() => {
    const activeSessionId = session.sessionId
    if (activeSessionId) {
      void sessionsPort.recovery.complete(activeSessionId, 'discarded')
    }
    transcript.handleClearTranscript()
    exchange.resetExchange()
    summary.resetSummary()
    copilot.resetCopilot()
    capture.clearVisuals()
    session.resetSession()
    trigger.setContextUsage(null)
  }, [session, transcript, exchange, summary, copilot, capture, trigger])

  // Master Save to History
  const handleMasterSaveToHistory = useCallback(async () => {
    await session.handleSaveToHistory({
      validLines: transcript.validLines,
      aiSuggestionsHistory: aiSuggestionsHistoryRef.current,
      currentSuggestions: copilot.suggestions,
      visualQuestionsHistory: capture.visualQuestionsHistory,
      contextUsage: trigger.contextUsage,
    })
  }, [session, transcript.validLines, copilot.suggestions, capture.visualQuestionsHistory, trigger.contextUsage])

  const uiCaptureState: ScreenCaptureState =
    capture.captureState === 'done'
      ? 'completed'
      : capture.captureState === 'picking'
      ? 'idle'
      : capture.captureState

  // Guard: In interview mode, both CV and JD are required
  if (mode === 'interview' && (!hasCV || !hasJD)) {
    return (
      <MissingContextGuard
        hasCV={hasCV}
        hasJD={hasJD}
        onViewChange={onViewChange}
      />
    )
  }

  return (
    <div className="flex flex-col h-full bg-transparent select-none animate-fade-in">
      {/* Header with Mode, Controls, and Context Strip */}
      <MeetingHeader
        mode={mode}
        sessionTitle={session.currentSessionTitle}
        onSessionTitleChange={session.setCustomSessionTitle}
        isSavedToHistory={session.isSavedToHistory}
        onSaveToHistory={handleMasterSaveToHistory}
        isCapturing={audio.isCapturing}
        isListening={audio.isListening}
        isTranscribing={transcript.isTranscribing}
        queueMetrics={transcript.queueMetrics}
        onToggleListening={audio.handleToggleListening}
        contextData={contextData}
        hasActiveContext={hasActiveContext}
        hasDiscussionContext={hasDiscussionContext}
        isAnalyzingBackground={background.isAnalyzingBackground}
        responseLang={copilot.responseLang}
        onResponseLangChange={copilot.handleResponseLangChange}
        onTriggerScreenCapture={capture.handleTriggerScreenCapture}
        screenCaptureState={uiCaptureState}
      />

      {/* Unfinished Session Recovery Banner */}
      <UnfinishedSessionBanner
        unfinishedRecovery={recovery.unfinishedRecovery}
        isOpen={recovery.isRecoveryOpen}
        onRestore={recovery.handleRestoreRecovery}
        onFinalize={() => void recovery.handleCompleteRecovery('completed')}
        onDiscard={() => void recovery.handleCompleteRecovery('discarded')}
      />

      {/* Main Split: Transcript & AI Response */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <LiveTranscriptPane
          sourceType={audio.sourceType}
          onSwitchSource={audio.handleSwitchSource}
          validLines={transcript.validLines}
          latestLine={transcript.latestLine}
          latestExchange={exchange.latestExchange}
          isScanningExchange={exchange.isScanningExchange}
          isCapturing={audio.isCapturing}
          isListening={audio.isListening}
          isTranscribing={transcript.isTranscribing}
          queueMetrics={transcript.queueMetrics}
          onClearTranscript={handleMasterClearTranscript}
          onToggleListening={audio.handleToggleListening}
          scrollRef={scrollRef}
          sttEngineLabel={sttEngineLabel}
          mode={mode}
          meetingSummary={summary.meetingSummary}
          isSummarizing={summary.isSummarizing}
          summaryError={summary.summaryError}
          copiedSummary={summary.copiedSummary}
          onCopySummary={summary.handleCopySummary}
          onGenerateSummary={(lines) => summary.handleGenerateSummary(lines, mode, copilot.responseLang)}
          showTranslate={needsVietnameseTranslation(copilot.responseLang)}
          sttLang={transcript.sttLang}
          onSttLangChange={transcript.handleSttLangChange}
        />

        <CopilotSuggestionPane
          mode={mode}
          isLatestAQuestion={trigger.isLatestAQuestion}
          isGeneratingAIResponse={copilot.isGeneratingAIResponse}
          currentModel={currentModel}
          customInterviewAnswer={copilot.customInterviewAnswer}
          isShortened={copilot.isShortened}
          onToggleShorten={copilot.handleToggleShorten}
          isRegenerating={copilot.isRegenerating}
          onRegenerate={() => copilot.handleRegenerate(transcript.validLines, exchange.latestExchange)}
          copiedAnswer={copilot.copiedAnswer}
          onCopyAnswer={copilot.handleCopyAnswer}
          customDiscussionSuggestions={copilot.customDiscussionSuggestions}
          copiedOptionId={copilot.copiedOptionId}
          onCopyOption={copilot.handleCopyOption}
          aiError={copilot.aiError}
          hasTranscript={transcript.validLines.length > 0}
          onOpenSettings={onViewChange ? () => onViewChange('settings') : undefined}
          showTranslate={needsVietnameseTranslation(copilot.responseLang)}
          triggerMode={trigger.triggerMode}
          onTriggerModeChange={trigger.handleTriggerModeChange}
          latestIntent={trigger.latestIntent}
          semiAutoPendingQuestion={trigger.semiAutoPendingQuestion}
          onTriggerSemiAuto={() =>
            copilot.handleGenerateCopilotResponse(transcript.validLines, null, exchange.latestExchange)
          }
          answerStrategyId={copilot.answerStrategyOverride}
          onAnswerStrategyChange={copilot.setAnswerStrategyOverride}
          contextUsage={trigger.contextUsage}
          visualQuestion={capture.activeVisualQuestion}
          isAnalyzingVisual={capture.captureState === 'processing'}
          onDismissVisualQuestion={capture.handleDismissVisualQuestion}
          onTriggerScreenCapture={capture.handleTriggerScreenCapture}
          screenCaptureState={uiCaptureState}
          onToggleCorrectedAnswer={copilot.handleToggleCorrectedAnswer}
        />
      </div>

      {/* Footer */}
      <MeetingFooter
        modelName={currentModel.name}
        sttEngineLabel={sttEngineLabel}
        isCapturing={audio.isCapturing}
        isListening={audio.isListening}
        transcriptCount={transcript.transcriptLines.length}
      />

      {/* Interactive Screenshot Modals */}
      {capture.isScreenSourcePickerOpen && (
        <ScreenCaptureSourcePicker
          onSelect={capture.handleStartScreenCapture}
          onCancel={capture.handleCancelPicker}
        />
      )}

      {capture.captureState === 'cropping' && capture.capturedImageInfo && (
        <ScreenshotCropOverlay
          imageInfo={capture.capturedImageInfo}
          onConfirmCrop={capture.handleConfirmCrop}
          onCancel={capture.handleCancelCrop}
          onRetake={capture.handleRetakeCrop}
        />
      )}
    </div>
  )
}
