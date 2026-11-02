import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { DualChannelReadinessCard } from '../DualChannelReadinessCard'

describe('DualChannelReadinessCard', () => {
  afterEach(() => {
    cleanup()
    if (typeof localStorage !== 'undefined') localStorage.clear()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  })

  it('renders initial state with 0% readiness when system audio is not verified', async () => {
    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="system"
          setSourceType={mock(() => {})}
          isCapturing={false}
          isAudioDetected={false}
          db={-60}
          volume={0}
          startCapture={mock(async () => {})}
          stopCapture={mock(() => {})}
        />
      )
    })

    expect(result.getByText(/Xác Thực Sẵn Sàng Âm Thanh Hệ Thống/i)).toBeDefined()
    expect(result.getByText(/Sẵn sàng: 0%/i)).toBeDefined()
    expect(result.getByText(/Âm thanh Hệ thống & Cuộc gọi/i)).toBeDefined()
  })

  it('switches source type and starts capture when clicking Test System button', async () => {
    const mockSetSource = mock(() => {})
    const mockStartCapture = mock(async () => {})

    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="system"
          setSourceType={mockSetSource}
          isCapturing={false}
          isAudioDetected={false}
          db={-60}
          volume={0}
          startCapture={mockStartCapture}
          stopCapture={mock(() => {})}
        />
      )
    })

    const testSystemBtn = result.getByText('Test System')
    await act(async () => {
      fireEvent.click(testSystemBtn)
    })

    expect(mockSetSource).toHaveBeenCalledWith('system')
    expect(mockStartCapture).toHaveBeenCalled()
  })

  it('auto verifies system audio when capturing audio above threshold', async () => {
    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="system"
          setSourceType={mock(() => {})}
          isCapturing={true}
          isAudioDetected={true}
          db={-25}
          volume={0.3}
          startCapture={mock(async () => {})}
          stopCapture={mock(() => {})}
        />
      )
    })

    expect(result.getByText(/Sẵn sàng: 100%/i)).toBeDefined()
    expect(result.getByText(/Đạt \(-25dB\)/i)).toBeDefined()
  })

  it('triggers onEnterMeeting callback when meeting button clicked', async () => {
    const mockEnterMeeting = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="system"
          setSourceType={mock(() => {})}
          isCapturing={false}
          isAudioDetected={false}
          db={-60}
          volume={0}
          startCapture={mock(async () => {})}
          stopCapture={mock(() => {})}
          onEnterMeeting={mockEnterMeeting}
        />
      )
    })

    const enterBtn = result.getByText(/Vào Cuộc Họp Ngay/i)
    await act(async () => {
      fireEvent.click(enterBtn)
    })

    expect(mockEnterMeeting).toHaveBeenCalled()
  })
})
