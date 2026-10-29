import { describe, it, expect, beforeEach } from 'bun:test'
import {
  saveSessionToHistoryAsync,
  getSavedSessions,
  initSessionStorage,
  subscribeSessions,
  clearAllSessionsFromHistory,
} from '../repository'
import type { MeetingSession } from '../types'

describe('Session Save Immediate Visibility Tests', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    const globalAny = globalThis as any
    globalAny.localStorage = {
      getItem: (key: string) => localStorageMock[key] ?? null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = String(value)
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: () => {
        localStorageMock = {}
      },
    }

    globalAny.window = {
      api: {
        sessions: {
          isFirstRun: async () => false,
          setFirstRunCompleted: async () => true,
          getAll: async () => [],
          save: async () => ({ success: true, id: 'test' }),
          delete: async () => true,
          deleteAll: async () => true,
        },
      },
    }
  })

  it('immediately reflects newly saved session in getSavedSessions and subsequent initSessionStorage calls', async () => {
    // 1. Initial startup load (empty list)
    clearAllSessionsFromHistory()
    const initial = await initSessionStorage()
    expect(initial).toEqual([])
    expect(getSavedSessions()).toEqual([])

    // 2. Save a new session from Meeting Mode
    const newSession: MeetingSession = {
      id: 'session_live_test_123',
      title: 'Phỏng vấn Frontend Engineer Live',
      date: '30/10/2026, 01:30',
      durationMinutes: 15,
      mode: 'interview',
      aiModel: 'Gemini 2.5 Flash',
      audioSource: 'System Audio',
      contextApplied: true,
      transcripts: [
        { id: 1, speaker: 'Interviewer', timestamp: '00:01', original: 'Hello, welcome!', translated: 'Xin chào, chào mừng bạn!' },
      ],
      suggestions: [],
    }

    let notifiedSessions: MeetingSession[] | null = null
    const unsubscribe = subscribeSessions((updated) => {
      notifiedSessions = updated
    })

    const saveResult = await saveSessionToHistoryAsync(newSession)
    expect(saveResult.success).toBe(true)

    // 3. Listener received the session immediately
    expect(notifiedSessions).not.toBeNull()
    expect(notifiedSessions!.length).toBe(1)
    expect(notifiedSessions![0].id).toBe('session_live_test_123')

    // 4. Synchronous getSavedSessions() contains the session
    const current = getSavedSessions()
    expect(current.length).toBe(1)
    expect(current[0].id).toBe('session_live_test_123')
    expect(current[0].title).toBe('Phỏng vấn Frontend Engineer Live')

    // 5. When Home mounts and calls initSessionStorage(), it MUST return the latest saved session,
    // NEVER the stale empty array from the initial startup promise!
    const reloaded = await initSessionStorage()
    expect(reloaded.length).toBe(1)
    expect(reloaded[0].id).toBe('session_live_test_123')

    unsubscribe()
  })
})
