import { useState, useRef, useCallback, useEffect } from 'react'
import type { AppMode } from '@/types/electron.d'
import {
  screenCaptureService,
  visualQuestionAnalyzer,
  ocrService,
  type CapturedImageInfo,
  type VisualQuestionItem,
  type CropRect,
} from '@/services/screen-capture'
import {
  type CaptureState,
  transitionCaptureState,
} from '../machines/captureStateMachine'
import { tieredContextManager } from '@/services/ai-model/context'
import { sessionsPort } from '@/infrastructure/ipc'
import type { ResponseLanguage } from '@/services/ai-model/aiModels'

export interface UseScreenCaptureProps {
  mode: AppMode
  sessionId: string
  activeCV: string
  activeJD: string
  discussionTopic?: string
  responseLang: ResponseLanguage
  setAiError: (err: string | null) => void
}

export interface UseScreenCaptureReturn {
  captureState: CaptureState
  isScreenSourcePickerOpen: boolean
  capturedImageInfo: CapturedImageInfo | null
  activeVisualQuestion: VisualQuestionItem | null
  visualQuestionsHistory: VisualQuestionItem[]
  setIsScreenSourcePickerOpen: (open: boolean) => void
  handleTriggerScreenCapture: () => void
  handleStartScreenCapture: (source: { sourceType: 'screen' | 'window'; sourceId?: string }) => Promise<void>
  handleConfirmCrop: (cropRect: CropRect) => Promise<void>
  handleCancelCrop: () => void
  handleRetakeCrop: () => Promise<void>
  handleDismissVisualQuestion: () => void
  clearVisuals: () => void
}

