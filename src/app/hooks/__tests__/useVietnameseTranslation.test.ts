import '@/test/setupDom'
import { describe, expect, it, spyOn } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useVietnameseTranslation } from '../useVietnameseTranslation'
import * as translateModule from '@/services/ai-model/copilot/translate'

describe('useVietnameseTranslation', () => {
  it('translates text on first toggle and toggles visibility on subsequent clicks', async () => {
    const spy = spyOn(translateModule, 'translateToVietnamese').mockImplementation(
      async (source: string) => `Dịch: ${source}`
    )

    const { result } = renderHook(() => useVietnameseTranslation())
    expect(result.current.entries).toEqual({})

    // First toggle -> triggers LLM translation
    await act(async () => {
      await result.current.toggle('msg-1', 'Hello world')
    })

    expect(spy).toHaveBeenCalledWith('Hello world')
    expect(result.current.entries['msg-1']).toEqual({
      text: 'Dịch: Hello world',
      showing: true,
      busy: false,
      error: undefined,
    })

    // Second toggle -> flips showing to false without calling LLM again
    await act(async () => {
      await result.current.toggle('msg-1', 'Hello world')
    })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(result.current.entries['msg-1'].showing).toBe(false)

    // Third toggle -> flips showing back to true
    await act(async () => {
      await result.current.toggle('msg-1', 'Hello world')
    })

    expect(result.current.entries['msg-1'].showing).toBe(true)

    // Reset clears entries
    act(() => {
      result.current.reset()
    })
    expect(result.current.entries).toEqual({})

    spy.mockRestore()
  })

  it('handles translation error gracefully', async () => {
    const spy = spyOn(translateModule, 'translateToVietnamese').mockImplementation(
      async () => {
        throw new Error('LLM rate limit reached')
      }
    )

    const { result } = renderHook(() => useVietnameseTranslation())

    await act(async () => {
      await result.current.toggle('err-key', 'Fail text')
    })

    expect(result.current.entries['err-key'].error).toBe('LLM rate limit reached')
    expect(result.current.entries['err-key'].busy).toBe(false)
    expect(result.current.entries['err-key'].showing).toBe(false)

    spy.mockRestore()
  })
})
