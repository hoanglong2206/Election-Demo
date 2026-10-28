import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useSessionHistoryActions } from '../useSessionHistoryActions'
import {
  saveSessionToHistory,
  clearAllSessionsFromHistory,
  type MeetingSession,
} from '@/services/sessionHistory'

const mockSessions: MeetingSession[] = [
  {
    id: 's1',
    title: 'Session 1',
    date: '2026-10-28 10:00:00',
    durationMinutes: 30,
    mode: 'interview',
    aiModel: 'gemini',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [],
    suggestions: [],
  },
  {
    id: 's2',
    title: 'Session 2',
    date: '2026-10-28 11:00:00',
    durationMinutes: 45,
    mode: 'discussion',
    aiModel: 'gemini',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [],
    suggestions: [],
  },
]

describe('useSessionHistoryActions', () => {
  beforeEach(() => {
    clearAllSessionsFromHistory()
    for (const s of mockSessions) {
      saveSessionToHistory(s)
    }
  })

  afterEach(() => {
    cleanup()
    clearAllSessionsFromHistory()
  })

  it('handles multi-select mode and toggling individual sessions', () => {
    let currentSessions = [...mockSessions]
    const setSessions = (val: any) => {
      currentSessions = typeof val === 'function' ? val(currentSessions) : val
    }
    let selectedId = 's1'
    const setSelectedId = (val: any) => {
      selectedId = typeof val === 'function' ? val(selectedId) : val
    }

    const { result } = renderHook(() =>
      useSessionHistoryActions({
        sessions: currentSessions,
        setSessions,
        selectedSessionId: selectedId,
        setSelectedSessionId: setSelectedId,
        filteredSessions: currentSessions,
      })
    )

    expect(result.current.isSelectMode).toBe(false)
    expect(result.current.selectedSessionIds.size).toBe(0)

    act(() => {
      result.current.handleToggleSelectMode()
    })
    expect(result.current.isSelectMode).toBe(true)

    act(() => {
      result.current.handleToggleSelectSession('s1')
    })
    expect(result.current.selectedSessionIds.has('s1')).toBe(true)

    act(() => {
      result.current.handleToggleSelectAll()
    })
    expect(result.current.selectedSessionIds.size).toBe(2)
  })

  it('triggers delete single and executes confirm delete', () => {
    let currentSessions = [...mockSessions]
    const setSessions = (val: any) => {
      currentSessions = typeof val === 'function' ? val(currentSessions) : val
    }
    let selectedId = 's1'
    const setSelectedId = (val: any) => {
      selectedId = typeof val === 'function' ? val(selectedId) : val
    }

    const { result } = renderHook(() =>
      useSessionHistoryActions({
        sessions: currentSessions,
        setSessions,
        selectedSessionId: selectedId,
        setSelectedSessionId: setSelectedId,
        filteredSessions: currentSessions,
      })
    )

    act(() => {
      const dummyEvent = { stopPropagation: () => {} } as React.MouseEvent
      result.current.handleDeleteSingle('s1', dummyEvent)
    })
    expect(result.current.deleteTarget).toEqual({ type: 'single', session: mockSessions[0] })

    act(() => {
      result.current.handleConfirmDelete()
    })
    expect(result.current.deleteTarget).toBeNull()
    expect(currentSessions.length).toBe(1)
    expect(currentSessions[0].id).toBe('s2')
  })

  it('triggers clear all and executes confirm delete', () => {
    let currentSessions = [...mockSessions]
    const setSessions = (val: any) => {
      currentSessions = typeof val === 'function' ? val(currentSessions) : val
    }
    let selectedId = 's1'
    const setSelectedId = (val: any) => {
      selectedId = typeof val === 'function' ? val(selectedId) : val
    }

    const { result } = renderHook(() =>
      useSessionHistoryActions({
        sessions: currentSessions,
        setSessions,
        selectedSessionId: selectedId,
        setSelectedSessionId: setSelectedId,
        filteredSessions: currentSessions,
      })
    )

    act(() => {
      result.current.handleClearAll()
    })
    expect(result.current.deleteTarget).toEqual({ type: 'all', count: 2 })

    act(() => {
      result.current.handleConfirmDelete()
    })
    expect(result.current.deleteTarget).toBeNull()
    expect(currentSessions.length).toBe(0)
    expect(selectedId).toBe('')
  })
})
