import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { Settings } from '../Settings'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'

describe('Settings Smoke Test', () => {
  let mockIpc: MockIpcAdapter

  beforeEach(() => {
    localStorage.clear()
    mockIpc = new MockIpcAdapter()
    setIpcClient(mockIpc)
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
  })

  it('renders all settings cards and header properly', async () => {
    let result: any
    await act(async () => {
      result = render(<Settings />)
    })

    expect(result.getByText('Cài Đặt Hệ Thống & Trí Tuệ Nhân Tạo')).toBeDefined()
    expect(result.getAllByText('Lưu cài đặt').length).toBeGreaterThanOrEqual(1)
    expect(result.getByText('Khóa API AI (Bảo Mật Bằng OS Credential Store)')).toBeDefined()
    expect(result.getByText('STT Engine (Nhận diện giọng nói)')).toBeDefined()
    expect(result.getByText('LLM Engine (Trí tuệ phản hồi & Tư vấn)')).toBeDefined()
    expect(
      result.getByText('Multimodal Vision Model (Phân tích Ảnh câu hỏi & Diagram)')
    ).toBeDefined()
    expect(
      result.getByText('Cấu Hình Nâng Cao Cho Cuộc Họp (Audio & Response Tuning)')
    ).toBeDefined()
    expect(result.getByText('Theo Dõi Chi Phí & Token Usage API')).toBeDefined()
  })

  it('triggers save action when clicking save settings button', async () => {
    let result: any
    await act(async () => {
      result = render(<Settings />)
    })
    const saveBtn = result.container.querySelector('#btn-save-settings')
    expect(saveBtn).not.toBeNull()
    await act(async () => {
      fireEvent.click(saveBtn!)
    })
  })

  it('triggers onViewChange when clicking open cost tracker dashboard', async () => {
    let targetView = ''
    let result: any
    await act(async () => {
      result = render(<Settings onViewChange={(v) => (targetView = v)} />)
    })

    const costBtn = result.getByText('Mở Dashboard Chi Phí')
    await act(async () => {
      fireEvent.click(costBtn)
    })

    expect(targetView).toBe('cost-tracker')
  })
})
