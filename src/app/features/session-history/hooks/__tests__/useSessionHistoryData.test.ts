import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useSessionHistoryData } from '../useSessionHistoryData'
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
    _isFullyLoaded: true,
  },
]

describe('useSessionHistoryData', () => {
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

  it('loads sessions and selects the first session by default', () => {
    const { result } = renderHook(() => useSessionHistoryData())

    expect(result.current.sessions.length).toBeGreaterThanOrEqual(1)
    expect(result.current.selectedSessionId).toBe('s1')
    expect(result.current.currentSession?.title).toBe('Session 1')
  })

  it('updates retention policy', () => {
    const { result } = renderHook(() => useSessionHistoryData())

    act(() => {
      result.current.handleRetentionChange(30)
    })
    expect(result.current.retentionDays).toBe(30)
  })
})
