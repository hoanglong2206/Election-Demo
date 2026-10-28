import { useState, useCallback } from 'react'
import type {
  CapturedImageInfo,
  VisualAnalysisResult,
  MultimodalModelOption,
} from '@/services/screen-capture/types'
import { VisionControlsBar } from './VisionControlsBar'
import { VisionImagePreview } from './VisionImagePreview'
import { VisionPromptForm } from './VisionPromptForm'
import { VisionResultView } from './VisionResultView'

export interface ScreenCaptureVisionSectionProps {
  currentVisionModel: MultimodalModelOption | null
  availableVisionModels: MultimodalModelOption[]
  selectedVisionModelId: string
  onSelectVisionModel: (modelId: string) => void
  capturedImage: CapturedImageInfo | null
  onSetCapturedImage: (img: CapturedImageInfo | null) => void
  onTriggerScreenCapture: (cropImmediately: boolean) => void
  isCapturing: boolean
  isAnalyzing: boolean
  analysisResult: VisualAnalysisResult | null
  onAnalyzeImage: (
    customPrompt?: string,
    implementationLanguage?: string
  ) => void
  onOpenCropOverlay: () => void
  onOpenSettings?: () => void
  selectedImplementationLanguage: string
  onSelectImplementationLanguage: (language: string) => void
  showTranslate: boolean
}

export function ScreenCaptureVisionSection({
  currentVisionModel,
  availableVisionModels,
  selectedVisionModelId,
  onSelectVisionModel,
  capturedImage,
  onSetCapturedImage,
  onTriggerScreenCapture,
  isCapturing,
  isAnalyzing,
  analysisResult,
  onAnalyzeImage,
  onOpenCropOverlay,
  selectedImplementationLanguage,
  onSelectImplementationLanguage,
  showTranslate,
}: ScreenCaptureVisionSectionProps) {
  const [userContext, setUserContext] = useState('')

  const handleClearImage = useCallback(() => {
    onSetCapturedImage(null)
  }, [onSetCapturedImage])

  const handleAnalyzeClick = useCallback(() => {
    onAnalyzeImage(userContext, selectedImplementationLanguage)
  }, [onAnalyzeImage, userContext, selectedImplementationLanguage])

  const handleReanalyzeWithLanguage = useCallback(() => {
    onAnalyzeImage(userContext, selectedImplementationLanguage)
  }, [onAnalyzeImage, userContext, selectedImplementationLanguage])

  const isNoModel = !currentVisionModel || !selectedVisionModelId

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3.5 shadow-sm flex flex-col h-full">
      {/* 1. Top Controls Bar */}
      <VisionControlsBar
        currentVisionModel={currentVisionModel}
        availableVisionModels={availableVisionModels}
        selectedVisionModelId={selectedVisionModelId}
        onSelectVisionModel={onSelectVisionModel}
        onTriggerScreenCapture={onTriggerScreenCapture}
        onSetCapturedImage={onSetCapturedImage}
        onOpenCropOverlay={onOpenCropOverlay}
        hasCapturedImage={!!capturedImage}
        isCapturing={isCapturing}
      />

      {/* 2. Captured Image Viewport */}
      <VisionImagePreview
        capturedImage={capturedImage}
        onClearImage={handleClearImage}
        onOpenCropOverlay={onOpenCropOverlay}
        onTriggerCapture={() => onTriggerScreenCapture(false)}
      />

      {/* 3. Prompt context & Analysis trigger form */}
      <VisionPromptForm
        userContext={userContext}
        onUserContextChange={setUserContext}
        selectedImplementationLanguage={selectedImplementationLanguage}
        onSelectImplementationLanguage={onSelectImplementationLanguage}
        onAnalyzeImage={handleAnalyzeClick}
        isAnalyzing={isAnalyzing}
        hasCapturedImage={!!capturedImage}
        isNoModel={isNoModel}
      />

      {/* 4. Analysis Results View */}
      <VisionResultView
        analysisResult={analysisResult}
        showTranslate={showTranslate}
        selectedImplementationLanguage={selectedImplementationLanguage}
        onSelectImplementationLanguage={onSelectImplementationLanguage}
        onReanalyzeWithLanguage={handleReanalyzeWithLanguage}
        isAnalyzing={isAnalyzing}
      />
    </div>
  )
}
