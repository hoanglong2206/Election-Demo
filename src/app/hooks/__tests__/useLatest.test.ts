import '@/test/setupDom'
import { describe, expect, it } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useLatest } from '../useLatest'

describe('useLatest', () => {
  it('returns ref pointing to current value and updates on rerender', () => {
    let value = 1
    const { result, rerender } = renderHook(() => useLatest(value))

    expect(result.current.current).toBe(1)

    value = 2
    rerender()
    expect(result.current.current).toBe(2)

    value = 3
    rerender()
    expect(result.current.current).toBe(3)
  })
})
