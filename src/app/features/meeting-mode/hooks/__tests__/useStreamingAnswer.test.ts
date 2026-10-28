import '@/test/setupDom'
import { describe, expect, it, spyOn } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useStreamingAnswer } from '../useStreamingAnswer'
import * as interviewModule from '@/services/ai-model/copilot/interview'

describe('useStreamingAnswer', () => {
  it('initializes with idle state', () => {
    const { result } = renderHook(() => useStreamingAnswer())
    expect(result.current.streamingState).toBe('idle')
    expect(result.current.streamedContent).toBe('')
    expect(result.current.error).toBeNull()
    expect(result.current.ttftMs).toBeNull()
  })

  it('handles stream lifecycle: connecting -> streaming -> done', async () => {
    const mockCancel = () => {}

    const spy = spyOn(interviewModule, 'generateInterviewAnswerStream').mockImplementation(
      async (_params: any, callbacks: any) => {
        setTimeout(() => {
          callbacks.onFirstToken?.(120)
          callbacks.onDelta?.('Hello ', 'Hello ')
          callbacks.onDelta?.('world!', 'Hello world!')
          callbacks.onDone?.({ content: 'Hello world!', durationMs: 250 })
        }, 10)
        return mockCancel
      }
    )

    const { result } = renderHook(() => useStreamingAnswer())

    await act(async () => {
      await result.current.startStream({
        question: 'Tell me about yourself',
        cvSummary: 'Software Engineer',
      })
    })

    expect(result.current.streamingState).toBe('connecting')

    // Wait for the async timeout callbacks
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
    })

    expect(result.current.streamingState).toBe('done')
    expect(result.current.streamedContent).toBe('Hello world!')
    expect(result.current.ttftMs).toBe(120)
    expect(result.current.totalDurationMs).toBeGreaterThanOrEqual(0)

    spy.mockRestore()
  })

  it('resets state properly on reset()', async () => {
    const { result } = renderHook(() => useStreamingAnswer())

    act(() => {
      result.current.reset()
    })

    expect(result.current.streamingState).toBe('idle')
    expect(result.current.streamedContent).toBe('')
    expect(result.current.error).toBeNull()
  })
})
