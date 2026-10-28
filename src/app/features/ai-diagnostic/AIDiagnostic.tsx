import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { ScreenCaptureSourcePicker } from '@/components/shared/ScreenCaptureSourcePicker'
import { ScreenshotCropOverlay } from '@/components/shared/ScreenshotCropOverlay'
import { AIDiagnosticHeader } from './components/header'
import { AILatencyBenchmarkSection } from './components/benchmark'
import { ScreenCaptureVisionSection } from './components/vision'
import { useLLMBenchmark } from './hooks/useLLMBenchmark'
import { useVisionDiagnostic } from './hooks/useVisionDiagnostic'
import type { DiagnosticViewTab } from './types'

export interface AIDiagnosticProps {
  onViewChange?: (
    view:
      | 'home'
      | 'meeting'
      | 'audio-test'
      | 'ai-diagnostic'
      | 'history'
      | 'settings'
  ) => void
}

export function AIDiagnostic({ onViewChange }: AIDiagnosticProps) {
  const [activeTab, setActiveTab] = useState<DiagnosticViewTab>('llm-speed')
  const [generalError, setGeneralError] = useState<string | null>(null)

  // 1. LLM Latency & Token Rate Benchmark Hook
  const {
    allLLMModels,
    selectedLLMId,
    setSelectedLLMId,
    currentLLM,
    benchmarkResult,
    isBenchmarking,
    handleRunBenchmark,
  } = useLLMBenchmark({
    onError: setGeneralError,
  })

  // 2. Multimodal Vision & Screen Capture Hook
  const {
    state: visionState,
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
  } = useVisionDiagnostic({
    onError: setGeneralError,
  })

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3.5 animate-fade-in custom-scrollbar">
      {/* Top Header */}
      <AIDiagnosticHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentLLM={currentLLM}
        currentVision={currentVisionModel}
        onOpenSettings={
          onViewChange ? () => onViewChange('settings') : undefined
        }
      />

      {/* Global Error Banner if any */}
      {generalError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start justify-between gap-3 text-rose-200 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-rose-300 block">
                Thông báo lỗi chẩn đoán:
              </span>
              <p className="text-rose-200/90 leading-relaxed">{generalError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGeneralError(null)}
            className="text-rose-300/60 hover:text-rose-200 p-0.5 rounded transition-colors"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Layout based on activeTab */}
      {activeTab === 'llm-speed' && (
        <div className="w-full max-w-4xl mx-auto">
          <AILatencyBenchmarkSection
            currentModel={currentLLM}
            availableModels={allLLMModels}
            selectedModelId={selectedLLMId}
            onSelectModel={setSelectedLLMId}
            benchmarkResult={benchmarkResult}
            isBenchmarking={isBenchmarking}
            onRunBenchmark={handleRunBenchmark}
            onOpenSettings={
              onViewChange ? () => onViewChange('settings') : undefined
            }
          />
        </div>
      )}

      {activeTab === 'vision-capture' && (
        <div className="w-full max-w-4xl mx-auto">
          <ScreenCaptureVisionSection
            currentVisionModel={currentVisionModel}
            availableVisionModels={availableVisionModels}
            selectedVisionModelId={visionState.selectedVisionId}
            onSelectVisionModel={handleSetVisionModel}
            capturedImage={visionState.capturedImage}
            onSetCapturedImage={handleSetCapturedImage}
            onTriggerScreenCapture={handleTriggerScreenCapture}
            isCapturing={visionState.isCapturing}
            isAnalyzing={visionState.isAnalyzingVision}
            analysisResult={visionState.visionAnalysisResult}
            onAnalyzeImage={handleAnalyzeVision}
            selectedImplementationLanguage={
              visionState.selectedImplementationLanguage
            }
            onSelectImplementationLanguage={handleImplementationLanguageChange}
            showTranslate={responseLanguage === 'bilingual'}
            onOpenCropOverlay={handleOpenCropOverlay}
            onOpenSettings={
              onViewChange ? () => onViewChange('settings') : undefined
            }
          />
        </div>
      )}

      {/* Interactive Screenshot Crop Overlay */}
      {visionState.isSourcePickerOpen && (
        <ScreenCaptureSourcePicker
          onSelect={handleStartScreenCapture}
          onCancel={handleCloseSourcePicker}
        />
      )}

      {visionState.isCropping && visionState.capturedImage && (
        <ScreenshotCropOverlay
          imageInfo={visionState.capturedImage}
          onConfirmCrop={handleConfirmCrop}
          onCancel={handleCancelCropping}
          onRetake={() => {
            handleCancelCropping()
            handleTriggerScreenCapture(true)
          }}
        />
      )}
    </div>
  )
}
