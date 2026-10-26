import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import { getSavedMeetingContext } from '../../services/meetingContext'
import {
  getSavedAIModelId,
  getSelectedModelConfig,
  getSavedSTTEngineId,
  getAvailableSTTEngines,
  getSavedResponseLanguage,
  saveResponseLanguage,
  normalizeResponseLanguage,
  needsVietnameseTranslation,
  STORAGE_KEYS,
  type ResponseLanguage,
} from '../../services/ai-model/aiModels'
import { getSavedAudioDeviceId, PRESET_AUDIO_DEVICES } from '../../services/audioDevices'
import { saveSessionToHistory, type MeetingSession, type HistorySuggestion } from '../../services/sessionHistory'
import { useAudioPipeline } from '../../hooks/useAudioPipeline'
import {
  sttJobQueue,
  type STTJob,
  type STTQueueMetrics,
  jdKeywordExtractor,
  whisperPromptBuilder,
} from '../../services/ai-model/stt'
import { profileContextService, type ProfilePresetSnapshot } from '../../services/profile-preset'
import { summarizeMeetingTranscripts } from '../../services/ai-model/summaryService'
import {
  analyzeCvBackground,
  analyzeDiscussionBackground,
  getCachedCvAnalysis,
  getCachedDiscussionAnalysis,
  generateDiscussionOptions,
  isQuestionUtterance,
  extractHeuristicLatestExchange,
  scanLatestExchangeWithAI,
  type ScannedExchangeResult,
} from '../../services/ai-model/copilotResponseService'
import type {
  MeetingModeProps,
  TranscriptLine,
  AISuggestion,
  InterviewVariation,
} from './types'
import { MissingContextGuard } from './components/MissingContextGuard'
import { MeetingHeader } from './components/MeetingHeader'
import { LiveTranscriptPane } from './components/LiveTranscriptPane'
import { CopilotSuggestionPane } from './components/CopilotSuggestionPane'
import { MeetingFooter } from './components/MeetingFooter'
import { ScreenshotCropOverlay } from './components/ScreenshotCropOverlay'
import { ScreenCaptureSourcePicker } from './components/ScreenCaptureSourcePicker'
import {
  screenCaptureService,
  visualQuestionAnalyzer,
  ocrService,
  type ScreenCaptureState,
  type CapturedImageInfo,
  type VisualQuestionItem,
  type CropRect,
} from '../../services/screen-capture'
import {
  getEffectiveVadEnergyThreshold,
  getVADCalibration,
} from '../../services/vad-calibration'
import {
  classifyIntent,
  detectIntentFromRecentLines,
  getAdaptiveDebounceMs,
  type IntentDetectionResult,
  type TriggerMode,
  tieredContextManager,
  type ContextUsageInfo,
  type AnswerStrategyId,
  validateAnswerGrounding,
  validateAnswerGroundingAsync,
} from '../../services/ai-model/copilot'
import { settingsManager } from '../../services/settings/settingsManager'
import { usageTrackerService } from '../../services/usage-tracker'
import { useStreamingAnswer } from '@/hooks/useStreamingAnswer'

