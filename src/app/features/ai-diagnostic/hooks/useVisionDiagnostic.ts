import { useReducer, useState, useEffect, useCallback, useMemo } from 'react'
import {
  screenCaptureService,
  visualQuestionAnalyzer,
  getAvailableMultimodalModels,
  type CapturedImageInfo,
  type MultimodalModelOption,
  type CropRect,
} from '@/services/screen-capture'
import {
  getSavedResponseLanguage,
  normalizeResponseLanguage,
} from '@/services/ai-model/aiModels'
import { settingsManager } from '@/services/settings'
import {
  visionDiagnosticReducer,
  initialVisionDiagnosticState,
  type VisionDiagnosticState,
} from '../reducers/visionDiagnosticReducer'

export interface UseVisionDiagnosticProps {
  onError?: (error: string) => void
}

export interface UseVisionDiagnosticReturn {
  state: VisionDiagnosticState
  availableVisionModels: MultimodalModelOption[]
  currentVisionModel: MultimodalModelOption | null
  responseLanguage: string
  handleStartScreenCapture: (source: {
    sourceType: 'screen' | 'window'
    sourceId?: string
  }) => Promise<void>
  handleTriggerScreenCapture: (cropImmediately: boolean) => void
  handleConfirmCrop: (cropRect: CropRect) => Promise<void>
  handleAnalyzeVision: (
    userPrompt?: string,
    implementationLanguage?: string
  ) => Promise<void>
  handleImplementationLanguageChange: (language: string) => void
  handleSetVisionModel: (modelId: string) => void
  handleSetCapturedImage: (image: CapturedImageInfo | null) => void
  handleOpenCropOverlay: () => void
  handleCloseSourcePicker: () => void
  handleCancelCropping: () => void
}

