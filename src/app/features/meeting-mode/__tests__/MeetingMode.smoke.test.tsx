import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { render, act } from '@testing-library/react'
import { MeetingMode } from '../MeetingMode'

// Mock minimal window.api if accessed by lower layers
if (typeof window !== 'undefined') {
  ;(window as any).api = {
    credentials: {
      hasKey: mock(async () => true),
      getKey: mock(async () => 'mock-key'),
    },
    sessions: {
      getAll: mock(async () => []),
      save: mock(async () => ({ success: true })),
      recovery: {
        list: mock(async () => []),
        append: mock(async () => true),
        checkpoint: mock(async () => true),
        complete: mock(async () => true),
        flush: mock(async () => true),
      },
    },
    usage: {
      getAll: mock(async () => []),
      append: mock(async () => ({ success: true })),
    },
    nativeWhisper: {
      prewarm: mock(async () => true),
      healthCheck: mock(async () => ({ healthy: true })),
    },
    getDesktopSources: mock(async () => [{ id: 'win-1', name: 'VSCode' }]),
  }
}

describe('MeetingMode Container Smoke Test', () => {
  it('renders MissingContextGuard in interview mode when CV/JD are empty', async () => {
    // Clear storage
    localStorage.removeItem('meeting_context')

    let result: any
    await act(async () => {
      result = render(<MeetingMode mode="interview" onViewChange={() => {}} />)
    })

    expect(result.container).toBeDefined()
    expect(result.getByText('Yêu Cầu Nạp Đầy Đủ CV & JD')).toBeDefined()
    expect(result.getByText('Về Trang Chủ để Bổ Sung')).toBeDefined()
  })

  it('renders full discussion dashboard cleanly when discussion topic is loaded', async () => {
    localStorage.setItem(
      'meeting_context',
      JSON.stringify({
        discussionTopic: 'Kiến trúc Redis Cluster và Kafka',
      })
    )

    let result: any
    await act(async () => {
      result = render(<MeetingMode mode="discussion" onViewChange={() => {}} />)
    })

    expect(result.container).toBeDefined()
    expect(result.getByText('Bắt đầu nghe')).toBeDefined()
    expect(result.getByText('AI Meeting Copilot')).toBeDefined()
  })
})
