import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { render, fireEvent, act } from '@testing-library/react'
import { AIDiagnostic } from '../AIDiagnostic'

// Ensure minimal mock window.api
if (typeof window !== 'undefined') {
  ;(window as any).api = {
    credentials: {
      hasKey: mock(async () => true),
      getKey: mock(async () => 'mock-key'),
      callLLM: mock(async () => ({
        text: 'Sample CAP analysis response.',
        benchmark: { ttftMs: 120, generationMs: 250, outputTokens: 25 },
      })),
    },
    sessions: {
      getAll: mock(async () => []),
      save: mock(async () => ({ success: true })),
    },
    capture: {
      getDesktopSources: mock(async () => [
        { id: 'screen:0', name: 'Main Screen' },
      ]),
    },
  }
}

describe('AIDiagnostic Smoke Test', () => {
  it('renders LLM benchmark dashboard tab by default without crashing', async () => {
    let result: any
    await act(async () => {
      result = render(<AIDiagnostic />)
    })

    expect(result.container).toBeDefined()
    expect(result.getByText('Chẩn Đoán Tốc Độ AI & Kiểm Tra Chụp Màn Hình')).toBeDefined()
    expect(result.getByText('Đo Tốc Độ API (LLM Benchmark)')).toBeDefined()
    expect(result.getByText('TTFT (token đầu tiên)')).toBeDefined()
    expect(result.getByText('Bắt Đầu Đo Tốc Độ')).toBeDefined()
  })

  it('switches between LLM benchmark and Vision capture tabs cleanly', async () => {
    let result: any
    await act(async () => {
      result = render(<AIDiagnostic />)
    })

    // Initially in LLM tab
    expect(result.getByText('Đo Tốc Độ API (LLM Benchmark)')).toBeDefined()

    // Switch to Vision tab
    const visionTabButton = result.getByRole('button', {
      name: /Chụp Màn Hình & Vision/i,
    })
    await act(async () => {
      fireEvent.click(visionTabButton)
    })

    // Now Vision tab content should be visible
    expect(
      result.getByText('Kiểm Tra Chụp Màn Hình & Multimodal Vision')
    ).toBeDefined()
    expect(result.getByText('Chụp Toàn Cửa Sổ')).toBeDefined()
    expect(result.getByText('Thử Ảnh Mẫu')).toBeDefined()
  })
})
