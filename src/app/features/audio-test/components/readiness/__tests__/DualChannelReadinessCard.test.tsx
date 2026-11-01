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

  it('renders initial state with 0% readiness when no channels verified', async () => {
    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="mic"
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

    expect(result.getByText(/Xác Thực Âm Thanh 2 Chiều/i)).toBeDefined()
    expect(result.getByText(/Sẵn sàng: 0%/i)).toBeDefined()
    expect(result.getByText(/Kênh 1: Giọng của bạn \(Microphone\)/i)).toBeDefined()
    expect(result.getByText(/Kênh 2: Giọng người hỏi \(System Audio\)/i)).toBeDefined()
  })

  it('switches source type when clicking Test Kênh System button', async () => {
    const mockSetSource = mock(() => {})
    const mockStartCapture = mock(async () => {})

    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="mic"
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

  it('auto verifies channel when capturing audio above threshold', async () => {
    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="mic"
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

    expect(result.getByText(/Sẵn sàng: 50%/i)).toBeDefined()
    expect(result.getByText(/Đạt \(-25dB\)/i)).toBeDefined()
  })

  it('triggers onEnterMeeting callback when meeting button clicked', async () => {
    const mockEnterMeeting = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <DualChannelReadinessCard
          sourceType="mic"
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
