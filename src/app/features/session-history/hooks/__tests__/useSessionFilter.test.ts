import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useSessionFilter } from '../useSessionFilter'
import {
  saveSessionToHistory,
  clearAllSessionsFromHistory,
  type MeetingSession,
} from '@/services/sessionHistory'

const mockSessions: MeetingSession[] = [
  {
    id: 's1',
    title: 'Senior Frontend Interview',
    date: '2026-10-28 10:00:00',
    durationMinutes: 45,
    mode: 'interview',
    aiModel: 'gemini-1.5-pro',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [{ id: 1, original: 'Tell me about React Fiber', translated: '', speaker: 'Interviewer', timestamp: '00:10' }],
    suggestions: [],
  },
  {
    id: 's2',
    title: 'System Architecture Discussion',
    date: '2026-10-27 14:00:00',
    durationMinutes: 30,
    mode: 'discussion',
    aiModel: 'gpt-4o',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [{ id: 2, original: 'Discussing microservices', translated: '', speaker: 'Team Lead', timestamp: '00:10' }],
    suggestions: [],
  },
]

describe('useSessionFilter', () => {
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

  it('initializes with default filters and returns all sessions', () => {
    const { result } = renderHook(() => useSessionFilter(mockSessions))

    expect(result.current.searchTerm).toBe('')
    expect(result.current.modeFilter).toBe('all')
    expect(result.current.dateFilter).toBe('all')
    expect(result.current.profileFilter).toBe('all')
    expect(result.current.filteredSessions.length).toBe(2)
  })

  it('filters sessions by mode', () => {
    const { result } = renderHook(() => useSessionFilter(mockSessions))

    act(() => {
      result.current.setModeFilter('interview')
    })
    expect(result.current.filteredSessions.length).toBe(1)
    expect(result.current.filteredSessions[0].id).toBe('s1')

    act(() => {
      result.current.setModeFilter('discussion')
    })
    expect(result.current.filteredSessions.length).toBe(1)
    expect(result.current.filteredSessions[0].id).toBe('s2')
  })

  it('filters sessions by search term', () => {
    const { result } = renderHook(() => useSessionFilter(mockSessions))

    act(() => {
      result.current.setSearchTerm('Frontend')
    })
    expect(result.current.filteredSessions.length).toBe(1)
    expect(result.current.filteredSessions[0].title).toContain('Frontend')

    act(() => {
      result.current.setSearchTerm('non-existent query')
    })
    expect(result.current.filteredSessions.length).toBe(0)
  })
})
