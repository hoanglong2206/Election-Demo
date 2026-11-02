import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { BenchmarkResponseView } from '../BenchmarkResponseView'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'

describe('BenchmarkResponseView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders placeholder when benchmarkResult is null', async () => {
    let result: any
    await act(async () => {
      result = render(<BenchmarkResponseView benchmarkResult={null} />)
    })

    expect(result.getByText(/Chưa có dữ liệu phản hồi/i)).toBeDefined()
    expect(result.getByText(/Bắt Đầu Đo Tốc Độ/i)).toBeDefined()
  })

  it('renders formatted response content by default', async () => {
    const mockResult: AIBenchmarkResult = {
      modelId: 'gemini-3-flash-preview',
      modelName: 'Gemini 3 Flash',
      provider: 'Google',
      latencyMs: 420,
      ttftMs: 250,
      tokensPerSec: 105,
      prompt: 'tóm tắt phim naruto',
      status: 'excellent',
      isRealAPI: true,
      timestamp: '11:30:00',
      response: '**Naruto** là ninja làng Lá.\n- Nhân vật chính: Naruto\n* Đồng đội: Sasuke, Sakura',
      isTruncated: false,
    }

    let result: any
    await act(async () => {
      result = render(<BenchmarkResponseView benchmarkResult={mockResult} />)
    })

    expect(result.getByText('Naruto')).toBeDefined()
    expect(result.getByText('Định dạng')).toBeDefined()
    expect(result.getByText('Mã thô')).toBeDefined()
  })

  it('switches between formatted view and raw view', async () => {
    const rawText = '**Naruto** là ninja làng Lá.'
    const mockResult: AIBenchmarkResult = {
      modelId: 'qwen3.8-27b',
      modelName: 'Qwen 3.8 27B',
      provider: 'Groq',
      latencyMs: 380,
      ttftMs: 180,
      tokensPerSec: 120,
      prompt: 'tóm tắt phim naruto',
      status: 'excellent',
      isRealAPI: true,
      timestamp: '11:30:00',
      response: rawText,
    }

    let result: any
    await act(async () => {
      result = render(<BenchmarkResponseView benchmarkResult={mockResult} />)
    })

    const rawButton = result.getByText('Mã thô')
    await act(async () => {
      fireEvent.click(rawButton)
    })

    expect(result.getByText(rawText)).toBeDefined()

    const formattedButton = result.getByText('Định dạng')
    await act(async () => {
      fireEvent.click(formattedButton)
    })

    expect(result.getByText('Naruto')).toBeDefined()
  })

  it('displays warning banner when response is truncated', async () => {
    const mockResult: AIBenchmarkResult = {
      modelId: 'allam-2-7b',
      modelName: 'ALLaM 2 7B',
      provider: 'Groq',
      latencyMs: 500,
      ttftMs: 200,
      tokensPerSec: 80,
      prompt: 'tóm tắt phim naruto',
      status: 'good',
      isRealAPI: true,
      timestamp: '11:30:00',
      response: 'Phần kết bị cắt ngang',
      isTruncated: true,
      maxTokensConfigured: 500,
      finishReason: 'length',
    }

    let result: any
    await act(async () => {
      result = render(<BenchmarkResponseView benchmarkResult={mockResult} />)
    })

    expect(
      result.getByText(/Câu trả lời chạm giới hạn 500 token/i)
    ).toBeDefined()
  })

  it('copies response text to clipboard when clicking copy button', async () => {
    const writeTextMock = mock(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    const mockResult: AIBenchmarkResult = {
      modelId: 'gemini-3-flash-preview',
      modelName: 'Gemini 3 Flash',
      provider: 'Google',
      latencyMs: 300,
      ttftMs: 150,
      tokensPerSec: 90,
      prompt: 'tóm tắt phim naruto',
      status: 'excellent',
      isRealAPI: true,
      timestamp: '11:30:00',
      response: 'Nội dung phản hồi',
    }

    let result: any
    await act(async () => {
      result = render(<BenchmarkResponseView benchmarkResult={mockResult} />)
    })

    const copyBtn = result.getByRole('button', { name: /Sao chép/i })
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(writeTextMock).toHaveBeenCalledWith('Nội dung phản hồi')
    expect(result.getByText(/Đã chép/i)).toBeDefined()
  })
})
