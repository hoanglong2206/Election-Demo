import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { AudioTest } from '../AudioTest'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'

describe('AudioTest Screen Smoke Tests', () => {
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

  it('renders header, control toolbar, STT preview, and pipeline cards', async () => {
    let result: any
    await act(async () => {
      result = render(<AudioTest />)
    })

    expect(result.getByText(/Kiểm Tra Thu Âm Hệ Thống & Live STT/i)).toBeDefined()
    expect(result.getAllByText('System Audio').length).toBeGreaterThanOrEqual(1)
    expect(result.getByText('Microphone')).toBeDefined()
    expect(result.getAllByText('Start Capture').length).toBeGreaterThanOrEqual(1)
    expect(result.getByText('Auto Calibrate')).toBeDefined()
    expect(result.getByText(/Live STT Preview/i)).toBeDefined()
    expect(result.getByText(/Pipeline \(6 Bước\)/i)).toBeDefined()
  })

  it('simulates STT line on click and adds to subtitle stream', async () => {
    let result: any
    await act(async () => {
      result = render(<AudioTest />)
    })

    const simulateBtn = result.getByText('Mẫu YouTube')
    await act(async () => {
      fireEvent.click(simulateBtn)
    })

    expect(result.getByText(/Welcome back everyone/i)).toBeDefined()
    expect(result.getByText(/Chào mừng các bạn đã quay trở lại/i)).toBeDefined()
  })

  it('opens and closes VAD Calibration modal', async () => {
    let result: any
    await act(async () => {
      result = render(<AudioTest />)
    })

    const calibrateBtn = result.getByText('Auto Calibrate')
    await act(async () => {
      fireEvent.click(calibrateBtn)
    })

    expect(result.getByText('Tự Động Cân Chỉnh VAD')).toBeDefined()
    expect(result.getByText('Bắt đầu đo độ ồn (3s)')).toBeDefined()

    const cancelBtn = result.getByText('Hủy bỏ')
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    expect(result.queryByText('Bắt đầu đo độ ồn (3s)')).toBeNull()
  })
})