export function useVisionDiagnostic({
  onError,
}: UseVisionDiagnosticProps = {}): UseVisionDiagnosticReturn {
  const [availableVisionModels, setAvailableVisionModels] = useState<
    MultimodalModelOption[]
  >(() => getAvailableMultimodalModels())

  const [state, dispatch] = useReducer(visionDiagnosticReducer, {
    ...initialVisionDiagnosticState,
    selectedVisionId: (() => {
      const saved = settingsManager.get('selectedMultimodal') as string
      if (saved) return saved
      const models = getAvailableMultimodalModels()
      return models[0]?.id || ''
    })(),
  })

  const [sessionId] = useState(() => 'diagnostic_' + Date.now())
  const responseLanguage = useMemo(
    () => normalizeResponseLanguage(getSavedResponseLanguage()),
    []
  )

  const currentVisionModel = useMemo(() => {
    return (
      availableVisionModels.find((m) => m.id === state.selectedVisionId) ||
      availableVisionModels[0] ||
      null
    )
  }, [availableVisionModels, state.selectedVisionId])

  // Sync available vision models on storage changes
  useEffect(() => {
    const refreshVision = () => {
      const vModels = getAvailableMultimodalModels()
      setAvailableVisionModels(vModels)
      if (!state.selectedVisionId && vModels.length > 0) {
        dispatch({ type: 'SET_VISION_MODEL', modelId: vModels[0].id })
      }
    }
    refreshVision()
    window.addEventListener('storage', refreshVision)
    return () => window.removeEventListener('storage', refreshVision)
  }, [state.selectedVisionId])

  const handleStartScreenCapture = useCallback(
    async (source: { sourceType: 'screen' | 'window'; sourceId?: string }) => {
      dispatch({ type: 'START_CAPTURE' })
      try {
        const imgInfo = await screenCaptureService.captureScreen(source)
        dispatch({ type: 'CAPTURE_SUCCESS', image: imgInfo })
      } catch (err: any) {
        dispatch({ type: 'CAPTURE_FAILURE' })
        const msg = `Lỗi chụp màn hình: ${
          err?.message || 'Người dùng đã hủy hoặc timeout.'
        }`
        if (onError) onError(msg)
      }
    },
    [onError]
  )

  const handleTriggerScreenCapture = useCallback(
    (cropImmediately: boolean) => {
      dispatch({ type: 'OPEN_SOURCE_PICKER', cropImmediately })
    },
    []
  )

  const handleConfirmCrop = useCallback(
    async (cropRect: CropRect) => {
      if (!state.capturedImage) return
      try {
        const cropped = await screenCaptureService.cropAndCompress(
          state.capturedImage.dataUrl,
          cropRect,
          { maxWidth: 1400, quality: 0.85 }
        )
        const croppedImage: CapturedImageInfo = {
          dataUrl: cropped.dataUrl,
          width: cropped.width,
          height: cropped.height,
          source: state.capturedImage.source,
          capturedAt: Date.now(),
        }
        dispatch({ type: 'CONFIRM_CROP', croppedImage })
      } catch (err: any) {
        dispatch({ type: 'CANCEL_CROPPING' })
        const msg = `Lỗi cắt vùng ảnh: ${err?.message || 'Không thể cắt ảnh.'}`
        if (onError) onError(msg)
      }
    },
    [state.capturedImage, onError]
  )

  const handleAnalyzeVision = useCallback(
    async (
      userPrompt?: string,
      implementationLanguage = state.selectedImplementationLanguage
    ) => {
      if (!state.capturedImage) return
      dispatch({ type: 'START_ANALYSIS' })
      try {
        const result = await visualQuestionAnalyzer.analyzeVisualQuestion({
          imageBase64: state.capturedImage.dataUrl,
          mimeType: 'image/jpeg',
          thumbnailUrl: state.capturedImage.dataUrl,
          sessionId,
          userContext: userPrompt?.trim() || undefined,
          customModelId: state.selectedVisionId,
          responseLanguage: normalizeResponseLanguage(getSavedResponseLanguage()),
          implementationLanguage: implementationLanguage || undefined,
        })
        dispatch({ type: 'ANALYSIS_SUCCESS', result })
      } catch (err: any) {
        dispatch({ type: 'ANALYSIS_FAILURE' })
        const msg = `Lỗi phân tích hình ảnh từ AI: ${
          err?.message || 'Không thể kết nối mô hình Vision.'
        }`
        if (onError) onError(msg)
      }
    },
    [
      state.capturedImage,
      state.selectedImplementationLanguage,
      state.selectedVisionId,
      sessionId,
      onError,
    ]
  )

  const handleImplementationLanguageChange = useCallback(
    (language: string) => {
      dispatch({ type: 'SET_IMPLEMENTATION_LANGUAGE', language })
    },
    []
  )

  const handleSetVisionModel = useCallback((modelId: string) => {
    dispatch({ type: 'SET_VISION_MODEL', modelId })
  }, [])

  const handleSetCapturedImage = useCallback(
    (image: CapturedImageInfo | null) => {
      dispatch({ type: 'SET_CAPTURED_IMAGE', image })
    },
    []
  )

  const handleOpenCropOverlay = useCallback(() => {
    dispatch({ type: 'START_CROPPING' })
  }, [])

  const handleCloseSourcePicker = useCallback(() => {
    dispatch({ type: 'CLOSE_SOURCE_PICKER' })
  }, [])

  const handleCancelCropping = useCallback(() => {
    dispatch({ type: 'CANCEL_CROPPING' })
  }, [])

  return {
    state,
    availableVisionModels,
    currentVisionModel,
    responseLanguage,
    handleStartScreenCapture,
    handleTriggerScreenCapture,
    handleConfirmCrop,
    handleAnalyzeVision,
    handleImplementationLanguageChange,
    handleSetVisionModel,
    handleSetCapturedImage,
    handleOpenCropOverlay,
    handleCloseSourcePicker,
    handleCancelCropping,
  }
}
