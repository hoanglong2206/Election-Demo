import '@/test/setupDom'
import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { PreFlightLobbyModal } from '../PreFlightLobbyModal'
import {
  setPreflightLobbySkipped,
  PREFLIGHT_SKIP_STORAGE_KEY,
} from '@/hooks/usePreFlightLobby'
import * as aiModels from '@/services/ai-model/aiModels'

class MockAudioContext {
  state = 'running'
  currentTime = 0
  resume = async () => {}
  createOscillator = () => ({
    type: 'sine',
    frequency: { setValueAtTime: () => {} },
    connect: () => {},
    start: () => {},
    stop: () => {},
  })
  createGain = () => ({
    gain: {
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    },
    connect: () => {},
  })
  destination = {}
}

describe('PreFlightLobbyModal Component', () => {
  beforeEach(() => {
    localStorage.clear()
    setPreflightLobbySkipped(false)
    ;(globalThis.window as any).AudioContext = MockAudioContext
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render modal when isOpen is false', () => {
    const { queryByText } = render(
      <PreFlightLobbyModal
        isOpen={false}
        onClose={mock(() => {})}
        onEnterMeeting={mock(() => {})}
      />
    )

    expect(queryByText(/Sảnh Chờ/i)).toBeNull()
  })

  it('renders all 3 inspection cards, readiness telemetry, and stable tactical placeholder when isOpen is true', async () => {
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    // Header Title
    expect(result.getByText(/Sảnh Chờ Kiểm Định Thực Chiến/i)).toBeDefined()

    // 3 Diagnostic Cards
    expect(result.getByText(/1\. Âm thanh Hệ thống & Tai nghe \(Loopback\)/i)).toBeDefined()
    expect(result.getByText(/2\. Mô hình AI & Tốc độ Phản xạ/i)).toBeDefined()
    expect(result.getByText(/3\. Từ vựng Chuyên ngành Mồi Whisper STT/i)).toBeDefined()

    // Stable Tactical Advice Placeholder (prevents UI jump)
    expect(result.getByText(/Bấm "Đo trễ \(Ping Test\)" để kiểm tra tốc độ phản xạ/i)).toBeDefined()

    // Default readiness badge & enter button
    expect(result.getByText(/Sẵn sàng:/i)).toBeDefined()
    expect(result.getByText(/Vào Cuộc Họp Ngay/i)).toBeDefined()
  })

  it('triggers chime sound and verifies loopback audio', async () => {
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    const chimeBtn = result.getByRole('button', { name: /phát chuông test/i })
    expect(chimeBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(chimeBtn)
    })

    // After chime finishes/verifies
    expect(result.getByText(/Đạt chuẩn tai nghe/i)).toBeDefined()
  })

  it('manages jargon keywords: adds new keyword and removes keyword', async () => {
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    const input = result.getByPlaceholderText('+ Thêm từ...') as HTMLInputElement
    expect(input).toBeDefined()

    // Add custom keyword
    await act(async () => {
      input.value = 'RustLang'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const submitBtn = input.parentElement!.querySelector('button[type="submit"]') as HTMLButtonElement
    await act(async () => {
      submitBtn.click()
    })

    expect(result.getByText('RustLang')).toBeDefined()

    // Remove custom keyword
    const removeBtn = result.getByTitle('Xóa RustLang')
    await act(async () => {
      fireEvent.click(removeBtn)
    })

    expect(result.queryByText('RustLang')).toBeNull()
  })

  it('toggles skip preference checkbox and saves to storage', async () => {
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    const checkbox = result.getByRole('checkbox')
    expect(checkbox.checked).toBe(false)

    await act(async () => {
      fireEvent.click(checkbox)
    })

    expect(checkbox.checked).toBe(true)
    expect(localStorage.getItem(PREFLIGHT_SKIP_STORAGE_KEY)).toBe('true')
  })

  it('disables enter meeting button until checks are passed, but allows bypass button', async () => {
    const onEnterMeeting = mock(() => {})
    const onClose = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={onClose}
          onEnterMeeting={onEnterMeeting}
        />
      )
    })

    const enterBtn = result.getByRole('button', { name: /vào cuộc họp ngay/i }) as HTMLButtonElement
    expect(enterBtn.disabled).toBe(true)

    await act(async () => {
      fireEvent.click(enterBtn)
    })
    expect(onEnterMeeting).not.toHaveBeenCalled()

    const bypassBtn = result.getByRole('button', { name: /bỏ qua & vào ngay/i })
    await act(async () => {
      fireEvent.click(bypassBtn)
    })
    expect(onEnterMeeting).toHaveBeenCalledTimes(1)

    const closeBtn = result.getByTitle('Đóng sảnh chờ')
    await act(async () => {
      fireEvent.click(closeBtn)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('enables enter meeting button once all checks are verified', async () => {
    spyOn(aiModels, 'runAILatencyBenchmark').mockResolvedValue({
      modelId: 'allam-2-7b',
      modelName: 'ALLaM-2-7b',
      provider: 'Groq',
      benchmarkPrompt: 'Test',
      responseContent: 'CAP theorem analysis response text.',
      latencyMs: 320,
      tokensPerSec: 50,
      outputTokens: 25,
      ttftMs: 210,
      timestamp: Date.now(),
      isRealAPI: true,
      isError: false,
    } as any)

    const onEnterMeeting = mock(() => {})
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={onEnterMeeting}
        />
      )
    })

    const enterBtn = result.getByRole('button', { name: /vào cuộc họp ngay/i }) as HTMLButtonElement
    expect(enterBtn.disabled).toBe(true)

    // 1. Verify Audio (Chime)
    const chimeBtn = result.getByRole('button', { name: /phát chuông test/i })
    await act(async () => {
      fireEvent.click(chimeBtn)
    })

    // 2. Verify AI Model (Ping)
    const pingBtn = result.getByRole('button', { name: /đo trễ \(ping test\)/i })
    await act(async () => {
      fireEvent.click(pingBtn)
    })

    // Assert that Card 2 shows "Đo lại ping" button when ping succeeds
    expect(result.getByRole('button', { name: /đo lại ping/i })).toBeDefined()

    // All checks passed -> button enabled
    expect(enterBtn.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(enterBtn)
    })
    expect(onEnterMeeting).toHaveBeenCalledTimes(1)
  })

  it('triggers deep link navigation callbacks when provided', async () => {
    const onOpenAudioTest = mock(() => {})
    const onOpenAIDiagnostic = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
          onOpenAudioTest={onOpenAudioTest}
          onOpenAIDiagnostic={onOpenAIDiagnostic}
        />
      )
    })

    const audioTestBtns = result.getAllByTitle(/Mở trang Audio Test/i)
    expect(audioTestBtns.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(audioTestBtns[0])
    })
    expect(onOpenAudioTest).toHaveBeenCalledTimes(1)

    const aiDiagBtn = result.getByTitle(/Mở trang AI Benchmark chuyên sâu/i)
    await act(async () => {
      fireEvent.click(aiDiagBtn)
    })
    expect(onOpenAIDiagnostic).toHaveBeenCalledTimes(1)
  })

  it('opens AI model dropdown and closes on click outside or Escape key', async () => {
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    // Initially dropdown menu is not visible
    expect(result.queryByText(/Chọn Model cho Cuộc họp/i)).toBeNull()

    // Click to open model dropdown
    const modelDropdownTrigger = result.getByTitle(/Bấm để đổi mô hình AI/i)
    await act(async () => {
      fireEvent.click(modelDropdownTrigger)
    })

    // Dropdown is open
    expect(result.getByText(/Chọn Model cho Cuộc họp/i)).toBeDefined()

    // Click outside -> Dropdown closes
    await act(async () => {
      fireEvent.mouseDown(document.body)
    })
    expect(result.queryByText(/Chọn Model cho Cuộc họp/i)).toBeNull()

    // Reopen dropdown
    await act(async () => {
      fireEvent.click(modelDropdownTrigger)
    })
    expect(result.getByText(/Chọn Model cho Cuộc họp/i)).toBeDefined()

    // Press Escape -> Dropdown closes
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(result.queryByText(/Chọn Model cho Cuộc họp/i)).toBeNull()

    // Reopen and select an option
    await act(async () => {
      fireEvent.click(modelDropdownTrigger)
    })
    const options = result.getAllByRole('button').filter((btn: HTMLElement) => btn.textContent?.includes('ALLaM'))
    if (options.length > 0) {
      await act(async () => {
        fireEvent.click(options[0])
      })
      // Dropdown should close after selection
      expect(result.queryByText(/Chọn Model cho Cuộc họp/i)).toBeNull()
    }
  })
  it('unchecks skip preference checkbox when lobby is re-enabled from skipped state', async () => {
    // 1. Initially lobby was skipped
    setPreflightLobbySkipped(true)

    // 2. Render modal initially closed (like Home.tsx does)
    let result: any
    await act(async () => {
      result = render(
        <PreFlightLobbyModal
          isOpen={false}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    // 3. User clicks "Bật lại sảnh chờ" -> setPreflightLobbySkipped(false)
    await act(async () => {
      setPreflightLobbySkipped(false)
    })

    // 4. User clicks "Vào Meeting Mode" -> isOpen becomes true
    await act(async () => {
      result.rerender(
        <PreFlightLobbyModal
          isOpen={true}
          onClose={mock(() => {})}
          onEnterMeeting={mock(() => {})}
        />
      )
    })

    // 5. The skip checkbox must be unchecked!
    const checkbox = result.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })
});
