import { describe, it, expect } from 'bun:test'
import {
  visionDiagnosticReducer,
  initialVisionDiagnosticState,
  type VisionDiagnosticState,
} from '../visionDiagnosticReducer'
import type {
  CapturedImageInfo,
  VisualAnalysisResult,
} from '@/services/screen-capture/types'

describe('visionDiagnosticReducer', () => {
  const fakeImage: CapturedImageInfo = {
    dataUrl: 'data:image/png;base64,sample',
    width: 1920,
    height: 1080,
    source: 'browser_display_media',
    capturedAt: 1000,
  }

  const fakeAnalysisResult: VisualAnalysisResult = {
    id: 'res_1',
    timestamp: '12:00:00',
    contentType: 'coding_question',
    title: 'Two Sum',
    problemSummary: 'Find two numbers that add up to target',
    keyInsights: ['Use a hash map'],
    stepByStepSolution: 'Iterate array and check complement in map.',
    recommendedAnswer: 'Use a hash map for O(n) runtime.',
    thumbnailUrl: 'data:image/png;base64,thumb',
    provider: 'Google',
    modelName: 'Gemini 2.5 Flash',
    latencyMs: 350,
  }

  it('handles source picker open & close with cropImmediately flag', () => {
    let state = visionDiagnosticReducer(initialVisionDiagnosticState, {
      type: 'OPEN_SOURCE_PICKER',
      cropImmediately: true,
    })
    expect(state.isSourcePickerOpen).toBe(true)
    expect(state.cropAfterCapture).toBe(true)

    state = visionDiagnosticReducer(state, { type: 'CLOSE_SOURCE_PICKER' })
    expect(state.isSourcePickerOpen).toBe(false)
  })

  it('transitions through capture flow: START_CAPTURE -> CAPTURE_SUCCESS -> enters cropping if cropAfterCapture=true', () => {
    let state: VisionDiagnosticState = {
      ...initialVisionDiagnosticState,
      isSourcePickerOpen: true,
      cropAfterCapture: true,
    }

    state = visionDiagnosticReducer(state, { type: 'START_CAPTURE' })
    expect(state.isCapturing).toBe(true)
    expect(state.isSourcePickerOpen).toBe(false)

    state = visionDiagnosticReducer(state, {
      type: 'CAPTURE_SUCCESS',
      image: fakeImage,
    })
    expect(state.isCapturing).toBe(false)
    expect(state.capturedImage).toEqual(fakeImage)
    expect(state.isCropping).toBe(true)
  })

  it('handles crop confirmation and updates capturedImage', () => {
    const croppedImage: CapturedImageInfo = {
      ...fakeImage,
      width: 800,
      height: 600,
      capturedAt: 2000,
    }

    let state: VisionDiagnosticState = {
      ...initialVisionDiagnosticState,
      capturedImage: fakeImage,
      isCropping: true,
    }

    state = visionDiagnosticReducer(state, {
      type: 'CONFIRM_CROP',
      croppedImage,
    })

    expect(state.isCropping).toBe(false)
    expect(state.capturedImage).toEqual(croppedImage)
  })

  it('transitions analysis state: START_ANALYSIS -> ANALYSIS_SUCCESS', () => {
    let state = visionDiagnosticReducer(initialVisionDiagnosticState, {
      type: 'START_ANALYSIS',
    })
    expect(state.isAnalyzingVision).toBe(true)

    state = visionDiagnosticReducer(state, {
      type: 'ANALYSIS_SUCCESS',
      result: fakeAnalysisResult,
    })
    expect(state.isAnalyzingVision).toBe(false)
    expect(state.visionAnalysisResult).toEqual(fakeAnalysisResult)
  })

  it('resets state while preserving selected vision model id', () => {
    const dirtyState: VisionDiagnosticState = {
      ...initialVisionDiagnosticState,
      capturedImage: fakeImage,
      isCropping: true,
      selectedVisionId: 'gemini-1.5-pro',
      selectedImplementationLanguage: 'python',
    }

    const reset = visionDiagnosticReducer(dirtyState, { type: 'RESET_STATE' })
    expect(reset.capturedImage).toBeNull()
    expect(reset.isCropping).toBe(false)
    expect(reset.selectedImplementationLanguage).toBe('')
    expect(reset.selectedVisionId).toBe('gemini-1.5-pro')
  })
})
