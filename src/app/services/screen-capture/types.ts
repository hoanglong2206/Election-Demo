export type VisualContentType =
  | 'coding_question'
  | 'error_trace'
  | 'architecture_diagram'
  | 'system_design'
  | 'text_question'
  | 'unknown'

export type ScreenCaptureState =
  | 'idle'
  | 'capturing'
  | 'cropping'
  | 'processing'
  | 'completed'
  | 'error'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CapturedImageInfo {
  dataUrl: string
  width: number
  height: number
  source: 'native_electron' | 'browser_display_media'
  capturedAt: number
}

export interface CroppedImageInfo {
  dataUrl: string
  base64: string
  mimeType: string
  width: number
  height: number
  sizeBytes: number
  ocrText?: string
}

export interface VisualAnalysisResult {
  id: string
  timestamp: string
  contentType: VisualContentType
  title: string
  language?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  extractedCode?: string
  solutionCode?: string
  timeComplexity?: string
  spaceComplexity?: string
  problemSummary: string
  keyInsights: string[]
  stepByStepSolution: string
  recommendedAnswer: string
  ocrText?: string
  thumbnailUrl: string
  provider: string
  modelName: string
  latencyMs: number
}

export interface VisualQuestionItem extends VisualAnalysisResult {
  source: 'screenshot'
}

export interface MultimodalModelOption {
  id: string
  name: string
  provider: 'Google' | 'OpenAI' | 'Groq'
  displayName: string
  badge: string
  description?: string
}

import { modelRegistryService } from '../ai-model/model-registry'

export function getAvailableMultimodalModels(): MultimodalModelOption[] {
  try {
    const discovered = modelRegistryService.getMultimodalModels()
    if (discovered && discovered.length > 0) {
      return discovered.map((m) => ({
        id: m.id,
        name: m.displayName,
        provider: m.provider as any,
        displayName: m.displayName,
        badge: m.tier === 'Pro' ? 'Flagship Vision' : 'Multimodal Vision',
        description: m.description || m.recommendedFor,
      }))
    }
  } catch {}
  return []
}
