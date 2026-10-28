import '@/test/setupDom'
import { describe, expect, it, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useTimeout } from '../useTimeout'

describe('useTimeout', () => {
  it('calls callback after specified delay', async () => {
    const cb = mock(() => {})
    renderHook(() => useTimeout(cb, 30))

    expect(cb).not.toHaveBeenCalled()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire if delay is null or negative', async () => {
    const cb = mock(() => {})
    renderHook(() => useTimeout(cb, null))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    expect(cb).not.toHaveBeenCalled()
  })

  it('cancels timer on unmount', async () => {
    const cb = mock(() => {})
    const { unmount } = renderHook(() => useTimeout(cb, 50))

    unmount()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 70))
    })

    expect(cb).not.toHaveBeenCalled()
  })
})
