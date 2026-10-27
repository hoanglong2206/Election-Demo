import { describe, it, expect, beforeEach } from 'bun:test'
import {
  HybridSessionRepository,
  normalizeSession,
} from '../repository'
import type { MeetingSession } from '../types'

describe('Seed Data & Resurrection Prevention Tests', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    // Mock localStorage in global scope
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

    // Mock window.api.sessions
    globalAny.window = {
      api: {
        sessions: {
          isFirstRun: async () => false, // Default: not first run
          setFirstRunCompleted: async () => true,
          getAll: async () => [],
          save: async () => ({ success: true, id: 'test' }),
          delete: async () => true,
          deleteAll: async () => true,
        },
      },
    }
  })

  it('1. Regression Test: deleteAll() followed by init() with empty storage MUST return empty list []', async () => {
    const repo = new HybridSessionRepository()

    // Simulate existing sessions
    repo.save({
      id: 'session_real_1',
      title: 'Real Interview Session',
      date: '27/10/2026',
      durationMinutes: 10,
      mode: 'interview',
      aiModel: 'Gemini',
      audioSource: 'Default Mic',
      contextApplied: false,
      transcripts: [],
      suggestions: [],
    })

    expect(repo.getAll().length).toBe(1)

    // User calls deleteAll()
    const afterDelete = repo.deleteAll()
    expect(afterDelete).toEqual([])
    expect(repo.getAll()).toEqual([])

    // Verify first run flag was permanently set
    expect(localStorageMock['meeting_copilot_first_run_completed']).toBe('true')

    // Simulate app restart: new repository instance initializing against empty persistent storage
    const newRepo = new HybridSessionRepository()
    const loaded = await newRepo.init()

    // MUST NOT resurrect mock or seed sessions!
    expect(loaded).toEqual([])
    expect(newRepo.getAll()).toEqual([])
  })

  it('2. Catch branches of init() and synchronous getAll() must NEVER assign seed data', async () => {
    const globalAny = globalThis as any
    // Force Electron IPC getAll() to throw an error
    globalAny.window.api.sessions.getAll = async () => {
      throw new Error('Disk unreadable')
    }

    const repo = new HybridSessionRepository()
    const loaded = await repo.init()

    expect(loaded).toEqual([])
    expect(repo.getAll()).toEqual([])
  })

  it('3. Sample sessions (isSample=true): never saved to storage and excluded from search', () => {
    const repo = new HybridSessionRepository()

    const sampleSession: MeetingSession = normalizeSession({
      id: 'sample_01',
      title: 'Sample Meeting Session',
      mode: 'interview',
      isSample: true,
      transcripts: [
        { id: 1, original: 'Sample question about microservices', translated: '' },
      ],
    })

    expect(sampleSession.isSample).toBe(true)

    // Save should ignore sample sessions
    repo.save(sampleSession)

    // Search and filter MUST exclude sample sessions
    const searchResults = repo.searchAndFilter({ searchTerm: 'microservices' })
    expect(searchResults.some((s) => s.id === 'sample_01')).toBe(false)
  })

  it('4. saveToLocalStorageBackup: only stores lightweight index, never heavy transcripts', () => {
    const repo = new HybridSessionRepository()

    const heavySession: MeetingSession = {
      id: 'heavy_01',
      title: 'Heavy Transcript Session',
      date: '27/10/2026',
      durationMinutes: 45,
      mode: 'interview',
      aiModel: 'Gemini',
      audioSource: 'Default Mic',
      contextApplied: false,
      transcripts: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        speaker: 'Interviewer',
        timestamp: '01:00',
        original: 'This is a long sentence in transcript to test storage quota limitations.',
        translated: 'Đây là câu dài trong bản ghi phiên họp.',
      })),
      suggestions: [],
    }

    repo.save(heavySession)

    const rawBackup = localStorageMock['meeting_copilot_session_backup']
    expect(rawBackup).toBeDefined()

    const parsedBackup = JSON.parse(rawBackup)
    expect(parsedBackup.length).toBe(1)
    const backupItem = parsedBackup[0]

    // Only lightweight fields exist
    expect(backupItem.id).toBe('heavy_01')
    expect(backupItem.title).toBe('Heavy Transcript Session')
    expect(backupItem.durationMinutes).toBe(45)
    // Transcripts and suggestions must NOT be in localStorage backup
    expect(backupItem.transcripts).toBeUndefined()
    expect(backupItem.suggestions).toBeUndefined()
  })
})
