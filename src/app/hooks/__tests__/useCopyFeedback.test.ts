import '@/test/setupDom'
import { describe, expect, it, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useCopyFeedback } from '../useCopyFeedback'

describe('useCopyFeedback', () => {
  it('copies text using navigator.clipboard and resets feedback after duration', async () => {
    const writeTextMock = mock(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useCopyFeedback(40))

    expect(result.current.copied).toBe(false)

    let success = false
    await act(async () => {
      success = await result.current.copy('Hello test')
    })

    expect(success).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('Hello test')
    expect(result.current.copied).toBe(true)

    // Wait for reset timer
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
    })

    expect(result.current.copied).toBe(false)
  })

  it('handles clipboard errors gracefully', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mock(async () => {
          throw new Error('Permission denied')
        }),
      },
      configurable: true,
      writable: true,
    })

    const { result } = renderHook(() => useCopyFeedback(40))

    let success = true
    await act(async () => {
      success = await result.current.copy('Forbidden text')
    })

    expect(success).toBe(false)
    expect(result.current.copied).toBe(false)
  })
})
