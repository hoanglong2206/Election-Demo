import '@/test/setupDom'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useSessionRecovery, type RecoveredSessionData } from '../useSessionRecovery'
import { transcriptStore } from '../../controllers/transcriptStore'
import { sessionsPort } from '@/infrastructure/ipc'

describe('useSessionRecovery Hook', () => {
  const mockRecoveryList = mock(async () => [] as any[])
  const mockRecoveryComplete = mock(async () => true)

  beforeEach(() => {
    transcriptStore.clear()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()

    sessionsPort.recovery.list = mockRecoveryList as any
    sessionsPort.recovery.complete = mockRecoveryComplete as any
  })

  afterEach(() => {
    transcriptStore.clear()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  })

  it('restores previous session title, discussion topic, and transcripts upon handleRestoreRecovery', async () => {
    const mockUnfinished = {
      sessionId: 'crashed_session_123',
      lifecycle: 'recovering',
      updatedAt: Date.now() - 5000,
      snapshot: {
        id: 'crashed_session_123',
        title: 'Thảo luận: Bàn về kiến trúc SQL Server và Entity Framework',
        mode: 'discussion',
        startedAt: 1700000000000,
        discussionTopic: 'Bàn về kiến trúc SQL Server và Entity Framework',
        transcripts: [
          {
            id: 1,
            original: 'Hello team, welcome to the SQL architecture review.',
            translated: 'Chào cả đội, chào mừng đến buổi đánh giá kiến trúc SQL.',
            speaker: 'Cuộc họp',
            timestamp: '00:01',
          },
        ],
      },
      eventCount: 3,
    }

    mockRecoveryList.mockImplementation(async () => [mockUnfinished])

    let restoredData: any = null
    const onSessionRestored = mock((data: RecoveredSessionData) => {
      restoredData = data
    })

    const { result } = renderHook(() =>
      useSessionRecovery({
        sessionId: 'current_active_session_999',
        sessionTitle: 'Thảo luận: Chủ đề mới nhập tạm bợ',
        mode: 'discussion',
        meetingStartTime: Date.now(),
        validLines: [],
        visualQuestionsHistory: [],
        discussionTopic: 'Chủ đề mới nhập tạm bợ',
        onSessionRestored,
      })
    )

    // Allow async initial scan to finish
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.unfinishedRecovery).toBeDefined()
    expect(result.current.unfinishedRecovery.sessionId).toBe('crashed_session_123')

    // User clicks Khôi phục
    await act(async () => {
      result.current.handleRestoreRecovery()
    })

    // Verify transcriptStore restored
    expect(transcriptStore.getSnapshot().length).toBe(1)
    expect(transcriptStore.getSnapshot()[0].original).toBe(
      'Hello team, welcome to the SQL architecture review.'
    )

    // Verify onSessionRestored received the CRASHED session data, NOT the newly entered temporary title/topic
    expect(onSessionRestored).toHaveBeenCalledTimes(1)
    expect(restoredData).not.toBeNull()
    expect(restoredData?.sessionId).toBe('crashed_session_123')
    expect(restoredData?.title).toBe(
      'Thảo luận: Bàn về kiến trúc SQL Server và Entity Framework'
    )
    expect(restoredData?.discussionTopic).toBe(
      'Bàn về kiến trúc SQL Server và Entity Framework'
    )
    expect(restoredData?.mode).toBe('discussion')
    expect(restoredData?.startedAt).toBe(1700000000000)

    // Verify completed call
    expect(mockRecoveryComplete).toHaveBeenCalledWith('crashed_session_123', 'completed')
  })

  it('extracts discussion topic from title prefix fallback when discussionTopic was not explicitly saved in old snapshots', async () => {
    const mockLegacyUnfinished = {
      sessionId: 'legacy_crashed_456',
      snapshot: {
        id: 'legacy_crashed_456',
        title: 'Thảo luận: Tối ưu hiệu năng Database Microservices',
        mode: 'discussion',
        transcripts: [],
      },
    }

    mockRecoveryList.mockImplementation(async () => [mockLegacyUnfinished])

    let restoredData: any = null
    const onSessionRestored = mock((data: RecoveredSessionData) => {
      restoredData = data
    })

    const { result } = renderHook(() =>
      useSessionRecovery({
        sessionId: 'current_active_session_888',
        sessionTitle: 'Thảo luận: Tạm bợ',
        mode: 'discussion',
        meetingStartTime: Date.now(),
        validLines: [],
        visualQuestionsHistory: [],
        discussionTopic: 'Tạm bợ',
        onSessionRestored,
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      result.current.handleRestoreRecovery()
    })

    expect(restoredData?.discussionTopic).toBe('Tối ưu hiệu năng Database Microservices')
  })

  it('auto-restores immediately on mount when pending_session_restore is present in sessionStorage', async () => {
    sessionStorage.setItem('pending_session_restore', 'crashed_auto_789')

    const mockUnfinished = {
      sessionId: 'crashed_auto_789',
      snapshot: {
        id: 'crashed_auto_789',
        title: 'Phỏng vấn Kỹ thuật (Senior Frontend)',
        mode: 'interview',
        transcripts: [
          {
            id: 10,
            original: 'Can you explain the Virtual DOM?',
            translated: 'Bạn có thể giải thích Virtual DOM không?',
            speaker: 'Interviewer',
            timestamp: '00:05',
          },
        ],
      },
    }

    mockRecoveryList.mockImplementation(async () => [mockUnfinished])

    let restoredData: any = null
    const onSessionRestored = mock((data: RecoveredSessionData) => {
      restoredData = data
    })

    renderHook(() =>
      useSessionRecovery({
        sessionId: 'temp_active_session',
        sessionTitle: 'Cuộc họp Live Copilot',
        mode: 'interview',
        meetingStartTime: Date.now(),
        validLines: [],
        visualQuestionsHistory: [],
        onSessionRestored,
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Should auto-restore without calling handleRestoreRecovery manually
    expect(onSessionRestored).toHaveBeenCalledTimes(1)
    expect(restoredData?.sessionId).toBe('crashed_auto_789')
    expect(restoredData?.title).toBe('Phỏng vấn Kỹ thuật (Senior Frontend)')
    expect(restoredData?.mode).toBe('interview')
    expect(transcriptStore.getSnapshot().length).toBe(1)
    expect(sessionStorage.getItem('pending_session_restore')).toBeNull()
  })
})
