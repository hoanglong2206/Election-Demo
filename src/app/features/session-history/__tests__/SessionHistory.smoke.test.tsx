import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { SessionHistory } from '../SessionHistory'
import {
  saveSessionToHistory,
  clearAllSessionsFromHistory,
  type MeetingSession,
} from '@/services/session-history'

const mockSessions: MeetingSession[] = [
  {
    id: 'sess-alpha',
    title: 'Senior Frontend Tech Lead Interview',
    date: '2026-10-28 09:30:00',
    durationMinutes: 45,
    mode: 'interview',
    aiModel: 'gemini-1.5-pro',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [
      {
        id: 1,
        timestamp: '00:05',
        speaker: 'Interviewer',
        original: 'Can you describe your experience with React Architecture?',
        translated: 'Bạn có thể mô tả kinh nghiệm kiến trúc React không?',
        isQuestion: true,
      },
    ],
    suggestions: [
      {
        id: 'sug-alpha',
        timestamp: '00:05',
        type: 'answer',
        content: 'Highlight clean architecture, state management and domain boundary separation.',
        confidence: 98,
      },
    ],
    screenshotQuestions: [
      {
        id: 'shot-alpha',
        timestamp: '00:15',
        contentType: 'coding',
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        ocrText: 'function twoSum(nums, target) { return [] }',
      },
    ],
    _isFullyLoaded: true,
  },
  {
    id: 'sess-beta',
    title: 'Distributed Consensus Discussion',
    date: '2026-10-28 11:00:00',
    durationMinutes: 30,
    mode: 'discussion',
    aiModel: 'gpt-4o',
    audioSource: 'microphone',
    contextApplied: false,
    transcripts: [
      {
        id: 2,
        timestamp: '00:02',
        speaker: 'Cuộc họp',
        original: 'We need to discuss Raft consensus log compaction.',
        translated: 'Chúng ta cần thảo luận nén log đồng thuận Raft.',
      },
    ],
    suggestions: [],
    _isFullyLoaded: true,
  },
]

// Ensure mock window.api returns mockSessions
if (typeof window !== 'undefined') {
  ;(window as any).api = {
    credentials: {
      hasKey: mock(async () => true),
      getKey: mock(async () => 'mock-key'),
    },
    sessions: {
      getAll: mock(async () => mockSessions),
      save: mock(async () => ({ success: true })),
      delete: mock(async () => ({ success: true })),
      deleteAll: mock(async () => true),
      deleteMany: mock(async () => true),
      rename: mock(async () => true),
      loadFull: mock(async (id: string) => mockSessions.find((s) => s.id === id) || null),
    },
  }
}

describe('SessionHistory Screen Smoke Tests', () => {
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

  it('renders SessionHistory header, session cards and detail view', async () => {
    let result: any
    await act(async () => {
      result = render(<SessionHistory />)
    })

    // Check header title
    expect(result.getByText(/Lịch Sử Cuộc Họp & Phỏng Vấn/i)).toBeDefined()

    // Title appears in sidebar and detail header (sess-beta is latest at 11:00)
    expect(result.getAllByText('Distributed Consensus Discussion').length).toBeGreaterThanOrEqual(1)
    expect(result.getAllByText('Senior Frontend Tech Lead Interview').length).toBeGreaterThanOrEqual(1)

    // Check detail view badge for default latest session (sess-beta is Discussion)
    expect(result.getByText('Chế độ Thảo Luận')).toBeDefined()
  })

  it('switches selected session when clicking a sidebar card', async () => {
    let result: any
    await act(async () => {
      result = render(<SessionHistory />)
    })

    // Click sess-alpha (Senior Frontend Interview)
    const alphaCards = result.getAllByText('Senior Frontend Tech Lead Interview')
    await act(async () => {
      fireEvent.click(alphaCards[0])
    })

    // Detail view should now display Interview mode badge
    expect(result.getByText('Chế độ Phỏng Vấn')).toBeDefined()
  })

  it('filters sessions using mode filter pills', async () => {
    let result: any
    await act(async () => {
      result = render(<SessionHistory />)
    })

    // Click Discussion pill to filter only discussion sessions
    const discButton = result.getByRole('button', { name: 'Discussion' })
    await act(async () => {
      fireEvent.click(discButton)
    })

    // Distributed Consensus Discussion remains in sidebar
    expect(result.getAllByText('Distributed Consensus Discussion').length).toBeGreaterThanOrEqual(1)
    // Senior Frontend Interview is filtered out from sidebar cards
    expect(result.queryByText('Senior Frontend Tech Lead Interview')).toBeNull()
  })

  it('navigates detail view tabs: timeline, transcript, suggestions, screenshots, split', async () => {
    let result: any
    await act(async () => {
      result = render(<SessionHistory />)
    })

    // Switch to sess-alpha first so we have transcripts, suggestions and screenshots
    const alphaCards = result.getAllByText('Senior Frontend Tech Lead Interview')
    await act(async () => {
      fireEvent.click(alphaCards[0])
    })

    // Switch to Transcript tab
    const transcriptTabBtn = result.getByText('2. Lời Thoại')
    await act(async () => {
      fireEvent.click(transcriptTabBtn)
    })
    expect(result.getByText(/Can you describe your experience with React Architecture/i)).toBeDefined()

    // Switch to Suggestions tab
    const suggestionsTabBtn = result.getByText('3. Gợi Ý AI')
    await act(async () => {
      fireEvent.click(suggestionsTabBtn)
    })
    expect(result.getByText(/Highlight clean architecture/i)).toBeDefined()

    // Switch to Screenshots tab
    const screenshotsTabBtn = result.getByText(/4. Ảnh Màn Hình/i)
    await act(async () => {
      fireEvent.click(screenshotsTabBtn)
    })
    expect(result.getByText(/twoSum/i)).toBeDefined()

    // Switch to Split tab
    const splitTabBtn = result.getByText('5. Chia Đôi (50:50)')
    await act(async () => {
      fireEvent.click(splitTabBtn)
    })
    expect(result.getByText(/Lời Thoại \(1\)/i)).toBeDefined()
  })

  it('opens and cancels clear all confirmation dialog', async () => {
    let result: any
    await act(async () => {
      result = render(<SessionHistory />)
    })

    const clearAllBtn = result.getByText('Xóa tất cả')
    await act(async () => {
      fireEvent.click(clearAllBtn)
    })

    // Confirm dialog title
    expect(result.getByText('Xóa toàn bộ lịch sử cuộc họp?')).toBeDefined()

    // Cancel deletion
    const cancelBtn = result.getByText('Giữ lại')
    await act(async () => {
      fireEvent.click(cancelBtn)
    })

    // Dialog closes, sessions remain
    expect(result.queryByText('Xóa toàn bộ lịch sử cuộc họp?')).toBeNull()
    expect(result.getAllByText('Senior Frontend Tech Lead Interview').length).toBeGreaterThanOrEqual(1)
  })
})