export function MeetingMode({ mode: controlledMode, onViewChange }: MeetingModeProps) {
  const [internalMode] = useState<AppMode>('interview')
  const mode = controlledMode ?? internalMode
  const [isListening, setIsListening] = useState(false)
  const [isSavedToHistory, setIsSavedToHistory] = useState(false)
  const [isShortened, setIsShortened] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  /** Ngôn ngữ phản hồi của AI (Settings → Ngôn ngữ phản hồi của AI). */
  const [responseLang, setResponseLang] = useState<ResponseLanguage>(() =>
    normalizeResponseLanguage(getSavedResponseLanguage())
  )
  const [answerStrategyOverride, setAnswerStrategyOverride] = useState<AnswerStrategyId | undefined>()
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [copiedOptionId, setCopiedOptionId] = useState<number | null>(null)

  // Real-time Audio Pipeline & STT
  const {
    isCapturing,
    sourceType,
    setSourceType,
    startCapture,
    stopCapture,
    getAudioSegmentSince,
    clearBuffer,
    switchDevice,
    setVadEnergyThreshold,
  } = useAudioPipeline()

  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const validLines = transcriptLines.filter((l): l is TranscriptLine => l != null)
  const latestLine = validLines.length > 0 ? validLines[validLines.length - 1] : null

  // Lifecycle, timer tracking & race condition guards
  const isMountedRef = useRef(true)
  const isTogglingAudioRef = useRef(false)
  const isCapturingScreenRef = useRef(false)
  const switchSourceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const retakeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const copyAnswerTimerRef = useRef<NodeJS.Timeout | null>(null)
  const copyOptionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const copySummaryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveHistoryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const validLinesRef = useRef<TranscriptLine[]>([])

  // Latest Exchange auto-scanned from fragmented transcripts in original language
  const [latestExchange, setLatestExchange] = useState<ScannedExchangeResult | null>(null)
  const [isScanningExchange, setIsScanningExchange] = useState<boolean>(false)
  const exchangeScanTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestExchangeRef = useRef<ScannedExchangeResult | null>(null)

  useEffect(() => {
    validLinesRef.current = validLines
    latestExchangeRef.current = latestExchange
  }, [validLines, latestExchange])
  /** Chữ ký nội dung lần quét gần nhất — bỏ qua nếu lượt nói chưa đổi. */
  const lastExchangeSignatureRef = useRef<string>('')
  /** Thời điểm quét gần nhất — dùng để giãn nhịp gọi LLM. */
  const lastExchangeScanAtRef = useRef<number>(0)

  /** Ghi nhận vừa quét xong để bộ giãn nhịp biết mà bỏ qua các lần lặp. */
  const markExchangeScanned = () => {
    lastExchangeScanAtRef.current = Date.now()
    lastExchangeSignatureRef.current =
      extractHeuristicLatestExchange(validLines, mode)?.original || ''
  }

  // AI Meeting Summary State
  const [meetingSummary, setMeetingSummary] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  // Load persistent settings
  const contextData = getSavedMeetingContext()
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

  // Snapshot active profile upon entering the meeting (immutable snapshot)
  const profileSnapshot = useMemo<ProfilePresetSnapshot>(
    () => profileContextService.getActiveSnapshot(),
    []
  )

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

  const hasCV = Boolean(activeCV && activeCV.trim())
  const hasJD = Boolean(activeJD && activeJD.trim())
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

  // Background Context Analysis
  const [cvAnalysis, setCvAnalysis] = useState<string>(() => {
    return getCachedCvAnalysis(activeCV, activeJD) || ''
  })
  const [discussionAnalysis, setDiscussionAnalysis] = useState<string>(() => {
    return getCachedDiscussionAnalysis(contextData.discussionTopic || '') || ''
  })
  const [isAnalyzingBackground, setIsAnalyzingBackground] = useState<boolean>(false)
  const analyzedKeyRef = useRef<string>('')

  // Dynamic AI Copilot Responses
  const [customInterviewAnswer, setCustomInterviewAnswer] = useState<InterviewVariation | null>(null)
  const [customDiscussionSuggestions, setCustomDiscussionSuggestions] = useState<AISuggestion[] | null>(null)
  const [isLatestAQuestion, setIsLatestAQuestion] = useState<boolean>(false)
  const [isGeneratingAIResponse, setIsGeneratingAIResponse] = useState<boolean>(false)
  const isGeneratingAIResponseRef = useRef<boolean>(false)
  useEffect(() => {
    isGeneratingAIResponseRef.current = isGeneratingAIResponse
  }, [isGeneratingAIResponse])

  const streamingAnswer = useStreamingAnswer()

  const handleToggleCorrectedAnswer = useCallback(() => {
    setCustomInterviewAnswer((prev) => {
      if (!prev || !prev.grounding?.correctedAnswer) return prev
      const applied = !prev.appliedCorrected
      return {
        ...prev,
        appliedCorrected: applied,
        content: applied
          ? prev.grounding.correctedAnswer
          : prev.grounding.originalAnswer || prev.content,
      }
    })
  }, [])
  const aiSuggestionsHistoryRef = useRef<HistorySuggestion[]>([])
  /** Lỗi khi gọi LLM — hiển thị thẳng cho người dùng thay vì nội dung giả. */
  const [aiError, setAiError] = useState<string | null>(null)
  /** Lỗi khi gọi LLM tóm tắt cuộc họp. */
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // ── Screenshot Capture & Multimodal Visual Analysis ──────────────────────
  const [screenCaptureState, setScreenCaptureState] = useState<ScreenCaptureState>('idle')
  const [isScreenSourcePickerOpen, setIsScreenSourcePickerOpen] = useState(false)
  const [capturedImageInfo, setCapturedImageInfo] = useState<CapturedImageInfo | null>(null)
  const [activeVisualQuestion, setActiveVisualQuestion] = useState<VisualQuestionItem | null>(null)
  const [visualQuestionsHistory, setVisualQuestionsHistory] = useState<VisualQuestionItem[]>([])
  const [initialStartTime] = useState(() => Date.now())
  const meetingStartTimeRef = useRef<number>(initialStartTime)

  // Keep references updated for leak-free unmount cleanup
  const capturedImageInfoRef = useRef<CapturedImageInfo | null>(null)
  const activeVisualQuestionRef = useRef<VisualQuestionItem | null>(null)
  const visualQuestionsHistoryRef = useRef<VisualQuestionItem[]>([])
  const lastScreenSourceRef = useRef<{ sourceType: 'screen' | 'window'; sourceId?: string }>({
    sourceType: 'screen',
  })

  useEffect(() => {
    capturedImageInfoRef.current = capturedImageInfo
    activeVisualQuestionRef.current = activeVisualQuestion
    visualQuestionsHistoryRef.current = visualQuestionsHistory
  }, [capturedImageInfo, activeVisualQuestion, visualQuestionsHistory])

  // Intelligent Copilot Trigger Mode & Intent Detection
  const [triggerMode, setTriggerMode] = useState<TriggerMode>(() => {
    return (settingsManager.get('triggerMode') as TriggerMode) || 'auto'
  })
  const [latestIntent, setLatestIntent] = useState<IntentDetectionResult | null>(null)
  const [semiAutoPendingQuestion, setSemiAutoPendingQuestion] = useState<string | null>(null)
  const [contextUsage, setContextUsage] = useState<ContextUsageInfo | null>(null)
  const copilotDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleTriggerModeChange = (newMode: TriggerMode) => {
    setTriggerMode(newMode)
    settingsManager.set('triggerMode', newMode)
  }

  const [isTranscribing, setIsTranscribing] = useState(false)
  const [queueMetrics, setQueueMetrics] = useState<STTQueueMetrics>(() => sttJobQueue.getMetrics())
  const sequenceIdRef = useRef(1)
  const [initialSessionId] = useState(() => `session_${Date.now()}`)
  const sessionIdRef = useRef<string>(initialSessionId)
  const [unfinishedRecovery, setUnfinishedRecovery] = useState<any | null>(null)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(true)
  const lastProcessedSampleRef = useRef(0)
  const lastTranscriptTextRef = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // STT Input Audio Language (Default to 'vi' for Vietnamese speech accuracy)
  const [sttLang, setSttLang] = useState<'auto' | 'vi' | 'en'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STT_LANGUAGE)
    return saved === 'en' || saved === 'auto' ? saved : 'vi'
  })

  const handleRestoreRecovery = () => {
    const recovered = unfinishedRecovery?.snapshot
    if (!recovered) return
    const recoveredLines = Array.isArray(recovered.transcripts) ? recovered.transcripts : []
    setTranscriptLines(recoveredLines)
    if (typeof recovered.id === 'string') sessionIdRef.current = recovered.id
    setUnfinishedRecovery(null)
    setIsRecoveryOpen(false)
  }

  const handleCompleteRecovery = async (lifecycle: 'completed' | 'discarded') => {
    const sessionId = unfinishedRecovery?.sessionId
    if (sessionId) await window.api.sessions?.recovery?.complete(sessionId, lifecycle)
    setUnfinishedRecovery(null)
    setIsRecoveryOpen(false)
  }

  const handleSttLangChange = (lang: 'auto' | 'vi' | 'en') => {
    setSttLang(lang)
    localStorage.setItem(STORAGE_KEYS.STT_LANGUAGE, lang)
  }

  // Run background analysis strictly ONCE per unique context
  useEffect(() => {
    let isMounted = true
    const currentKey =
      mode === 'interview'
        ? `interview_${activeCV.trim()}:::${activeJD.trim()}`
        : `discussion_${contextData.discussionTopic?.trim() || ''}`

    if (analyzedKeyRef.current === currentKey) return
    analyzedKeyRef.current = currentKey

    const runBackgroundAnalysis = async () => {
      if (mode === 'interview') {
        const cached = getCachedCvAnalysis(activeCV, activeJD)
        if (cached) {
          if (isMounted) setCvAnalysis(cached)
          return
        }
      } else {
        const cached = getCachedDiscussionAnalysis(contextData.discussionTopic || '')
        if (cached) {
          if (isMounted) setDiscussionAnalysis(cached)
          return
        }
      }

      if (
        (mode === 'interview' && (activeCV || activeJD)) ||
        (mode === 'discussion' && contextData.discussionTopic)
      ) {
        if (isMounted) setIsAnalyzingBackground(true)
        try {
          if (mode === 'interview') {
            const result = await analyzeCvBackground(activeCV, activeJD)
            if (isMounted) setCvAnalysis(result)
          } else {
            const result = await analyzeDiscussionBackground(contextData.discussionTopic || '')
            if (isMounted) setDiscussionAnalysis(result)
          }
        } catch (err) {
          console.warn('[MeetingMode] Background analysis error:', err)
        } finally {
          if (isMounted) setIsAnalyzingBackground(false)
        }
      }
    }
    runBackgroundAnalysis()
    return () => {
      isMounted = false
    }
  }, [mode, activeCV, activeJD, contextData.discussionTopic])

  // Synchronize Tier 1 Permanent Context to TieredContextManager
  useEffect(() => {
    tieredContextManager.setPermanentContext({
      cvSummary: activeCV,
      jobDescription: activeJD,
      role: mode === 'interview' ? profileSnapshot.role : undefined,
      companyName: mode === 'interview' ? profileSnapshot.companyName : undefined,
      customInstructions: mode === 'interview' ? profileSnapshot.customInstructions : undefined,
      presetName: mode === 'interview' ? profileSnapshot.name : undefined,
      discussionTopic: contextData.discussionTopic,
      meetingObjective: contextData.discussionTopic,
      backgroundAnalysis: mode === 'interview' ? cvAnalysis : discussionAnalysis,
    })
  }, [activeCV, activeJD, profileSnapshot, contextData, mode, cvAnalysis, discussionAnalysis])

  // Sync initial audio source type based on selected audio device
  useEffect(() => {
    const devId = selectedDeviceId.toLowerCase()
    if (devId.includes('mic') || devId.includes('input')) {
      setSourceType('mic')
    } else {
      setSourceType('system')
    }
  }, [selectedDeviceId, setSourceType])

  // Synchronize isListening if capture ends unexpectedly or externally (e.g. mic unplugged)
  useEffect(() => {
    if (!isCapturing && isListening && !isTogglingAudioRef.current) {
      setIsListening(false)
    }
  }, [isCapturing, isListening])

  // Dynamically switch microphone device on the fly without restarting meeting session
  useEffect(() => {
    if (isCapturing && sourceType === 'mic' && selectedDeviceId) {
      switchDevice(selectedDeviceId).catch((err) =>
        console.warn('[MeetingMode] switchDevice on the fly error:', err)
      )
    }
  }, [selectedDeviceId, isCapturing, sourceType, switchDevice])

  // Synchronize calibrated VAD speech threshold for active microphone device
  useEffect(() => {
    if (selectedDeviceId) {
      const effectiveThreshold = getEffectiveVadEnergyThreshold(selectedDeviceId)
      setVadEnergyThreshold(effectiveThreshold)
      const calib = getVADCalibration(selectedDeviceId)
      if (calib) {
        console.log(
          `[MeetingMode] Loaded calibrated VAD threshold for device "${selectedDeviceId}": ${calib.speechThresholdDbfs} dBFS (${calib.quality})`
        )
      }
    }
  }, [selectedDeviceId, setVadEnergyThreshold])

  // ── 1. Hot-swap STT provider and concurrency limit on engine change ─────────
  useEffect(() => {
    sttJobQueue.handleProviderSwitch(savedSTTEngineId)
  }, [savedSTTEngineId])

  // ── 2. Subscribe to STTJobQueue metrics and TranscriptAssembler monotonic commits ─
  useEffect(() => {
    // Pre-warm the persistent whisper-server with 1s silence on Meeting Mode mount
    if (window.api?.nativeWhisper?.prewarm) {
      window.api.nativeWhisper.prewarm().catch((err) => {
        console.warn('[MeetingMode] STT Prewarm warning:', err)
      })
    }

    const unsubMetrics = sttJobQueue.subscribe((m) => {
      setQueueMetrics(m)
      setIsTranscribing(m.processingJobs > 0 || m.queueDepth > 0)
    })

    const unsubCommit = sttJobQueue.assembler.onCommit((commit) => {
      const { result, speakerLabel, timestampStr } = commit
      if (result.success && result.text.trim()) {
        lastTranscriptTextRef.current = result.text.trim()

        const newLine: TranscriptLine = {
          id: Date.now() + Math.random(),
          timestamp: timestampStr || '00:00',
          original: result.text,
          translated: result.translatedVi || result.text,
          speaker: speakerLabel || 'Speaker',
        }

        setTranscriptLines((prev) => {
          if (
            prev.length > 0 &&
            prev[prev.length - 1].original.trim().toLowerCase() === result.text.trim().toLowerCase()
          ) {
            return prev
          }
          return [...prev, newLine]
        })
      }
    })

    return () => {
      unsubMetrics()
      unsubCommit()
    }
  }, [])

  // ── 3. Real-time Audio Chunk Producer Loop (Audio → VAD → STTJobQueue) ──────
  useEffect(() => {
    if (!isCapturing || !isListening) {
      sttJobQueue.pause()
      return
    }

    sttJobQueue.resume()

    const intervalTimer = setInterval(() => {
      // Slice phrase segment from high-performance PCM ring buffer (1.2s minimum)
      const segment = getAudioSegmentSince(lastProcessedSampleRef.current, 1.2)
      if (!segment) return

      // Advance sample pointer
      lastProcessedSampleRef.current = segment.endSample

      const seqId = sequenceIdRef.current++
      const now = new Date()
      const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

      const speakerLabel =
        mode === 'interview'
          ? sourceType === 'system'
            ? 'Interviewer'
            : 'You'
          : sourceType === 'system'
          ? 'Cuộc họp'
          : 'You'

      const dynamicPrompt =
        whisperPromptBuilder.buildPrompt(activeKeywords || [], {
          contextType: mode,
          previousTranscript: lastTranscriptTextRef.current,
        }) || whisperPrompt || undefined

      const job: STTJob = {
        jobId: `stt_${sessionIdRef.current}_${seqId}_${Date.now()}`,
        sessionId: sessionIdRef.current,
        sequenceId: seqId,
        audioBuffer: segment.blob,
        hasSpeech: segment.hasAudio, // VAD flag: silence chunks dropped early by queue to save STT compute
        createdAt: Date.now(),
        priority: segment.hasAudio ? 1 : 0,
        engineId: getSavedSTTEngineId(),
        language: sttLang,
        sourceType,
        speakerLabel,
        timestampStr: timeStr,
        prompt: dynamicPrompt,
      }

      sttJobQueue.enqueue(job)
    }, 1000)

    return () => {
      clearInterval(intervalTimer)
      sttJobQueue.pause()
    }
  }, [isCapturing, isListening, getAudioSegmentSince, mode, sourceType, sttLang, whisperPrompt, activeKeywords])

  // ── Meeting Lifecycle & Component Unmount Cleanup (Streams, Workers, Timers, Buffers) ──
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopCapture()
      clearBuffer()
      sttJobQueue.pause()
      sttJobQueue.clear()

      // Clean up all pending timers
      if (copilotDebounceTimerRef.current) clearTimeout(copilotDebounceTimerRef.current)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (exchangeScanTimerRef.current) clearTimeout(exchangeScanTimerRef.current)
      if (switchSourceTimerRef.current) clearTimeout(switchSourceTimerRef.current)
      if (retakeTimerRef.current) clearTimeout(retakeTimerRef.current)
      if (copyAnswerTimerRef.current) clearTimeout(copyAnswerTimerRef.current)
      if (copyOptionTimerRef.current) clearTimeout(copyOptionTimerRef.current)
      if (copySummaryTimerRef.current) clearTimeout(copySummaryTimerRef.current)
      if (saveHistoryTimerRef.current) clearTimeout(saveHistoryTimerRef.current)

      // Clean up all active and historical screenshot buffers from refs (no stale closures)
      if (capturedImageInfoRef.current?.dataUrl) {
        screenCaptureService.releaseMemory(capturedImageInfoRef.current.dataUrl)
      }
      if (activeVisualQuestionRef.current?.thumbnailUrl) {
        screenCaptureService.releaseMemory(activeVisualQuestionRef.current.thumbnailUrl)
      }
      for (const vq of visualQuestionsHistoryRef.current) {
        if (vq.thumbnailUrl) {
          screenCaptureService.releaseMemory(vq.thumbnailUrl)
        }
      }
    }
  }, [stopCapture, clearBuffer])

  // Summarize meeting transcripts using AI
  const handleGenerateSummary = async (
    linesToSummarize: TranscriptLine[]
  ): Promise<string | null> => {
    if (!linesToSummarize || linesToSummarize.length === 0) {
      setSummaryError('Chưa có transcript để tóm tắt.')
      return null
    }
    setIsSummarizing(true)
    setSummaryError(null)
    try {
      const summary = await summarizeMeetingTranscripts(linesToSummarize, mode, responseLang)
      if (!summary) {
        setMeetingSummary(null)
        setSummaryError(
          'Không nhận được tóm tắt từ LLM. Kiểm tra API Key trong tab Cài đặt rồi bấm "Tóm tắt lại".'
        )
        return null
      }
      setMeetingSummary(summary)
      return summary
    } catch (err) {
      console.warn('[MeetingMode] summarize error:', err)
      setMeetingSummary(null)
      setSummaryError((err as Error)?.message || 'Lỗi khi gọi LLM tóm tắt.')
      return null
    } finally {
      setIsSummarizing(false)
    }
  }

  /**
   * Generate intelligent response when user stops listening.
   *
   * `summaryOverride` lets the caller hand over the freshly generated summary —
   * React state is not updated yet at that point, and the suggestions must be
   * grounded on the real conversation instead of a stale/empty summary.
   */
  const handleGenerateCopilotResponse = useCallback(
    async (
      lines: TranscriptLine[],
      summaryOverride?: string | null,
      scannedOverride?: ScannedExchangeResult | null
    ) => {
    if (!lines || lines.length === 0) {
      setAiError('Chưa có nội dung transcript. Hãy thu âm cuộc họp rồi bấm Dừng để AI phân tích.')
      return
    }

    // Lấy nội dung trao đổi gần nhất bằng NGÔN NGỮ GỐC (đã qua AI quét ghép nối hoặc heuristic)
    const currentExchange =
      scannedOverride ||
      latestExchangeRef.current ||
      extractHeuristicLatestExchange(lines, mode)

    const exchangeOriginalText = (
      currentExchange?.original ||
      lines[lines.length - 1].original ||
      ''
    ).trim()

    const isQ =
      isQuestionUtterance(exchangeOriginalText) || (currentExchange?.isQuestion ?? false)
    setIsLatestAQuestion(isQ)

    setIsGeneratingAIResponse(true)
    setAiError(null)
    try {
      if (mode === 'interview') {
        const questionText = exchangeOriginalText
        const activeCvBg = cvAnalysis || getCachedCvAnalysis(activeCV, activeJD) || ''
        const answerId = Date.now()

        performance.mark('question_final')
        streamingAnswer.cancelStream()

        await streamingAnswer.startStream(
          {
            question: questionText,
            cvSummary: activeCV,
            backgroundAnalysis: activeCvBg,
            transcriptLines: lines,
            language: responseLang,
            sessionId: sessionIdRef.current,
            intent: latestIntent,
            strategyOverride: answerStrategyOverride,
          },
          {
            onInit: (init) => {
              if (!isMountedRef.current) return
              setContextUsage(init.contextUsage)
              setCustomInterviewAnswer({
                id: answerId,
                type: 'answer',
                label: init.label,
                content: '',
                shortContent: '',
                confidence: 97,
                contextUsage: init.contextUsage,
                strategy: init.strategy,
                retrieval: init.retrieval,
                isStreaming: true,
                streamingState: 'connecting',
              })
            },
            onFirstToken: (ttftMs) => {
              performance.mark('first_delta')
              try {
                performance.measure('question_to_first_delta', 'question_final', 'first_delta')
                const measure = performance.getEntriesByName('question_to_first_delta').pop()
                console.log(
                  `[InterviewStreaming] TTFT: ${Math.round(measure?.duration ?? ttftMs)}ms (p50 target <= 1000ms)`
                )
              } catch {}
            },
            onDelta: (_delta, currentFullText) => {
              if (!isMountedRef.current) return
              setCustomInterviewAnswer((prev) =>
                prev && prev.id === answerId
                  ? {
                      ...prev,
                      content: currentFullText,
                      isStreaming: true,
                      streamingState: 'streaming',
                    }
                  : prev
              )
            },
            onDone: (res) => {
              if (!isMountedRef.current) return
              performance.mark('stream_done')
              setIsGeneratingAIResponse(false)

              setCustomInterviewAnswer((prev) =>
                prev && prev.id === answerId
                  ? {
                      ...prev,
                      content: res.content,
                      shortContent: res.shortContent,
                      modelName: res.modelName,
                      routing: res.routing,
                      failover: res.failover,
                      isStreaming: false,
                      streamingState: 'done',
                    }
                  : prev
              )

              // Grounding validation runs ASYNCHRONOUSLY after done, never replacing active reading text
              void (async () => {
                try {
                  const groundingInput = {
                    answer: res.content,
                    cv: activeCV,
                    profile: activeCV,
                    transcript: lines.map((l) => `${l.speaker}: ${l.original}`).join('\n'),
                    session: [
                      activeCvBg,
                      res.retrieval?.citations?.map((c: any) => c.text).join('\n'),
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                    mode: 'balanced' as const,
                  }

                  // 1. Immediate Tier 1 sync grounding for fast badge rendering
                  const syncGrounding = validateAnswerGrounding(groundingInput)
                  if (isMountedRef.current) {
                    setCustomInterviewAnswer((prev) =>
                      prev && prev.id === answerId ? { ...prev, grounding: syncGrounding } : prev
                    )
                  }

                  // 2. Tier 2 LLM Judge async evaluation in background
                  const asyncGrounding = await validateAnswerGroundingAsync(groundingInput)
                  if (isMountedRef.current) {
                    setCustomInterviewAnswer((prev) =>
                      prev && prev.id === answerId ? { ...prev, grounding: asyncGrounding } : prev
                    )
                  }
                } catch (gErr) {
                  console.warn('[MeetingMode] Async grounding error:', gErr)
                }
              })()

              // Save recovery & history only when stream completes
              void window.api?.sessions?.recovery?.append({
                eventId: `suggestion:${sessionIdRef.current}:${answerId}`,
                sessionId: sessionIdRef.current,
                type: 'suggestion',
                timestamp: Date.now(),
                payload: {
                  id: answerId,
                  type: 'answer',
                  label: res.label,
                  content: res.content,
                  confidence: res.confidence,
                  retrieval: res.retrieval,
                  routing: res.routing,
                  failover: res.failover,
                },
              })

              const lastLine = lines[lines.length - 1]
              aiSuggestionsHistoryRef.current.push({
                id: answerId,
                type: 'answer',
                label: res.label,
                content: res.content,
                confidence: res.confidence,
                retrieval: res.retrieval,
                routing: res.routing,
                failover: res.failover,
                timestamp: lastLine?.timestamp || '00:00',
                timestampMs: Date.now(),
                triggeredByTranscriptId: lastLine?.id,
                tokenUsage: res.contextUsage
                  ? {
                      promptTokens: res.contextUsage.totalTokens,
                      totalTokens: res.contextUsage.totalTokens,
                      costStatus: 'unknown',
                    }
                  : undefined,
              })
            },
            onError: (err, partialText) => {
              if (!isMountedRef.current) return
              setIsGeneratingAIResponse(false)
              if (partialText && partialText.trim()) {
                setCustomInterviewAnswer((prev) =>
                  prev && prev.id === answerId
                    ? {
                        ...prev,
                        content: partialText,
                        isStreaming: false,
                        streamingState: 'interrupted',
                      }
                    : prev
                )
                const lastLine = lines[lines.length - 1]
                aiSuggestionsHistoryRef.current.push({
                  id: answerId,
                  type: 'answer',
                  label: '⚠️ Đã dừng giữa chừng',
                  content: partialText,
                  confidence: 80,
                  timestamp: lastLine?.timestamp || '00:00',
                  timestampMs: Date.now(),
                  triggeredByTranscriptId: lastLine?.id,
                })
              } else {
                setCustomInterviewAnswer(null)
                setAiError(
                  err?.message ||
                    'Không gọi được LLM. Hãy kiểm tra API Key (Groq / Gemini / OpenAI) trong tab Cài đặt rồi thử lại.'
                )
              }
            },
          }
        )
      } else {
        // Ưu tiên tóm tắt vừa sinh (state React chưa kịp cập nhật ở thời điểm này).
        const summaryText = summaryOverride ?? meetingSummary ?? ''
        const activeDiscussionBg =
          discussionAnalysis || getCachedDiscussionAnalysis(contextData.discussionTopic || '') || ''

        const options = await generateDiscussionOptions({
          latestLine: exchangeOriginalText,
          isQuestion: isQ,
          meetingSummary: summaryText,
          discussionContext: contextData.discussionTopic,
          backgroundAnalysis: activeDiscussionBg,
          transcriptLines: lines,
          language: responseLang,
          sessionId: sessionIdRef.current,
        })

        if (!options || options.length === 0) {
          setCustomDiscussionSuggestions(null)
          setAiError(
            'Không gọi được LLM. Hãy kiểm tra API Key (Groq / Gemini / OpenAI) trong tab Cài đặt rồi thử lại.'
          )
          return
        }

        if (options[0]?.contextUsage) {
          setContextUsage(options[0].contextUsage)
        }

        setCustomDiscussionSuggestions(options)

        // Accumulate in session history
        const lastLine = lines[lines.length - 1]
        const nowMs = Date.now()
        for (const opt of options) {
          aiSuggestionsHistoryRef.current.push({
            id: opt.id || nowMs + Math.random(),
            type: opt.type || 'option',
            label: opt.label,
            content: opt.content,
            confidence: opt.confidence,
            timestamp: lastLine?.timestamp || '00:00',
            timestampMs: nowMs,
            triggeredByTranscriptId: lastLine?.id,
            tokenUsage: opt.contextUsage
              ? {
                  promptTokens: opt.contextUsage.totalTokens,
                  totalTokens: opt.contextUsage.totalTokens,
                    costStatus: 'unknown',
                }
              : undefined,
          })
        }
      }
    } catch (err) {
      console.warn('[MeetingMode] Copilot response error:', err)
      setAiError((err as Error)?.message || 'Lỗi không xác định khi gọi LLM.')
    } finally {
      setIsGeneratingAIResponse(false)
    }
  }, [
    mode,
    cvAnalysis,
    activeCV,
    activeJD,
    responseLang,
    latestIntent,
    answerStrategyOverride,
    meetingSummary,
    discussionAnalysis,
    contextData.discussionTopic,
  ])

  // ── Intelligent QuestionDetector, Multi-chunk Stitching & Debounced Copilot Trigger ──
  useEffect(() => {
    const syncTimer = setTimeout(async () => {
      if (!isMountedRef.current) return

      if (validLines.length === 0) {
        setLatestExchange(null)
        setLatestIntent(null)
        setSemiAutoPendingQuestion(null)
        return
      }

      // 0. Update TieredContextManager with latest session and transcript lines
      tieredContextManager.setSessionId(sessionIdRef.current)
      tieredContextManager.setTranscriptLines(validLines)

      // Trigger incremental summary in background if threshold (20-30 lines) exceeded
      if (tieredContextManager.shouldTriggerIncrementalSummary()) {
        void tieredContextManager.runIncrementalSummary()
      }

      // 1. Detect Intent with 0ms latency heuristic + multi-chunk Whisper stitching
      const heuristicIntent = detectIntentFromRecentLines(validLines, {
        mode,
        triggerMode,
        dedupeKey: `${mode}:${validLines[validLines.length - 1]?.speaker || 'Speaker'}`,
      })
      const intentRes = heuristicIntent ? await classifyIntent(heuristicIntent) : null
      setLatestIntent(intentRes)
      if (intentRes?.isQuestion) {
        void window.api.sessions?.recovery?.append({
          eventId: `question:${sessionIdRef.current}:${intentRes.detectionTimestamp || intentRes.normalizedText}`,
          sessionId: sessionIdRef.current,
          type: 'question:detected',
          timestamp: Date.now(),
          payload: {
            id: intentRes.detectionTimestamp || intentRes.normalizedText,
            text: intentRes.questionText || intentRes.normalizedText,
            intent: intentRes.normalizedIntent,
          },
        })
      }

      // 2. Synchronize latest exchange UI with coherent normalized text
      let targetExchange: ScannedExchangeResult | null = null
      if (intentRes && intentRes.normalizedText) {
        targetExchange = {
          original: intentRes.normalizedText,
          speaker: intentRes.speaker,
          timestamp: intentRes.timestamp || validLines[validLines.length - 1]?.timestamp || '',
          isQuestion: intentRes.isQuestion,
          isAiScanned: false,
          sourceLineCount: validLines.length,
        }
        setLatestExchange(targetExchange)
        setIsLatestAQuestion(intentRes.isQuestion)
      }

      // Update live context usage estimate
      const exchangeText = targetExchange?.original || validLines[validLines.length - 1]?.original || ''
      setContextUsage(tieredContextManager.getUsageEstimate(exchangeText, mode))

      // 3. Copilot Trigger Decision:
      if (!isListening || !isCapturing) return

      if (triggerMode === 'manual') {
        setSemiAutoPendingQuestion(null)
        return
      }

      if (triggerMode === 'semi-auto') {
        if (intentRes?.isQuestion && intentRes.confidence >= 0.7) {
          setSemiAutoPendingQuestion(intentRes.normalizedText)
        } else {
          setSemiAutoPendingQuestion(null)
        }
        return
      }

      // Auto Mode: Only trigger if shouldTriggerCopilot is true (Question/Command/Discussion in discussion mode)
      // Small talk ("Okay", "I see", "Right", "Thank you") sets shouldTriggerCopilot = false -> LLM call skipped!
      if (intentRes?.shouldTriggerCopilot && targetExchange) {
        // Keep the original debounce behavior, extending it for incomplete STT fragments.
        if (copilotDebounceTimerRef.current) clearTimeout(copilotDebounceTimerRef.current)
        const debounceMs = getAdaptiveDebounceMs(targetExchange.original)
        copilotDebounceTimerRef.current = setTimeout(async () => {
          if (!isMountedRef.current) return
          // Câu hỏi mới: hủy stream cũ nếu đang chạy và bắt đầu stream mới ngay
          if (isGeneratingAIResponseRef.current) {
            streamingAnswer.cancelStream()
          }
          await handleGenerateCopilotResponse(validLinesRef.current, null, targetExchange)
        }, debounceMs)
      }
    }, 0)

    return () => {
      clearTimeout(syncTimer)
      if (copilotDebounceTimerRef.current) {
        clearTimeout(copilotDebounceTimerRef.current)
      }
    }
  }, [validLines, mode, triggerMode, isListening, isCapturing, handleGenerateCopilotResponse, streamingAnswer])

  const handleCopySummary = () => {
    if (!meetingSummary) return
    navigator.clipboard.writeText(meetingSummary)
    setCopiedSummary(true)
    if (copySummaryTimerRef.current) clearTimeout(copySummaryTimerRef.current)
    copySummaryTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setCopiedSummary(false)
    }, 2000)
  }

  const handleToggleListening = async () => {
    if (isTogglingAudioRef.current) return
    isTogglingAudioRef.current = true
    try {
      if (isCapturing) {
        stopCapture()
        setIsListening(false)
        if (validLines.length > 0) {
          // Bấm Dừng → AI quét transcript ngắt quãng để lấy trao đổi gần nhất bằng ngôn ngữ gốc,
          // đồng thời tóm tắt nội dung rồi dùng chính ngữ cảnh đó để đề xuất phản hồi.
          setIsGeneratingAIResponse(true)
          setIsScanningExchange(true)
          try {
            const scanned = await scanLatestExchangeWithAI(validLines, mode)
            if (scanned && isMountedRef.current) {
              setLatestExchange(scanned)
              setIsLatestAQuestion(scanned.isQuestion)
            }
            if (isMountedRef.current) {
              setIsScanningExchange(false)
              markExchangeScanned()
            }

            const summary = await handleGenerateSummary(validLines)
            if (isMountedRef.current) {
              await handleGenerateCopilotResponse(validLines, summary, scanned)
            }
          } finally {
            if (isMountedRef.current) {
              setIsScanningExchange(false)
              setIsGeneratingAIResponse(false)
            }
          }
        } else {
          setAiError('Chưa nhận diện được câu nào trong phiên thu âm này, nên không có gì để AI phân tích.')
          setSummaryError('Chưa nhận diện được câu nào trong phiên thu âm này.')
        }
      } else {
        // Pre-flight health check if using Local Whisper
        if (currentSTTEngine?.provider === 'Local' && window.api?.nativeWhisper?.healthCheck) {
          try {
            const health = await window.api.nativeWhisper.healthCheck(currentSTTEngine.id)
            if (!health.healthy) {
              console.warn('[MeetingMode] Pre-flight STT health check warning:', health.error)
            }
          } catch (err) {
            console.warn('[MeetingMode] Health check error:', err)
          }
        }

        setIsListening(true)
        try {
          await startCapture()
        } catch (err) {
          console.warn('[MeetingMode] Could not start capture:', err)
          if (isMountedRef.current) {
            setIsListening(false)
          }
        }
      }
    } finally {
      isTogglingAudioRef.current = false
    }
  }

  const handleSwitchSource = async (newType: 'system' | 'mic') => {
    if (sourceType === newType) return
    if (switchSourceTimerRef.current) {
      clearTimeout(switchSourceTimerRef.current)
      switchSourceTimerRef.current = null
    }
    setSourceType(newType)
    if (isCapturing) {
      stopCapture()
      switchSourceTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          startCapture().catch((err) => console.warn('[MeetingMode] restart capture error:', err))
        }
      }, 150)
    }
  }

  const handleClearTranscript = () => {
    setTranscriptLines([])
    clearBuffer()
    lastProcessedSampleRef.current = 0
    sequenceIdRef.current = 1
    sessionIdRef.current = `session_${Date.now()}`
    sttJobQueue.reset(sessionIdRef.current)
    tieredContextManager.setSessionId(sessionIdRef.current)
    tieredContextManager.clearSessionMemory()
    setContextUsage(null)
    setLatestExchange(null)
    setIsScanningExchange(false)
    if (exchangeScanTimerRef.current) {
      clearTimeout(exchangeScanTimerRef.current)
    }
    // Reset bộ giãn nhịp quét để phiên mới được quét ngay.
    lastExchangeSignatureRef.current = ''
    lastExchangeScanAtRef.current = 0
    setMeetingSummary(null)
    setSummaryError(null)
    setCustomInterviewAnswer(null)
    setCustomDiscussionSuggestions(null)
    aiSuggestionsHistoryRef.current = []
    setAiError(null)
    setIsLatestAQuestion(false)
    setLatestIntent(null)
    setSemiAutoPendingQuestion(null)
    tieredContextManager.clearVisualQuestions()
    if (activeVisualQuestion?.thumbnailUrl) {
      screenCaptureService.releaseMemory(activeVisualQuestion.thumbnailUrl)
    }
    for (const vq of visualQuestionsHistory) {
      if (vq.thumbnailUrl) {
        screenCaptureService.releaseMemory(vq.thumbnailUrl)
      }
    }
    setVisualQuestionsHistory([])
    setActiveVisualQuestion(null)
    setScreenCaptureState('idle')
    if (copilotDebounceTimerRef.current) {
      clearTimeout(copilotDebounceTimerRef.current)
    }
  }

  // ── Chỉ dùng nội dung thật do LLM sinh ra (không còn mock/fallback cứng) ──
  const activeAnswerContent = customInterviewAnswer
    ? isShortened
      ? customInterviewAnswer.shortContent
      : customInterviewAnswer.content
    : ''

  const suggestions: AISuggestion[] =
    mode === 'discussion'
      ? customDiscussionSuggestions ?? []
      : customInterviewAnswer
      ? [
          {
            id: customInterviewAnswer.id,
            type: 'answer',
            label: customInterviewAnswer.label,
            content: activeAnswerContent,
            confidence: customInterviewAnswer.confidence,
          },
        ]
      : []

  const handleCopyAnswer = () => {
    if (mode === 'interview') {
      if (!activeAnswerContent) return
      navigator.clipboard.writeText(activeAnswerContent)
    } else {
      if (suggestions.length === 0) return
      const text = suggestions
        .map((s, i) => `${i + 1}. [${s.label || 'Phương án'}]\n${s.content}`)
        .join('\n\n')
      navigator.clipboard.writeText(text)
    }
    setCopiedAnswer(true)
    if (copyAnswerTimerRef.current) clearTimeout(copyAnswerTimerRef.current)
    copyAnswerTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setCopiedAnswer(false)
    }, 2000)
  }

  const handleCopyOption = (text: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedOptionId(id)
    if (copyOptionTimerRef.current) clearTimeout(copyOptionTimerRef.current)
    copyOptionTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setCopiedOptionId(null)
    }, 2000)
  }

  const handleToggleShorten = () => {
    setIsShortened((prev) => !prev)
  }

  /** Đổi ngôn ngữ phản hồi của AI (đồng bộ với trang Cài đặt). */
  const handleResponseLangChange = (lang: ResponseLanguage) => {
    setResponseLang(lang)
    saveResponseLanguage(lang)
    // Nội dung đã sinh theo ngôn ngữ cũ -> xoá để tránh trộn hai ngôn ngữ.
    setCustomInterviewAnswer(null)
    setCustomDiscussionSuggestions(null)
    setAiError(null)
  }

  /** Gọi lại LLM để sinh nội dung mới từ transcript hiện có. */
  const handleRegenerate = async () => {
    if (validLines.length === 0) {
      setAiError('Chưa có nội dung transcript. Hãy thu âm cuộc họp rồi bấm Dừng để AI phân tích.')
      return
    }
    setIsRegenerating(true)
    setIsShortened(false)
    try {
      setIsScanningExchange(true)
      const scanned = await scanLatestExchangeWithAI(validLines, mode)
      if (scanned) {
        setLatestExchange(scanned)
        setIsLatestAQuestion(scanned.isQuestion)
      }
      setIsScanningExchange(false)
      markExchangeScanned()
      await handleGenerateCopilotResponse(validLines, null, scanned)
    } finally {
      setIsScanningExchange(false)
      setIsRegenerating(false)
    }
  }

  // ── SCREEN CAPTURE & MULTIMODAL QUESTION LOGIC ─────────────────────────────
  const handleStartScreenCapture = useCallback(async (
    source: { sourceType: 'screen' | 'window'; sourceId?: string },
  ) => {
    if (
      isCapturingScreenRef.current ||
      screenCaptureState === 'capturing' ||
      screenCaptureState === 'processing' ||
      screenCaptureState === 'cropping'
    ) {
      return
    }
    setIsScreenSourcePickerOpen(false)
    lastScreenSourceRef.current = source
    isCapturingScreenRef.current = true
    setScreenCaptureState('capturing')

    // Safety watchdog: ensure button never spins indefinitely even on unexpected stalls
    const watchdogTimer = setTimeout(() => {
      if (isCapturingScreenRef.current) {
        console.warn('[MeetingMode] ⏰ Watchdog timer hết hạn sau 9000ms.')
        isCapturingScreenRef.current = false
        if (isMountedRef.current) {
          setScreenCaptureState('idle')
          setAiError('Quá trình chụp màn hình phản hồi chậm hoặc bị treo. Hãy thử bấm lại.')
        }
      }
    }, 9000)

    try {
      if (capturedImageInfoRef.current?.dataUrl) {
        screenCaptureService.releaseMemory(capturedImageInfoRef.current.dataUrl)
        setCapturedImageInfo(null)
      }
      const imgInfo = await screenCaptureService.captureScreen(source)
      clearTimeout(watchdogTimer)
      if (isMountedRef.current) {
        setCapturedImageInfo(imgInfo)
        setScreenCaptureState('cropping')
      } else {
        screenCaptureService.releaseMemory(imgInfo.dataUrl)
        setScreenCaptureState('idle')
      }
    } catch (err: unknown) {
      clearTimeout(watchdogTimer)
      console.warn('[MeetingMode] ❌ Chụp màn hình thất bại / bị hủy:', err)
      if (isMountedRef.current) {
        setScreenCaptureState('idle')
        const msg = (err as Error)?.message || ''
        if (msg && !msg.includes('cancelled') && !msg.includes('dismissed')) {
          setAiError(`Không thể chụp màn hình: ${msg}`)
        }
      }
    } finally {
      clearTimeout(watchdogTimer)
      isCapturingScreenRef.current = false
    }
  }, [screenCaptureState])

  const handleTriggerScreenCapture = useCallback(() => {
    if (
      isCapturingScreenRef.current ||
      screenCaptureState === 'capturing' ||
      screenCaptureState === 'processing' ||
      screenCaptureState === 'cropping'
    ) {
      return
    }
    setIsScreenSourcePickerOpen(true)
  }, [screenCaptureState])

  const handleConfirmCrop = async (cropRect: CropRect) => {
    if (!capturedImageInfo) return
    setScreenCaptureState('processing')
    try {
      // 1. Crop and compress downscaled to max 1400px JPEG quality 0.85
      const cropped = await screenCaptureService.cropAndCompress(
        capturedImageInfo.dataUrl,
        cropRect,
        { maxWidth: 1400, quality: 0.85 }
      )

      // 2. Dereference the heavy full-screen raw capture buffer
      screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
      setCapturedImageInfo(null)

      // 3. Fast non-blocking OCR in background
      const ocrPromise = ocrService.extractText(cropped.dataUrl).catch(() => '')

      // 4. Send directly to Multimodal Provider (Gemini / OpenAI / Groq)
      const analysis = await visualQuestionAnalyzer.analyzeVisualQuestion({
        imageBase64: cropped.dataUrl,
        mimeType: cropped.mimeType,
        thumbnailUrl: cropped.dataUrl,
        sessionId: sessionIdRef.current,
        userContext:
          mode === 'interview'
            ? activeJD || activeCV || undefined
            : contextData.discussionTopic || undefined,
        responseLanguage: responseLang,
        languageContext: mode === 'interview' ? `${activeJD}\n${activeCV}` : undefined,
      })

      const ocrText = await ocrPromise

      // 5. Construct VisualQuestionItem
      const visualItem: VisualQuestionItem = {
        ...analysis,
        source: 'screenshot',
        thumbnailUrl: cropped.dataUrl,
        ocrText: ocrText || analysis.extractedCode || undefined,
      }

      tieredContextManager.addVisualQuestion(visualItem)
      setActiveVisualQuestion(visualItem)
      setVisualQuestionsHistory((prev) => [...prev, visualItem])
      void window.api.sessions?.recovery?.append({
        eventId: `visual:${sessionIdRef.current}:${visualItem.id}`,
        sessionId: sessionIdRef.current,
        type: 'visual:question',
        timestamp: Date.now(),
        payload: visualItem as unknown as Record<string, unknown>,
      })
      setScreenCaptureState('completed')
    } catch (err: unknown) {
      console.error('[MeetingMode] Multimodal question analysis error:', err)
      setScreenCaptureState('error')
      setAiError((err as Error)?.message || 'Lỗi khi phân tích câu hỏi hình ảnh từ màn hình.')
    }
  }

  const handleCancelCrop = () => {
    if (capturedImageInfo) {
      screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
      setCapturedImageInfo(null)
    }
    setScreenCaptureState('idle')
  }

  const handleRetakeCrop = async () => {
    if (capturedImageInfo) {
      screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
      setCapturedImageInfo(null)
    }
    setScreenCaptureState('idle')
    if (retakeTimerRef.current) {
      clearTimeout(retakeTimerRef.current)
      retakeTimerRef.current = null
    }
    retakeTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        handleStartScreenCapture(lastScreenSourceRef.current)
      }
    }, 150)
  }

  const handleDismissVisualQuestion = () => {
    if (activeVisualQuestion?.thumbnailUrl) {
      screenCaptureService.releaseMemory(activeVisualQuestion.thumbnailUrl)
    }
    setActiveVisualQuestion(null)
    setScreenCaptureState('idle')
  }

  // Configurable Global Shortcut (Ctrl/Cmd + Shift + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey
      if (isCmdOrCtrl && e.shiftKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault()
        e.stopPropagation()
        handleTriggerScreenCapture()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleTriggerScreenCapture])

  const defaultSessionTitle = useMemo(() => {
    return mode === 'interview'
      ? (hasInterviewContext
          ? `Phỏng vấn Kỹ thuật (${profileSnapshot.name || 'CV'})`
          : 'Cuộc họp Live Copilot')
      : (hasDiscussionContext && contextData.discussionTopic
          ? `Thảo luận: ${contextData.discussionTopic.slice(0, 40)}`
          : 'Cuộc họp Thảo luận Live')
  }, [mode, hasInterviewContext, hasDiscussionContext, profileSnapshot.name, contextData.discussionTopic])

  const [customSessionTitle, setCustomSessionTitle] = useState<string>('')
  const currentSessionTitle = customSessionTitle || defaultSessionTitle

  useEffect(() => {
    let cancelled = false
    void window.api.sessions?.recovery?.list().then((records) => {
      if (!cancelled && records.length > 0) setUnfinishedRecovery(records[0])
    }).catch((error) => console.warn('[MeetingMode] Recovery scan failed:', error))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const latest = validLines[validLines.length - 1]
    if (!latest || !window.api.sessions?.recovery) return
    void window.api.sessions.recovery.append({
      eventId: `transcript:${sessionIdRef.current}:${latest.id}`,
      sessionId: sessionIdRef.current,
      type: 'transcript:segment',
      timestamp: Date.now(),
      payload: latest,
    }).catch((error) => console.warn('[MeetingMode] Recovery journal append failed:', error))
  }, [validLines])

  useEffect(() => {
    if (!window.api.sessions?.recovery) return
    const timer = window.setInterval(() => {
      void window.api.sessions?.recovery?.checkpoint(sessionIdRef.current, {
        id: sessionIdRef.current,
        title: currentSessionTitle,
        mode,
        transcripts: validLines,
        screenshotQuestions: visualQuestionsHistory,
        usageRecords: [usageTrackerService.getSessionUsageSummary(sessionIdRef.current)],
        lifecycle: 'active',
      }).catch((error) => console.warn('[MeetingMode] Recovery checkpoint failed:', error))
    }, 5000)
    return () => window.clearInterval(timer)
  }, [currentSessionTitle, mode, validLines, visualQuestionsHistory])

  const handleSaveToHistory = () => {
    const endedAt = Date.now()
    const startedAt = meetingStartTimeRef.current
    const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000))
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60))

    const sessionTranscripts = validLines.map((l) => ({
      id: l.id,
      speaker: l.speaker,
      timestamp: l.timestamp,
      original: l.original,
      translated: l.translated,
      isQuestion: isQuestionUtterance(l.original),
    }))

    // Ensure transcripts remain strictly sorted chronologically
    sessionTranscripts.sort((a, b) => {
      const parseSec = (ts: string) => {
        if (!ts) return 0
        const parts = ts.split(':').map((p) => parseFloat(p) || 0)
        return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0
      }
      return parseSec(a.timestamp) - parseSec(b.timestamp)
    })

    const sessionSuggestions: HistorySuggestion[] =
      aiSuggestionsHistoryRef.current.length > 0
        ? [...aiSuggestionsHistoryRef.current]
        : suggestions.map((s) => {
            const usage = s.contextUsage || contextUsage
            return {
              id: s.id,
              type: s.type,
              label: s.label,
              content: s.content,
              confidence: s.confidence,
              timestamp: validLines[validLines.length - 1]?.timestamp || '00:00',
              tokenUsage: usage
                ? {
                    promptTokens: usage.totalTokens,
                    totalTokens: usage.totalTokens,
                    costStatus: 'unknown',
                  }
                : undefined,
            }
          })

    const sessionScreenshots = visualQuestionsHistory.map((vq) => ({
      id: vq.id,
      timestamp: vq.timestamp,
      imageMetadata: {
        fileName: 'screenshot.png',
      },
      ocrText: vq.ocrText,
      contentType: vq.contentType,
      analysisResult: {
        questionSummary: vq.problemSummary,
        questionType: vq.contentType,
        suggestedAnswer: vq.recommendedAnswer,
        keyPoints: vq.keyInsights,
        codeSnippet: vq.extractedCode,
      },
    }))

    const questionCount =
      sessionTranscripts.filter((t) => t.isQuestion).length + sessionScreenshots.length

    const sessionUsage = usageTrackerService.getSessionUsageSummary(sessionIdRef.current)
    const trackedTokens = sessionUsage.totalInputTokens + sessionUsage.totalOutputTokens

    const session: MeetingSession = {
      id: sessionIdRef.current || `session-live-${Date.now()}`,
      title: currentSessionTitle,
      profileId: mode === 'interview' ? profileSnapshot.presetId : undefined,
      profileSnapshot: mode === 'interview' ? profileSnapshot : undefined,
      companyName: mode === 'interview' ? profileSnapshot.companyName : undefined,
      targetRole: mode === 'interview' ? profileSnapshot.role : (contextData.discussionTopic || 'Thảo luận nhóm'),
      startedAt,
      endedAt,
      durationMinutes,
      durationSeconds,
      date: new Date().toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      mode,
      aiModel: `${currentModel.name} (${currentModel.provider})`,
      audioSource: currentDeviceLabel,
      contextApplied: hasActiveContext,
      candidateName: activeCV
        ? profileSnapshot.name
          ? `${profileSnapshot.role} (${profileSnapshot.name})`
          : 'Ứng viên (Theo hồ sơ CV đã nạp)'
        : undefined,
      transcripts: sessionTranscripts,
      suggestions: sessionSuggestions,
      screenshotQuestions: sessionScreenshots,
      metrics: {
        totalInteractions:
          sessionTranscripts.length + sessionSuggestions.length + sessionScreenshots.length,
        questionCount,
        aiResponseCount: sessionSuggestions.length,
        screenshotCount: sessionScreenshots.length,
        totalTokens: trackedTokens > 0 ? trackedTokens : (contextUsage?.totalTokens || 0),
        inputTokens: sessionUsage.totalInputTokens,
        outputTokens: sessionUsage.totalOutputTokens,
        cachedTokens: sessionUsage.totalCachedTokens,
        audioDurationSeconds: sessionUsage.totalAudioDurationSeconds,
        estimatedCostUsd: sessionUsage.totalEstimatedCostUsd,
        costStatus: sessionUsage.costStatus,
      },
      exportSchemaVersion: '2.0',
    }

    saveSessionToHistory(session)
    void window.api.sessions?.recovery?.complete(session.id, 'completed')
    setIsSavedToHistory(true)
    if (saveHistoryTimerRef.current) clearTimeout(saveHistoryTimerRef.current)
    saveHistoryTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setIsSavedToHistory(false)
    }, 2500)
  }

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
    <div className="flex flex-col h-full bg-transparent select-none">
      {/* Header with Mode, Controls, and Context Strip */}
      <MeetingHeader
        mode={mode}
        sessionTitle={currentSessionTitle}
        onSessionTitleChange={setCustomSessionTitle}
        isSavedToHistory={isSavedToHistory}
        onSaveToHistory={handleSaveToHistory}
        isCapturing={isCapturing}
        isListening={isListening}
        isTranscribing={isTranscribing}
        queueMetrics={queueMetrics}
        onToggleListening={handleToggleListening}
        contextData={contextData}
        hasActiveContext={hasActiveContext}
        hasDiscussionContext={hasDiscussionContext}
        isAnalyzingBackground={isAnalyzingBackground}
        responseLang={responseLang}
        onResponseLangChange={handleResponseLangChange}
      />

      {unfinishedRecovery && isRecoveryOpen && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          <span>Recovered unfinished session</span>
          <div className="flex gap-2">
            <button className="rounded bg-amber-300 px-2 py-1 text-black" onClick={handleRestoreRecovery}>Restore</button>
            <button className="rounded border border-white/20 px-2 py-1" onClick={() => void handleCompleteRecovery('completed')}>Finalize</button>
            <button className="rounded border border-red-300/30 px-2 py-1 text-red-200" onClick={() => void handleCompleteRecovery('discarded')}>Discard</button>
          </div>
        </div>
      )}

      {/* Main Split: Transcript & AI Response */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <LiveTranscriptPane
          sourceType={sourceType}
          onSwitchSource={handleSwitchSource}
          validLines={validLines}
          latestLine={latestLine}
          latestExchange={latestExchange}
          isScanningExchange={isScanningExchange}
          isCapturing={isCapturing}
          isListening={isListening}
          isTranscribing={isTranscribing}
          queueMetrics={queueMetrics}
          onClearTranscript={handleClearTranscript}
          onToggleListening={handleToggleListening}
          scrollRef={scrollRef}
          sttEngineLabel={sttEngineLabel}
          mode={mode}
          meetingSummary={meetingSummary}
          isSummarizing={isSummarizing}
          summaryError={summaryError}
          copiedSummary={copiedSummary}
          onCopySummary={handleCopySummary}
          onGenerateSummary={handleGenerateSummary}
          showTranslate={needsVietnameseTranslation(responseLang)}
          sttLang={sttLang}
          onSttLangChange={handleSttLangChange}
        />

        <CopilotSuggestionPane
          mode={mode}
          isLatestAQuestion={isLatestAQuestion}
          isGeneratingAIResponse={isGeneratingAIResponse}
          currentModel={currentModel}
          customInterviewAnswer={customInterviewAnswer}
          isShortened={isShortened}
          onToggleShorten={handleToggleShorten}
          isRegenerating={isRegenerating}
          onRegenerate={handleRegenerate}
          copiedAnswer={copiedAnswer}
          onCopyAnswer={handleCopyAnswer}
          customDiscussionSuggestions={customDiscussionSuggestions}
          copiedOptionId={copiedOptionId}
          onCopyOption={handleCopyOption}
          aiError={aiError}
          hasTranscript={validLines.length > 0}
          onOpenSettings={onViewChange ? () => onViewChange('settings') : undefined}
          showTranslate={needsVietnameseTranslation(responseLang)}
          triggerMode={triggerMode}
          onTriggerModeChange={handleTriggerModeChange}
          latestIntent={latestIntent}
          semiAutoPendingQuestion={semiAutoPendingQuestion}
          onTriggerSemiAuto={() => handleGenerateCopilotResponse(validLines, null, latestExchange)}
          answerStrategyId={answerStrategyOverride}
          onAnswerStrategyChange={setAnswerStrategyOverride}
          contextUsage={contextUsage}
          visualQuestion={activeVisualQuestion}
          isAnalyzingVisual={screenCaptureState === 'processing'}
          onDismissVisualQuestion={handleDismissVisualQuestion}
          onTriggerScreenCapture={handleTriggerScreenCapture}
          screenCaptureState={screenCaptureState}
          onToggleCorrectedAnswer={handleToggleCorrectedAnswer}
        />
      </div>

      {/* Footer */}
      <MeetingFooter
        modelName={currentModel.name}
        sttEngineLabel={sttEngineLabel}
        isCapturing={isCapturing}
        isListening={isListening}
        transcriptCount={transcriptLines.length}
      />

      {/* Interactive Screenshot Crop Overlay */}
      {isScreenSourcePickerOpen && (
        <ScreenCaptureSourcePicker
          onSelect={handleStartScreenCapture}
          onCancel={() => setIsScreenSourcePickerOpen(false)}
        />
      )}

      {screenCaptureState === 'cropping' && capturedImageInfo && (
        <ScreenshotCropOverlay
          imageInfo={capturedImageInfo}
          onConfirmCrop={handleConfirmCrop}
          onCancel={handleCancelCrop}
          onRetake={handleRetakeCrop}
        />
      )}
    </div>
  )
}
