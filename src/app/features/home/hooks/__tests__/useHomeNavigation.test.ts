import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useHomeNavigation } from '../useHomeNavigation'

describe('useHomeNavigation Hook', () => {
  it('manages sessions and handles launch meeting validation failure', () => {
    const onViewChange = mock(() => {})
    const onInterviewTabChange = mock(() => {})
    const flushPendingContextSync = mock(() => {})

    const { result } = renderHook(() =>
      useHomeNavigation({
        mode: 'interview',
        contextData: { cvSummary: '', jobDescription: '' },
        activeProfile: null,
        onViewChange,
        onInterviewTabChange,
        flushPendingContextSync,
      })
    )

    expect(result.current.meetingError).toBeNull()

    act(() => {
      result.current.handleLaunchMeeting()
    })

    expect(result.current.meetingError).toContain('yêu cầu phải có cả CV và JD')
    expect(onViewChange).not.toHaveBeenCalled()
    expect(onInterviewTabChange).toHaveBeenCalledWith('cv')
  })

  it('launches meeting successfully in discussion mode', () => {
    const onViewChange = mock(() => {})
    const flushPendingContextSync = mock(() => {})

    const { result } = renderHook(() =>
      useHomeNavigation({
        mode: 'discussion',
        contextData: { cvSummary: '', jobDescription: '', discussionTopic: 'Tech architecture' },
        activeProfile: null,
        onViewChange,
        flushPendingContextSync,
      })
    )

    act(() => {
      result.current.handleLaunchMeeting()
    })

    expect(result.current.meetingError).toBeNull()
    expect(flushPendingContextSync).toHaveBeenCalled()
    expect(onViewChange).toHaveBeenCalledWith('meeting')
  })
})
