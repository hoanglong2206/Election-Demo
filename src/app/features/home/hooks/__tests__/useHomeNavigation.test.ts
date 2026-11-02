import '@/test/setupDom'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useHomeNavigation } from '../useHomeNavigation'
import { setPreflightLobbySkipped } from '@/hooks/usePreFlightLobby'

describe('useHomeNavigation Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    setPreflightLobbySkipped(false)
  })

  it('manages sessions and launches meeting directly without setting validation meetingError', () => {
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

    // Meeting error should remain null because Meeting Mode itself guards missing context
    expect(result.current.meetingError).toBeNull()
    expect(result.current.isLobbyOpen).toBe(true)
  })

  it('opens preflight lobby modal in discussion mode and enters meeting upon confirm', () => {
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

    expect(result.current.isLobbyOpen).toBe(false)

    act(() => {
      result.current.handleLaunchMeeting()
    })

    expect(result.current.meetingError).toBeNull()
    expect(result.current.isLobbyOpen).toBe(true)
    expect(onViewChange).not.toHaveBeenCalled()

    act(() => {
      result.current.handleConfirmLaunchMeeting()
    })

    expect(result.current.isLobbyOpen).toBe(false)
    expect(flushPendingContextSync).toHaveBeenCalled()
    expect(onViewChange).toHaveBeenCalledWith('meeting')
  })

  it('bypasses preflight lobby directly when skipped preference is set', () => {
    setPreflightLobbySkipped(true)

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
    expect(result.current.isLobbyOpen).toBe(false)
    expect(flushPendingContextSync).toHaveBeenCalled()
    expect(onViewChange).toHaveBeenCalledWith('meeting')
  })

  it('manages lobby skipped state, allows manual open and resetting skipped state', () => {
    setPreflightLobbySkipped(true)

    const { result } = renderHook(() =>
      useHomeNavigation({
        mode: 'discussion',
        contextData: { cvSummary: '', jobDescription: '' },
        activeProfile: null,
        onViewChange: mock(() => {}),
        flushPendingContextSync: mock(() => {}),
      })
    )

    expect(result.current.isLobbySkipped).toBe(true)

    // Manual open
    act(() => {
      result.current.handleOpenLobby()
    })
    expect(result.current.isLobbyOpen).toBe(true)

    // Reset skipped state
    act(() => {
      result.current.handleResetLobbySkipped()
    })
    expect(result.current.isLobbySkipped).toBe(false)
  })
})