export function useScreenCapture({
  mode,
  sessionId,
  activeCV,
  activeJD,
  discussionTopic,
  responseLang,
  setAiError,
}: UseScreenCaptureProps): UseScreenCaptureReturn {
  const isMountedRef = useRef(true)
  const isCapturingRef = useRef(false)
  const retakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSourceRef = useRef<{ sourceType: 'screen' | 'window'; sourceId?: string }>({
    sourceType: 'screen',
  })

  const [captureState, setCaptureState] = useState<CaptureState>('idle')
  const [isScreenSourcePickerOpen, setIsScreenSourcePickerOpen] = useState(false)
  const [capturedImageInfo, setCapturedImageInfo] = useState<CapturedImageInfo | null>(null)
  const [activeVisualQuestion, setActiveVisualQuestion] = useState<VisualQuestionItem | null>(null)
  const [visualQuestionsHistory, setVisualQuestionsHistory] = useState<VisualQuestionItem[]>([])

  const capturedImageInfoRef = useRef<CapturedImageInfo | null>(null)
  const activeVisualQuestionRef = useRef<VisualQuestionItem | null>(null)
  const visualQuestionsHistoryRef = useRef<VisualQuestionItem[]>([])

  useEffect(() => {
    capturedImageInfoRef.current = capturedImageInfo
    activeVisualQuestionRef.current = activeVisualQuestion
    visualQuestionsHistoryRef.current = visualQuestionsHistory
  }, [capturedImageInfo, activeVisualQuestion, visualQuestionsHistory])

  const handleTriggerScreenCapture = useCallback(() => {
    if (isCapturingRef.current || captureState === 'capturing' || captureState === 'processing' || captureState === 'cropping') {
      return
    }
    setCaptureState((prev) => transitionCaptureState(prev, { type: 'OPEN_PICKER' }))
    setIsScreenSourcePickerOpen(true)
  }, [captureState])

  const handleStartScreenCapture = useCallback(
    async (source: { sourceType: 'screen' | 'window'; sourceId?: string }) => {
      if (isCapturingRef.current || captureState === 'capturing' || captureState === 'processing') {
        return
      }

      setIsScreenSourcePickerOpen(false)
      lastSourceRef.current = source
      isCapturingRef.current = true
      setCaptureState((prev) => transitionCaptureState(prev, { type: 'START_CAPTURE' }))

      const watchdogTimer = setTimeout(() => {
        if (isCapturingRef.current) {
          console.warn('[useScreenCapture] ⏰ Watchdog timer expired after 9000ms.')
          isCapturingRef.current = false
          if (isMountedRef.current) {
            setCaptureState((prev) => transitionCaptureState(prev, { type: 'FAIL' }))
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
          setCaptureState((prev) => transitionCaptureState(prev, { type: 'CAPTURE_SUCCESS' }))
        } else {
          screenCaptureService.releaseMemory(imgInfo.dataUrl)
        }
      } catch (err: unknown) {
        clearTimeout(watchdogTimer)
        console.warn('[useScreenCapture] Chụp màn hình thất bại:', err)
        if (isMountedRef.current) {
          setCaptureState((prev) => transitionCaptureState(prev, { type: 'FAIL' }))
          const msg = (err as Error)?.message || ''
          if (msg && !msg.includes('cancelled') && !msg.includes('dismissed')) {
            setAiError(`Không thể chụp màn hình: ${msg}`)
          }
        }
      } finally {
        clearTimeout(watchdogTimer)
        isCapturingRef.current = false
      }
    },
    [captureState, setAiError]
  )

  const handleConfirmCrop = useCallback(
    async (cropRect: CropRect) => {
      if (!capturedImageInfo) return

      setCaptureState((prev) => transitionCaptureState(prev, { type: 'CONFIRM_CROP' }))

      try {
        // 1. Crop and compress downscaled
        const cropped = await screenCaptureService.cropAndCompress(
          capturedImageInfo.dataUrl,
          cropRect,
          { maxWidth: 1400, quality: 0.85 }
        )

        // 2. Dereference raw full-screen image
        screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
        setCapturedImageInfo(null)

        // 3. Fast non-blocking OCR
        const ocrPromise = ocrService.extractText(cropped.dataUrl).catch(() => '')

        // 4. Multimodal analysis
        const analysis = await visualQuestionAnalyzer.analyzeVisualQuestion({
          imageBase64: cropped.dataUrl,
          mimeType: cropped.mimeType,
          thumbnailUrl: cropped.dataUrl,
          sessionId,
          userContext:
            mode === 'interview'
              ? activeJD || activeCV || undefined
              : discussionTopic || undefined,
          responseLanguage: responseLang,
          languageContext: mode === 'interview' ? `${activeJD}\n${activeCV}` : undefined,
        })

        const ocrText = await ocrPromise

        const visualItem: VisualQuestionItem = {
          ...analysis,
          source: 'screenshot',
          thumbnailUrl: cropped.dataUrl,
          ocrText: ocrText || analysis.extractedCode || undefined,
        }

        tieredContextManager.addVisualQuestion(visualItem)
        setActiveVisualQuestion(visualItem)
        setVisualQuestionsHistory((prev) => [...prev, visualItem])

        void sessionsPort.recovery.append({
          eventId: `visual:${sessionId}:${visualItem.id}`,
          sessionId,
          type: 'visual:question',
          timestamp: Date.now(),
          payload: visualItem as unknown as Record<string, unknown>,
        })

        setCaptureState((prev) => transitionCaptureState(prev, { type: 'ANALYSIS_COMPLETE' }))
      } catch (err: unknown) {
        console.error('[useScreenCapture] Multimodal analysis error:', err)
        setCaptureState((prev) => transitionCaptureState(prev, { type: 'FAIL' }))
        setAiError((err as Error)?.message || 'Lỗi khi phân tích câu hỏi hình ảnh.')
      }
    },
    [capturedImageInfo, sessionId, mode, activeJD, activeCV, discussionTopic, responseLang, setAiError]
  )

  const handleCancelCrop = useCallback(() => {
    if (capturedImageInfo) {
      screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
      setCapturedImageInfo(null)
    }
    setCaptureState((prev) => transitionCaptureState(prev, { type: 'CANCEL' }))
  }, [capturedImageInfo])

  const handleRetakeCrop = useCallback(async () => {
    if (capturedImageInfo) {
      screenCaptureService.releaseMemory(capturedImageInfo.dataUrl)
      setCapturedImageInfo(null)
    }
    setCaptureState((prev) => transitionCaptureState(prev, { type: 'RETAKE' }))

    if (retakeTimerRef.current) clearTimeout(retakeTimerRef.current)
    retakeTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        handleStartScreenCapture(lastSourceRef.current)
      }
    }, 150)
  }, [capturedImageInfo, handleStartScreenCapture])

  const handleDismissVisualQuestion = useCallback(() => {
    if (activeVisualQuestion?.thumbnailUrl) {
      screenCaptureService.releaseMemory(activeVisualQuestion.thumbnailUrl)
    }
    setActiveVisualQuestion(null)
    setCaptureState((prev) => transitionCaptureState(prev, { type: 'RESET' }))
  }, [activeVisualQuestion])

  const clearVisuals = useCallback(() => {
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
    setCaptureState('idle')
  }, [activeVisualQuestion, visualQuestionsHistory])

  // Lifecycle memory cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (retakeTimerRef.current) clearTimeout(retakeTimerRef.current)

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
  }, [])

  return {
    captureState,
    isScreenSourcePickerOpen,
    capturedImageInfo,
    activeVisualQuestion,
    visualQuestionsHistory,
    setIsScreenSourcePickerOpen,
    handleTriggerScreenCapture,
    handleStartScreenCapture,
    handleConfirmCrop,
    handleCancelCrop,
    handleRetakeCrop,
    handleDismissVisualQuestion,
    clearVisuals,
  }
}
