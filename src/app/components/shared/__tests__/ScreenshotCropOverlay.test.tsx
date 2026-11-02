import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { ScreenshotCropOverlay } from '../ScreenshotCropOverlay'
import type { CapturedImageInfo } from '@/services/screen-capture/types'

const fakeImage: CapturedImageInfo = {
  dataUrl: 'data:image/png;base64,sample',
  width: 1920,
  height: 1080,
  source: 'native_electron',
  capturedAt: Date.now(),
}

describe('ScreenshotCropOverlay', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders action bar with Chụp lại button and presets', async () => {
    let result: any
    await act(async () => {
      result = render(
        <ScreenshotCropOverlay
          imageInfo={fakeImage}
          onConfirmCrop={mock(() => {})}
          onCancel={mock(() => {})}
          onRetake={mock(() => {})}
        />
      )
    })

    expect(result.getByRole('button', { name: /chụp lại/i })).toBeDefined()
    expect(result.getByRole('button', { name: /xác nhận & phân tích ai/i })).toBeDefined()
    expect(result.getByText(/Nửa Trái \(LeetCode\)/i)).toBeDefined()
  })

  it('triggers onRetake callback when clicking Chụp lại button', async () => {
    const mockRetake = mock(() => {})
    let result: any
    await act(async () => {
      result = render(
        <ScreenshotCropOverlay
          imageInfo={fakeImage}
          onConfirmCrop={mock(() => {})}
          onCancel={mock(() => {})}
          onRetake={mockRetake}
        />
      )
    })

    const retakeBtn = result.getByRole('button', { name: /chụp lại/i })
    await act(async () => {
      fireEvent.click(retakeBtn)
    })

    // Wait for the 150ms close animation timeout
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(mockRetake).toHaveBeenCalled()
  })

  it('triggers onRetake callback when pressing R key', async () => {
    const mockRetake = mock(() => {})
    await act(async () => {
      render(
        <ScreenshotCropOverlay
          imageInfo={fakeImage}
          onConfirmCrop={mock(() => {})}
          onCancel={mock(() => {})}
          onRetake={mockRetake}
        />
      )
    })

    await act(async () => {
      fireEvent.keyDown(window, { key: 'r' })
    })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(mockRetake).toHaveBeenCalled()
  })
})
