import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { MockScreenDrillBanner } from '../MockScreenDrillBanner'
import type { MultimodalModelOption, VisualAnalysisResult } from '@/services/screen-capture/types'

const mockModel: MultimodalModelOption = {
  id: 'gemini-1.5-flash',
  name: 'Gemini 1.5 Flash',
  displayName: 'Gemini 1.5 Flash',
  badge: 'Multimodal Vision',
  provider: 'Google',
  description: 'Fast multimodal model',
}

describe('MockScreenDrillBanner', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders drill title, scenarios, and start button', async () => {
    let result: any
    await act(async () => {
      result = render(
        <MockScreenDrillBanner
          onSetCapturedImage={mock(() => {})}
          onAnalyzeImage={mock(() => {})}
          isAnalyzing={false}
          analysisResult={null}
          currentVisionModel={mockModel}
          selectedImplementationLanguage="typescript"
        />
      )
    })

    expect(result.getByText(/Giả Lập Phản Xạ Màn Hình/i)).toBeDefined()
    expect(result.getByText(/LeetCode #167/i)).toBeDefined()
    expect(result.getByRole('button', { name: /Bắt Đầu Test Phản Xạ/i })).toBeDefined()
  })

  it('triggers drill simulation when clicking start button', async () => {
    const mockSetImage = mock(() => {})
    const mockAnalyze = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <MockScreenDrillBanner
          onSetCapturedImage={mockSetImage}
          onAnalyzeImage={mockAnalyze}
          isAnalyzing={false}
          analysisResult={null}
          currentVisionModel={mockModel}
          selectedImplementationLanguage="typescript"
        />
      )
    })

    const startBtn = result.getByRole('button', { name: /Bắt Đầu Test Phản Xạ/i })
    await act(async () => {
      fireEvent.click(startBtn)
    })

    expect(mockSetImage).toHaveBeenCalled()
    expect(mockAnalyze).toHaveBeenCalled()
  })

  it('renders speed verdict when analysisResult with latency is provided', async () => {
    const mockResult: VisualAnalysisResult = {
      id: 'test-res-1',
      title: 'LeetCode 167',
      contentType: 'coding_question',
      problemSummary: 'Two sum problem',
      keyInsights: ['Use two pointers'],
      stepByStepSolution: 'Initialize left and right pointers',
      recommendedAnswer: 'Use two pointers from both ends',
      extractedCode: 'function twoSum() {}',
      thumbnailUrl: '',
      provider: 'Google',
      modelName: 'gemini-1.5-flash',
      latencyMs: 1250,
      timestamp: '12:00',
    }

    let result: any
    await act(async () => {
      result = render(
        <MockScreenDrillBanner
          onSetCapturedImage={mock(() => {})}
          onAnalyzeImage={mock(() => {})}
          isAnalyzing={false}
          analysisResult={mockResult}
          currentVisionModel={mockModel}
          selectedImplementationLanguage="typescript"
        />
      )
    })

    expect(result.getByText(/Tốc Độ Tàng Hình Hoàn Hảo/i)).toBeDefined()
    expect(result.getByText(/1.25s/i)).toBeDefined()
  })
})
