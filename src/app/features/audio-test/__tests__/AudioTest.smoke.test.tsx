import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { AudioTest } from '../AudioTest'
import { audioPipelineController } from '@/hooks/useAudioPipeline'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'

describe('AudioTest Screen Smoke Tests', () => {
  let mockIpc: MockIpcAdapter

  beforeEach(() => {
    localStorage.clear()
    mockIpc = new MockIpcAdapter()
    setIpcClient(mockIpc)
    ;(audioPipelineController as any).captureService.start = mock(async () => {})
    ;(audioPipelineController as any).captureService.stop = mock(() => {})
  })

  afterEach(() => {
    audioPipelineController.stop()
    cleanup()
    resetIpcClient()
  })

  it('renders header, control toolbar, STT preview, and pipeline cards', async () => {
    let result: any
    await act(async () => {
      result = render(<AudioTest />)
    })

    expect(result.getByText(/Kiểm Tra Thu Âm Hệ Thống & Live STT/i)).toBeDefined()
    expect(result.getAllByText(/System Audio/i).length).toBeGreaterThanOrEqual(1)
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

  it('disables Start Capture button when meeting capture is active in the background', async () => {
    // Start meeting capture in shared pipeline
    await audioPipelineController.start('system', { owner: 'meeting' })

    let result: any
    await act(async () => {
      result = render(<AudioTest />)
    })

    const startBtn = result.container.querySelector('#btn-start-capture') as HTMLButtonElement
    expect(startBtn).toBeDefined()
    expect(startBtn.disabled).toBe(true)
    expect(result.getByText(/Phiên họp đang thu âm trong nền/i)).toBeDefined()

    // Clicking when disabled should not start audio-test capture
    await act(async () => {
      fireEvent.click(startBtn)
    })
    expect(audioPipelineController.getState().captureOwner).toBe('meeting')

    // Cleanup
    audioPipelineController.stop('meeting')
  })
})
