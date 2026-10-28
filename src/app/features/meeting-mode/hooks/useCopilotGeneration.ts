import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  TranscriptLine,
  AISuggestion,
  InterviewVariation,
  UseCopilotGenerationProps,
  UseCopilotGenerationReturn,
} from '../types'
import {
  type CopilotState,
  transitionCopilotState,
} from '../machines/copilotStateMachine'
import { useStreamingAnswer } from '@/hooks/useStreamingAnswer'
import {
  generateDiscussionOptions,
  type ScannedExchangeResult,
} from '@/services/ai-model/copilotResponseService'
import {
  getSavedResponseLanguage,
  saveResponseLanguage,
  normalizeResponseLanguage,
  type ResponseLanguage,
} from '@/services/ai-model/aiModels'
import type { AnswerStrategyId } from '@/services/ai-model/copilot'
import {
  runGroundingValidation,
  journalInterviewSuggestion,
  journalDiscussionSuggestions,
} from '../controllers/copilotResponseHelpers'
import { useCopilotCopy } from './useCopilotCopy'

export type { UseCopilotGenerationProps, UseCopilotGenerationReturn }

export function useCopilotGeneration({
  mode,
  sessionId,
  activeCV,
  cvAnalysis,
  discussionAnalysis,
  discussionTopic,
  meetingSummary,
  latestIntent,
  aiSuggestionsHistoryRef,
  setContextUsage,
}: UseCopilotGenerationProps): UseCopilotGenerationReturn {
  const isMountedRef = useRef(true)
  const isMounted = useCallback(() => isMountedRef.current, [])
  const [copilotState, setCopilotState] = useState<CopilotState>('idle')

  const [customInterviewAnswer, setCustomInterviewAnswer] = useState<InterviewVariation | null>(null)
  const [customDiscussionSuggestions, setCustomDiscussionSuggestions] = useState<AISuggestion[] | null>(null)
  const [isShortened, setIsShortened] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [responseLang, setResponseLang] = useState<ResponseLanguage>(() =>
    normalizeResponseLanguage(getSavedResponseLanguage())
  )
  const [answerStrategyOverride, setAnswerStrategyOverride] = useState<AnswerStrategyId | undefined>()

  const streamingAnswer = useStreamingAnswer()

  const isGeneratingAIResponse =
    copilotState === 'generating' || copilotState === 'streaming'

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

  const {
    copiedAnswer,
    copiedOptionId,
    handleCopyAnswer,
    handleCopyOption,
  } = useCopilotCopy({
    mode,
    activeAnswerContent,
    suggestions,
    isMounted,
  })

  const cancelStream = useCallback(() => {
    streamingAnswer.cancelStream()
    setCopilotState((prev) => transitionCopilotState(prev, { type: 'INTERRUPT' }))
  }, [streamingAnswer])

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

      const currentExchange = scannedOverride
      const exchangeOriginalText = (
        currentExchange?.original ||
        lines[lines.length - 1].original ||
        ''
      ).trim()

      const isQ = currentExchange?.isQuestion ?? false

      setCopilotState((prev) => transitionCopilotState(prev, { type: 'START_GENERATION' }))
      setAiError(null)

      try {
        if (mode === 'interview') {
          const questionText = exchangeOriginalText
          const activeCvBg = cvAnalysis || ''
          const answerId = Date.now()

          streamingAnswer.cancelStream()

          await streamingAnswer.startStream(
            {
              question: questionText,
              fullTurnText: currentExchange?.fullTurnText,
              cvSummary: activeCV,
              backgroundAnalysis: activeCvBg,
              transcriptLines: lines,
              language: responseLang,
              sessionId,
              intent: latestIntent,
              strategyOverride: answerStrategyOverride,
            },
            {
              onInit: (init) => {
                if (!isMounted()) return
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
              onFirstToken: () => {
                if (!isMounted()) return
                setCopilotState((prev) => transitionCopilotState(prev, { type: 'FIRST_TOKEN' }))
              },
              onDelta: (_delta, currentFullText) => {
                if (!isMounted()) return
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
                if (!isMounted()) return
                setCopilotState((prev) => transitionCopilotState(prev, { type: 'FINISH_STREAM' }))

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

                void runGroundingValidation({
                  answerId,
                  content: res.content,
                  activeCV,
                  activeCvBg,
                  lines,
                  isMounted,
                  updateAnswer: setCustomInterviewAnswer,
                })

                journalInterviewSuggestion({
                  sessionId,
                  answerId,
                  lines,
                  res,
                  aiSuggestionsHistoryRef,
                })
              },
              onError: (err, partialText) => {
                if (!isMounted()) return
                setCopilotState((prev) => transitionCopilotState(prev, { type: 'FAIL' }))

                if (err.message?.includes('Intent Gate')) {
                  setCustomInterviewAnswer(null)
                  setAiError(null)
                  return
                }

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
                } else {
                  setCustomInterviewAnswer(null)
                  setAiError(err?.message || 'Không gọi được LLM.')
                }
              },
            }
          )
        } else {
          // Discussion mode
          const summaryText = summaryOverride ?? meetingSummary ?? ''
          const activeDiscussionBg = discussionAnalysis || ''

          const options = await generateDiscussionOptions({
            latestLine: exchangeOriginalText,
            isQuestion: isQ,
            meetingSummary: summaryText,
            discussionContext: discussionTopic,
            backgroundAnalysis: activeDiscussionBg,
            transcriptLines: lines,
            language: responseLang,
            sessionId,
          })

          if (!isMounted()) return

          if (!options || options.length === 0) {
            setCustomDiscussionSuggestions(null)
            setCopilotState((prev) => transitionCopilotState(prev, { type: 'FAIL' }))
            setAiError('Không gọi được LLM.')
            return
          }

          if (options[0]?.contextUsage) {
            setContextUsage(options[0].contextUsage)
          }

          setCustomDiscussionSuggestions(options)
          setCopilotState((prev) => transitionCopilotState(prev, { type: 'FINISH_STREAM' }))

          journalDiscussionSuggestions({
            lines,
            options,
            aiSuggestionsHistoryRef,
          })
        }
      } catch (err) {
        console.warn('[useCopilotGeneration] Copilot response error:', err)
        if (isMounted()) {
          setCopilotState((prev) => transitionCopilotState(prev, { type: 'FAIL' }))
          setAiError((err as Error)?.message || 'Lỗi không xác định khi gọi LLM.')
        }
      }
    },
    [
      mode,
      sessionId,
      cvAnalysis,
      activeCV,
      responseLang,
      latestIntent,
      answerStrategyOverride,
      streamingAnswer,
      setContextUsage,
      aiSuggestionsHistoryRef,
      meetingSummary,
      discussionAnalysis,
      discussionTopic,
      isMounted,
    ]
  )

  const handleRegenerate = useCallback(
    async (lines: TranscriptLine[], scanned?: ScannedExchangeResult | null) => {
      if (lines.length === 0) return
      setIsRegenerating(true)
      setIsShortened(false)
      try {
        await handleGenerateCopilotResponse(lines, null, scanned)
      } finally {
        if (isMounted()) {
          setIsRegenerating(false)
        }
      }
    },
    [handleGenerateCopilotResponse, isMounted]
  )

  const handleToggleShorten = useCallback(() => {
    setIsShortened((prev) => !prev)
  }, [])

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

  const handleResponseLangChange = useCallback((lang: ResponseLanguage) => {
    setResponseLang(lang)
    saveResponseLanguage(lang)
    setCustomInterviewAnswer(null)
    setCustomDiscussionSuggestions(null)
    setAiError(null)
  }, [])

  const resetCopilot = useCallback(() => {
    cancelStream()
    setCustomInterviewAnswer(null)
    setCustomDiscussionSuggestions(null)
    setAiError(null)
    setCopilotState('idle')
  }, [cancelStream])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    copilotState,
    isGeneratingAIResponse,
    customInterviewAnswer,
    customDiscussionSuggestions,
    isShortened,
    isRegenerating,
    aiError,
    responseLang,
    answerStrategyOverride,
    copiedAnswer,
    copiedOptionId,
    activeAnswerContent,
    suggestions,
    setAiError,
    setAnswerStrategyOverride,
    handleGenerateCopilotResponse,
    handleRegenerate,
    handleToggleShorten,
    handleToggleCorrectedAnswer,
    handleResponseLangChange,
    handleCopyAnswer,
    handleCopyOption,
    cancelStream,
    resetCopilot,
  }
}
