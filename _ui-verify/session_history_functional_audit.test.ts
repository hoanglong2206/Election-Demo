import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  getSessionEpoch,
  normalizeSession,
  saveSessionToHistory,
  getSavedSessions,
  deleteSessionFromHistory,
  deleteMultipleSessionsFromHistory,
  clearAllSessionsFromHistory,
  renameSessionInHistory,
  searchAndFilterSessions,
  applySessionRetention,
  subscribeSessions,
  exportSessionToMarkdown,
  exportSessionToPdf,
  generateSessionMarkdown,
  generateSessionJson,
  type MeetingSession,
  type HistoryTranscriptLine,
  type HistorySuggestion,
  type HistoryScreenshotQuestion,
} from '../src/app/services/sessionHistory'

describe('Session History Functional & Data-Integrity Audit', () => {
  // Clear any existing test data before each test
  beforeEach(() => {
    clearAllSessionsFromHistory()
  })

  afterEach(() => {
    clearAllSessionsFromHistory()
  })

  // ── 1. Data Normalization & Resilient Parsing ──────────────────────────────
  describe('Data Normalization & Resilience (Corrupted / Legacy Records)', () => {
    it('handles null, undefined, or malformed session objects without crashing', () => {
      const normalizedNull = normalizeSession(null)
      expect(normalizedNull).toBeDefined()
      expect(normalizedNull.id).toBeDefined()
      expect(normalizedNull.title).toBe('Buổi họp không tên')
      expect(Array.isArray(normalizedNull.transcripts)).toBe(true)
      expect(Array.isArray(normalizedNull.suggestions)).toBe(true)
      expect(Array.isArray(normalizedNull.screenshotQuestions)).toBe(true)

      const normalizedEmpty = normalizeSession({})
      expect(normalizedEmpty.title).toBe('Buổi họp không tên')
      expect(normalizedEmpty.durationMinutes).toBeGreaterThanOrEqual(1)
      expect(normalizedEmpty.mode).toBe('interview')
    })

    it('guarantees non-null arrays for transcripts, suggestions, and screenshotQuestions', () => {
      const partial: any = {
        id: 'session-partial-01',
        title: 'Partial Session',
        transcripts: null,
        suggestions: undefined,
        screenshotQuestions: null,
        metrics: null,
      }
      const normalized = normalizeSession(partial)
      expect(Array.isArray(normalized.transcripts)).toBe(true)
      expect(Array.isArray(normalized.suggestions)).toBe(true)
      expect(Array.isArray(normalized.screenshotQuestions)).toBe(true)
      expect(normalized.metrics).toBeDefined()
      expect(normalized.metrics?.totalInteractions).toBe(0)
    })

    it('correctly extracts session epoch across multiple date formats', () => {
      // 1. startedAt epoch ms
      expect(getSessionEpoch({ startedAt: 1700000000000 })).toBe(1700000000000)

      // 2. id with timestamp (e.g. session_1771234567890)
      expect(getSessionEpoch({ id: 'session_1771234567890' })).toBe(1771234567890)
      expect(getSessionEpoch({ id: 'session-live-1771234567890' })).toBe(1771234567890)

      // 3. Vietnamese locale string: "19/10/2026, 14:30:00"
      const vnEpoch = getSessionEpoch({ date: '19/10/2026, 14:30:00' })
      expect(vnEpoch).toBeGreaterThan(0)
      const d = new Date(vnEpoch)
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(9) // 0-indexed October
      expect(d.getDate()).toBe(19)

      // 4. ISO string
      const isoEpoch = getSessionEpoch({ date: '2026-10-19T14:30:00.000Z' })
      expect(isoEpoch).toBe(Date.parse('2026-10-19T14:30:00.000Z'))
    })
  })

  // ── 2. Meeting Completion to Session History Persistence ──────────────────
  describe('Meeting Completion & Instant History Visibility', () => {
    it('notifies subscribers immediately when a new session is saved without app restart', () => {
      let subscriberCallCount = 0
      let latestList: MeetingSession[] = []

      const unsubscribe = subscribeSessions((updated) => {
        subscriberCallCount++
        latestList = updated
      })

      const newSession: MeetingSession = {
        id: `session_${Date.now()}`,
        title: 'Phỏng vấn Backend Senior Go',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 60,
        durationSeconds: 3600,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        candidateName: 'Nguyễn Văn A',
        companyName: 'TechCorp VN',
        targetRole: 'Senior Go Engineer',
        profileSnapshot: {
          presetId: 'profile-go-01',
          name: 'Senior Go Profile',
          role: 'Senior Go Engineer',
          companyName: 'TechCorp VN',
          keywords: ['Go', 'Goroutines', 'gRPC', 'PostgreSQL'],
          snapshotAt: Date.now() - 3600000,
        },
        transcripts: [
          {
            id: 't-1',
            speaker: 'Interviewer',
            timestamp: '00:05',
            timestampMs: 5000,
            original: 'Can you explain Go channels and goroutines?',
            translated: 'Bạn có thể giải thích channels và goroutines trong Go không?',
            isQuestion: true,
          },
        ],
        suggestions: [
          {
            id: 1,
            type: 'answer',
            content: 'Goroutines are lightweight threads managed by the Go runtime...',
            confidence: 96,
            timestamp: '00:06',
            timestampMs: 6000,
            tokenUsage: {
              promptTokens: 120,
              completionTokens: 85,
              totalTokens: 205,
              estimatedCostUsd: 0.00015,
            },
          },
        ],
      }

      saveSessionToHistory(newSession)

      expect(subscriberCallCount).toBeGreaterThanOrEqual(1)
      expect(latestList.length).toBe(1)
      expect(latestList[0].id).toBe(newSession.id)
      expect(latestList[0].title).toBe('Phỏng vấn Backend Senior Go')

      unsubscribe()
    })

    it('places newest sessions first in order', () => {
      const olderSession: MeetingSession = {
        id: 'session_1700000000000',
        title: 'Older Session',
        startedAt: 1700000000000,
        date: '15/11/2023, 10:00',
        durationMinutes: 30,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      const newerSession: MeetingSession = {
        id: 'session_1780000000000',
        title: 'Newer Session',
        startedAt: 1780000000000,
        date: '20/10/2026, 10:00',
        durationMinutes: 45,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(olderSession)
      saveSessionToHistory(newerSession)

      const all = getSavedSessions()
      expect(all.length).toBe(2)
      expect(all[0].id).toBe(newerSession.id)
      expect(all[1].id).toBe(olderSession.id)
    })
  })

  // ── 3. Profile Snapshot Immutability ────────────────────────────────────────
  describe('Profile Snapshot Immutability', () => {
    it('persists immutable Profile Snapshot unaffected by later profile mutations', () => {
      const originalSnapshot = {
        presetId: 'preset-frontend-99',
        name: 'React Expert v1',
        role: 'Frontend Lead',
        companyName: 'Acme Corp',
        keywords: ['React 19', 'Next.js 15', 'TailwindCSS'],
        jdText: 'Lead Frontend Team...',
        snapshotAt: 1770000000000,
      }

      const session: MeetingSession = {
        id: 'session-profile-snap-test',
        title: 'React Interview',
        startedAt: 1770000000000,
        date: '10/05/2026, 09:00',
        durationMinutes: 45,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        profileSnapshot: { ...originalSnapshot },
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(session)

      // Simulate external mutable profile being modified / deleted
      const retrieved = getSavedSessions().find((s) => s.id === session.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.profileSnapshot?.name).toBe('React Expert v1')
      expect(retrieved?.profileSnapshot?.role).toBe('Frontend Lead')
      expect(retrieved?.profileSnapshot?.companyName).toBe('Acme Corp')
      expect(retrieved?.profileSnapshot?.keywords).toEqual(['React 19', 'Next.js 15', 'TailwindCSS'])
    })
  })

  // ── 4. Chronological Ordering of Transcripts & Async STT Handling ──────────
  describe('Chronological Transcript Ordering & Multi-interaction Correlation', () => {
    it('maintains strict chronological order even when STT finished out of sequence', () => {
      // Suppose STT segments were completed asynchronously:
      // chunk 3 (at 00:30) finished before chunk 2 (at 00:15)
      const outOfOrderTranscripts: HistoryTranscriptLine[] = [
        {
          id: 'chunk-3',
          speaker: 'Interviewer',
          timestamp: '00:30',
          timestampMs: 30000,
          original: 'Segment 3',
          translated: 'Đoạn 3',
        },
        {
          id: 'chunk-1',
          speaker: 'Candidate',
          timestamp: '00:05',
          timestampMs: 5000,
          original: 'Segment 1',
          translated: 'Đoạn 1',
        },
        {
          id: 'chunk-2',
          speaker: 'Interviewer',
          timestamp: '00:15',
          timestampMs: 15000,
          original: 'Segment 2',
          translated: 'Đoạn 2',
        },
      ]

      const session: MeetingSession = {
        id: 'session-chrono-test',
        title: 'Chrono Test Session',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 10,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: outOfOrderTranscripts,
        suggestions: [],
      }

      saveSessionToHistory(session)
      const saved = getSavedSessions().find((s) => s.id === session.id)
      expect(saved).toBeDefined()

      // The saved transcripts should be sorted chronologically
      expect(saved!.transcripts[0].id).toBe('chunk-1')
      expect(saved!.transcripts[1].id).toBe('chunk-2')
      expect(saved!.transcripts[2].id).toBe('chunk-3')
    })

    it('correlates AI suggestions and screenshot questions with respective timestamps', () => {
      const suggestions: HistorySuggestion[] = [
        {
          id: 1,
          type: 'answer',
          label: 'Trả lời #1',
          content: 'Answer content',
          timestamp: '01:10',
          timestampMs: 70000,
          triggeredByTranscriptId: 't-1',
        },
      ]

      const screenshots: HistoryScreenshotQuestion[] = [
        {
          id: 'sq-1',
          timestamp: '01:30',
          timestampMs: 90000,
          ocrText: 'def twoSum(nums, target):',
          analysisResult: {
            questionSummary: 'Two Sum Algorithm',
            suggestedAnswer: 'Use Hash Map in O(n) time',
            codeSnippet: 'def twoSum(nums, target):\n    seen = {}\n...',
          },
        },
      ]

      const session: MeetingSession = {
        id: 'session-multi-interaction',
        title: 'Algorithm Interview',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 30,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        transcripts: [
          {
            id: 't-1',
            speaker: 'Interviewer',
            timestamp: '01:00',
            timestampMs: 60000,
            original: 'Solve two sum',
            translated: 'Giải bài toán two sum',
            isQuestion: true,
          },
        ],
        suggestions,
        screenshotQuestions: screenshots,
      }

      saveSessionToHistory(session)
      const saved = getSavedSessions().find((s) => s.id === session.id)!
      expect(saved.metrics?.questionCount).toBe(2) // 1 verbal question + 1 screenshot question
      expect(saved.metrics?.aiResponseCount).toBe(1)
      expect(saved.metrics?.screenshotCount).toBe(1)
      expect(saved.metrics?.totalInteractions).toBe(3)
    })
  })

  // ── 5. Full-Text Search Across Rich Metadata ───────────────────────────────
  describe('Full-Text Search & Multi-Attribute Filtering', () => {
    beforeEach(() => {
      const s1: MeetingSession = {
        id: 'session-search-1',
        title: 'Kubernetes Cluster Architecture',
        companyName: 'Cloud Native VN',
        targetRole: 'DevOps Engineer',
        startedAt: Date.now() - 3600000 * 2, // 2 hours ago
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 45,
        mode: 'discussion',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        profileSnapshot: {
          presetId: 'profile-devops',
          name: 'DevOps Cloud',
          keywords: ['Kubernetes', 'Helm', 'Terraform', 'Prometheus'],
          snapshotAt: Date.now(),
        },
        transcripts: [
          {
            id: 1,
            speaker: 'Lead',
            timestamp: '05:00',
            original: 'We need to implement mutual TLS with Istio service mesh',
            translated: 'Cần triển khai mTLS với Istio service mesh',
          },
        ],
        suggestions: [
          {
            id: 1,
            type: 'option',
            content: 'Option A: Istio PeerAuthentication STRICT mode',
          },
        ],
      }

      const s2: MeetingSession = {
        id: 'session-search-2',
        title: 'Fullstack React TypeScript Interview',
        companyName: 'Fintech Asia',
        targetRole: 'Senior Frontend',
        startedAt: Date.now() - 86400000 * 10, // 10 days ago
        date: '10/10/2026, 10:00',
        durationMinutes: 60,
        mode: 'interview',
        aiModel: 'GPT-4o',
        audioSource: 'Default Mic',
        contextApplied: true,
        profileSnapshot: {
          presetId: 'profile-fe',
          name: 'Frontend React',
          keywords: ['React', 'Zustand', 'TypeScript', 'TailwindCSS'],
          snapshotAt: Date.now() - 86400000 * 10,
        },
        transcripts: [
          {
            id: 1,
            speaker: 'Interviewer',
            timestamp: '02:00',
            original: 'How do you handle race conditions in useEffect?',
            translated: 'Xử lý race condition trong useEffect thế nào?',
            isQuestion: true,
          },
        ],
        suggestions: [
          {
            id: 1,
            type: 'answer',
            content: 'Use an active flag or AbortController cleanup in useEffect',
          },
        ],
        screenshotQuestions: [
          {
            id: 'sq-fe-1',
            timestamp: '15:00',
            ocrText: 'const [state, setState] = useState(null)',
            analysisResult: {
              questionSummary: 'React Hook lifecycle bug',
              suggestedAnswer: 'Fix infinite loop',
            },
          },
        ],
      }

      saveSessionToHistory(s1)
      saveSessionToHistory(s2)
    })

    it('returns all sessions when search query is empty', () => {
      const results = searchAndFilterSessions({ searchTerm: '' })
      expect(results.length).toBe(2)
    })

    it('matches technical terms with case insensitivity (kUbErNeTeS / iStIo)', () => {
      const r1 = searchAndFilterSessions({ searchTerm: 'kUbErNeTeS' })
      expect(r1.length).toBe(1)
      expect(r1[0].id).toBe('session-search-1')

      const r2 = searchAndFilterSessions({ searchTerm: 'iStIo' })
      expect(r2.length).toBe(1)
      expect(r2[0].id).toBe('session-search-1')
    })

    it('matches transcript text and AI suggestions', () => {
      const rTranscript = searchAndFilterSessions({ searchTerm: 'AbortController' })
      expect(rTranscript.length).toBe(1)
      expect(rTranscript[0].id).toBe('session-search-2')

      const rSuggestion = searchAndFilterSessions({ searchTerm: 'PeerAuthentication' })
      expect(rSuggestion.length).toBe(1)
      expect(rSuggestion[0].id).toBe('session-search-1')
    })

    it('matches Vietnamese accents and phrases (Xử lý race condition)', () => {
      const rVN = searchAndFilterSessions({ searchTerm: 'Xử lý race condition' })
      expect(rVN.length).toBe(1)
      expect(rVN[0].id).toBe('session-search-2')
    })

    it('handles special characters safely without regex crash ($^*#%@)', () => {
      const rSpecial = searchAndFilterSessions({ searchTerm: '$^*#%@' })
      expect(rSpecial.length).toBe(0)
    })

    it('filters by mode (interview vs discussion)', () => {
      const interviews = searchAndFilterSessions({ mode: 'interview' })
      expect(interviews.length).toBe(1)
      expect(interviews[0].id).toBe('session-search-2')

      const discussions = searchAndFilterSessions({ mode: 'discussion' })
      expect(discussions.length).toBe(1)
      expect(discussions[0].id).toBe('session-search-1')
    })

    it('filters by date range (today vs last_7_days vs last_30_days)', () => {
      const today = searchAndFilterSessions({ dateRange: 'today' })
      expect(today.length).toBe(1)
      expect(today[0].id).toBe('session-search-1')

      const last30 = searchAndFilterSessions({ dateRange: 'last_30_days' })
      expect(last30.length).toBe(2)
    })

    it('filters by profile ID', () => {
      const rDevops = searchAndFilterSessions({ profileId: 'profile-devops' })
      expect(rDevops.length).toBe(1)
      expect(rDevops[0].id).toBe('session-search-1')

      const rFE = searchAndFilterSessions({ profileId: 'profile-fe' })
      expect(rFE.length).toBe(1)
      expect(rFE[0].id).toBe('session-search-2')
    })

    it('combines search term + mode + profile filter', () => {
      const matched = searchAndFilterSessions({
        searchTerm: 'React',
        mode: 'interview',
        profileId: 'profile-fe',
      })
      expect(matched.length).toBe(1)
      expect(matched[0].id).toBe('session-search-2')

      // Mismatched combination
      const mismatched = searchAndFilterSessions({
        searchTerm: 'React',
        mode: 'discussion', // s2 is interview
      })
      expect(mismatched.length).toBe(0)
    })
  })

  // ── 6. Lifecycle Operations: Rename, Delete, Bulk Delete, Retention ─────────
  describe('Session Lifecycle Operations (Rename, Delete, Bulk Delete, Retention)', () => {
    it('renames a specific session without modifying other records', () => {
      const s1: MeetingSession = {
        id: 's-rename-1',
        title: 'Original Title 1',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 15,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }
      const s2: MeetingSession = {
        id: 's-rename-2',
        title: 'Original Title 2',
        startedAt: Date.now() - 10000,
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 20,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(s1)
      saveSessionToHistory(s2)

      const updated = renameSessionInHistory('s-rename-1', 'Renamed Title 1')
      const target = updated.find((s) => s.id === 's-rename-1')
      const other = updated.find((s) => s.id === 's-rename-2')

      expect(target?.title).toBe('Renamed Title 1')
      expect(other?.title).toBe('Original Title 2')
    })

    it('deletes a single session cleanly', () => {
      const s1: MeetingSession = {
        id: 's-del-1',
        title: 'Session to Delete',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 10,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }
      const s2: MeetingSession = {
        id: 's-del-2',
        title: 'Session to Keep',
        startedAt: Date.now() - 1000,
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 10,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(s1)
      saveSessionToHistory(s2)

      const remaining = deleteSessionFromHistory('s-del-1')
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBe('s-del-2')
    })

    it('bulk deletes multiple selected sessions', () => {
      for (let i = 1; i <= 5; i++) {
        saveSessionToHistory({
          id: `s-bulk-${i}`,
          title: `Bulk Session ${i}`,
          startedAt: Date.now() - i * 1000,
          date: new Date().toLocaleString('vi-VN'),
          durationMinutes: 10,
          mode: 'interview',
          aiModel: 'Gemini 2.5 Flash',
          audioSource: 'Default Mic',
          contextApplied: false,
          transcripts: [],
          suggestions: [],
        })
      }

      expect(getSavedSessions().length).toBe(5)
      const afterBulk = deleteMultipleSessionsFromHistory(['s-bulk-2', 's-bulk-4'])
      expect(afterBulk.length).toBe(3)
      expect(afterBulk.map((s) => s.id)).toEqual(['s-bulk-1', 's-bulk-3', 's-bulk-5'])
    })

    it('prunes sessions older than retention days', () => {
      const recentSession: MeetingSession = {
        id: 's-retention-recent',
        title: 'Recent Session',
        startedAt: Date.now() - 86400000 * 2, // 2 days old
        date: '18/10/2026, 10:00',
        durationMinutes: 20,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      const expiredSession: MeetingSession = {
        id: 's-retention-expired',
        title: 'Expired Session',
        startedAt: Date.now() - 86400000 * 45, // 45 days old
        date: '01/09/2026, 10:00',
        durationMinutes: 20,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(recentSession)
      saveSessionToHistory(expiredSession)

      // Prune sessions older than 30 days
      const result = applySessionRetention(30)
      expect(result.deletedCount).toBe(1)
      expect(result.remainingSessions.length).toBe(1)
      expect(result.remainingSessions[0].id).toBe('s-retention-recent')
    })
  })

  // ── 7. Edge Cases: Large Transcripts, Zero Transcripts, Interrupted Meetings ─
  describe('Edge Cases (Zero transcripts, 1000+ transcripts, interrupted sessions)', () => {
    it('saves and handles sessions with zero transcripts safely', () => {
      const zeroSession: MeetingSession = {
        id: 's-zero-transcript',
        title: 'Empty Meeting',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 1,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: false,
        transcripts: [],
        suggestions: [],
      }

      saveSessionToHistory(zeroSession)
      const found = getSavedSessions().find((s) => s.id === zeroSession.id)
      expect(found).toBeDefined()
      expect(found?.transcripts.length).toBe(0)
      expect(found?.metrics?.totalInteractions).toBe(0)

      // Markdown generation should not crash on empty transcripts
      const md = generateSessionMarkdown(found!)
      expect(typeof md).toBe('string')
      expect(md).toContain('Empty Meeting')

      // Browser export functions should handle non-browser gracefully without error
      expect(() => exportSessionToMarkdown(found!)).not.toThrow()
    })

    it('handles very large transcripts (1000+ items) without performance degradation', () => {
      const largeTranscripts: HistoryTranscriptLine[] = []
      for (let i = 0; i < 1000; i++) {
        largeTranscripts.push({
          id: `line-${i}`,
          speaker: i % 2 === 0 ? 'Interviewer' : 'Candidate',
          timestamp: `${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}`,
          timestampMs: i * 1000,
          original: `Technical dialogue transcript statement number ${i}`,
          translated: `Bản dịch lời thoại kỹ thuật số ${i}`,
          isQuestion: i % 5 === 0,
        })
      }

      const largeSession: MeetingSession = {
        id: 's-large-transcript',
        title: '2-Hour Marathon Interview',
        startedAt: Date.now() - 7200000,
        endedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 120,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        transcripts: largeTranscripts,
        suggestions: [],
      }

      const start = performance.now()
      saveSessionToHistory(largeSession)
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(500) // Fast storage in <500ms

      const found = getSavedSessions().find((s) => s.id === largeSession.id)
      expect(found).toBeDefined()
      expect(found?.transcripts.length).toBe(1000)

      // Search inside 1000-line session
      const searched = searchAndFilterSessions({ searchTerm: 'statement number 999' })
      expect(searched.length).toBe(1)
      expect(searched[0].id).toBe('s-large-transcript')
    })
  })

  // ── 8. Token & Cost Exact Calculation ──────────────────────────────────────
  describe('Token and Cost Calculation Integrity', () => {
    it('exacts token count and estimated cost from aggregated suggestions', () => {
      const suggestions: HistorySuggestion[] = [
        {
          id: 1,
          type: 'answer',
          content: 'Answer 1',
          tokenUsage: {
            promptTokens: 500,
            completionTokens: 200,
            totalTokens: 700,
            estimatedCostUsd: 0.00035,
          },
        },
        {
          id: 2,
          type: 'answer',
          content: 'Answer 2',
          tokenUsage: {
            promptTokens: 400,
            completionTokens: 300,
            totalTokens: 700,
            estimatedCostUsd: 0.00045,
          },
        },
      ]

      const session: MeetingSession = {
        id: 's-token-test',
        title: 'Token Integrity Test',
        startedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 30,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Mic',
        contextApplied: true,
        transcripts: [],
        suggestions,
        metrics: {
          totalInteractions: 2,
          questionCount: 0,
          aiResponseCount: 2,
          screenshotCount: 0,
          totalTokens: 1400,
          inputTokens: 900,
          outputTokens: 500,
          estimatedCostUsd: 0.0008,
          costStatus: 'calculated',
        },
      }

      saveSessionToHistory(session)
      const saved = getSavedSessions().find((s) => s.id === session.id)!
      expect(saved.metrics?.totalTokens).toBe(1400)
      expect(saved.metrics?.estimatedCostUsd).toBe(0.0008)
      expect(saved.metrics?.costStatus).toBe('calculated')
    })
  })

  // ── 9. End-to-End Workflow Verification ────────────────────────────────────
  describe('End-to-End Workflow (Complete Meeting -> Save -> Search -> Detail -> Rename -> Delete)', () => {
    it('executes full user lifecycle without errors', () => {
      // Step 1: Complete Meeting & Save
      const meetingSession: MeetingSession = {
        id: 's-e2e-live-01',
        title: 'Final Round Engineering Manager',
        startedAt: Date.now() - 3600000,
        endedAt: Date.now(),
        date: new Date().toLocaleString('vi-VN'),
        durationMinutes: 60,
        durationSeconds: 3600,
        mode: 'interview',
        aiModel: 'Gemini 2.5 Flash',
        audioSource: 'Default Microphone',
        contextApplied: true,
        candidateName: 'Trần Văn B',
        companyName: 'Global Unicorn Inc',
        targetRole: 'Engineering Manager',
        profileSnapshot: {
          presetId: 'profile-em',
          name: 'EM Profile',
          role: 'Engineering Manager',
          companyName: 'Global Unicorn Inc',
          keywords: ['System Design', 'Leadership', 'Agile', 'Scale'],
          snapshotAt: Date.now() - 3600000,
        },
        transcripts: [
          {
            id: 't-101',
            speaker: 'Interviewer',
            timestamp: '00:10',
            timestampMs: 10000,
            original: 'How do you handle underperforming engineers in your team?',
            translated: 'Bạn xử lý như thế nào khi kỹ sư trong team không đạt hiệu suất?',
            isQuestion: true,
          },
        ],
        suggestions: [
          {
            id: 1,
            type: 'answer',
            content: 'I follow a structured PIP with clear weekly milestones and coaching...',
            confidence: 97,
            timestamp: '00:12',
            timestampMs: 12000,
            tokenUsage: {
              promptTokens: 150,
              completionTokens: 120,
              totalTokens: 270,
              estimatedCostUsd: 0.0002,
            },
          },
        ],
      }

      saveSessionToHistory(meetingSession)

      // Step 2: Open History & Verify List
      const historyList = getSavedSessions()
      expect(historyList.length).toBe(1)
      expect(historyList[0].id).toBe('s-e2e-live-01')

      // Step 3: Search
      const searchRes = searchAndFilterSessions({ searchTerm: 'underperforming' })
      expect(searchRes.length).toBe(1)
      expect(searchRes[0].id).toBe('s-e2e-live-01')

      // Step 4: Open Session & Verify Data
      const detailSession = searchRes[0]
      expect(detailSession.candidateName).toBe('Trần Văn B')
      expect(detailSession.profileSnapshot?.role).toBe('Engineering Manager')
      expect(detailSession.transcripts[0].original).toContain('underperforming engineers')
      expect(detailSession.suggestions[0].content).toContain('structured PIP')

      // Step 5: Rename Session
      const renamedList = renameSessionInHistory('s-e2e-live-01', 'Final Round EM - Passed')
      expect(renamedList.find((s) => s.id === 's-e2e-live-01')?.title).toBe('Final Round EM - Passed')

      // Step 6: Delete Session
      const finalList = deleteSessionFromHistory('s-e2e-live-01')
      expect(finalList.length).toBe(0)
    })
  })
})
