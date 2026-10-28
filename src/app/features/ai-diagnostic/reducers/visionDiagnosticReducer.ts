import type {
  CapturedImageInfo,
  VisualAnalysisResult,
} from '@/services/screen-capture/types'

export interface VisionDiagnosticState {
  capturedImage: CapturedImageInfo | null
  isCapturing: boolean
  isSourcePickerOpen: boolean
  isCropping: boolean
  cropAfterCapture: boolean
  isAnalyzingVision: boolean
  visionAnalysisResult: VisualAnalysisResult | null
  selectedImplementationLanguage: string
  selectedVisionId: string
}

export type VisionDiagnosticAction =
  | { type: 'OPEN_SOURCE_PICKER'; cropImmediately: boolean }
  | { type: 'CLOSE_SOURCE_PICKER' }
  | { type: 'START_CAPTURE' }
  | { type: 'CAPTURE_SUCCESS'; image: CapturedImageInfo }
  | { type: 'CAPTURE_FAILURE' }
  | { type: 'START_CROPPING' }
  | { type: 'CONFIRM_CROP'; croppedImage: CapturedImageInfo }
  | { type: 'CANCEL_CROPPING' }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; result: VisualAnalysisResult }
  | { type: 'ANALYSIS_FAILURE' }
  | { type: 'SET_CAPTURED_IMAGE'; image: CapturedImageInfo | null }
  | { type: 'SET_IMPLEMENTATION_LANGUAGE'; language: string }
  | { type: 'SET_VISION_MODEL'; modelId: string }
  | { type: 'RESET_STATE' }

export const initialVisionDiagnosticState: VisionDiagnosticState = {
  capturedImage: null,
  isCapturing: false,
  isSourcePickerOpen: false,
  isCropping: false,
  cropAfterCapture: false,
  isAnalyzingVision: false,
  visionAnalysisResult: null,
  selectedImplementationLanguage: '',
  selectedVisionId: '',
}

export function visionDiagnosticReducer(
  state: VisionDiagnosticState,
  action: VisionDiagnosticAction
): VisionDiagnosticState {
  switch (action.type) {
    case 'OPEN_SOURCE_PICKER':
      return {
        ...state,
        cropAfterCapture: action.cropImmediately,
        isSourcePickerOpen: true,
      }

    case 'CLOSE_SOURCE_PICKER':
      return {
        ...state,
        isSourcePickerOpen: false,
      }

    case 'START_CAPTURE':
      return {
        ...state,
        isSourcePickerOpen: false,
        isCapturing: true,
      }

    case 'CAPTURE_SUCCESS':
      return {
        ...state,
        isCapturing: false,
        capturedImage: action.image,
        isCropping: state.cropAfterCapture,
        visionAnalysisResult: null,
      }

    case 'CAPTURE_FAILURE':
      return {
        ...state,
        isCapturing: false,
      }

    case 'START_CROPPING':
      return {
        ...state,
        isCropping: true,
      }

    case 'CONFIRM_CROP':
      return {
        ...state,
        isCropping: false,
        capturedImage: action.croppedImage,
      }

    case 'CANCEL_CROPPING':
      return {
        ...state,
        isCropping: false,
      }

    case 'START_ANALYSIS':
      return {
        ...state,
        isAnalyzingVision: true,
      }

    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        isAnalyzingVision: false,
        visionAnalysisResult: action.result,
      }

    case 'ANALYSIS_FAILURE':
      return {
        ...state,
        isAnalyzingVision: false,
      }

    case 'SET_CAPTURED_IMAGE':
      return {
        ...state,
        capturedImage: action.image,
        visionAnalysisResult: action.image ? state.visionAnalysisResult : null,
      }

    case 'SET_IMPLEMENTATION_LANGUAGE':
      return {
        ...state,
        selectedImplementationLanguage: action.language,
      }

    case 'SET_VISION_MODEL':
      return {
        ...state,
        selectedVisionId: action.modelId,
      }

    case 'RESET_STATE':
      return {
        ...initialVisionDiagnosticState,
        selectedVisionId: state.selectedVisionId,
      }

    default:
      return state
  }
}
