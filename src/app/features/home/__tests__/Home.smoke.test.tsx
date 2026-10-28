import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { render, act } from '@testing-library/react'
import { Home } from '../Home'

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
    },
    usage: {
      getAll: mock(async () => []),
      append: mock(async () => ({ success: true })),
    },
  }
}

describe('Home Screen Smoke Test', () => {
  it('renders complete Home dashboard without crashing', async () => {
    const onViewChange = mock(() => {})
    const onModeChange = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <Home
          mode="interview"
          onViewChange={onViewChange}
          onModeChange={onModeChange}
        />
      )
    })

    expect(result.container).toBeDefined()

    // Key interactive elements should exist
    expect(result.getByText('Hồ Sơ & CV')).toBeDefined()
    expect(result.getByText('Thiết Bị Âm Thanh')).toBeDefined()
    expect(result.getByText('Trạng Thái Hệ Thống')).toBeDefined()
    expect(result.getByText('Lịch Sử Gần Đây')).toBeDefined()
    expect(result.getByText('Vào Meeting Mode')).toBeDefined()
  })

  it('renders discussion mode cleanly', async () => {
    const onViewChange = mock(() => {})
    const onModeChange = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <Home
          mode="discussion"
          onViewChange={onViewChange}
          onModeChange={onModeChange}
        />
      )
    })

    expect(result.getByText('Chủ Đề Thảo Luận')).toBeDefined()
  })
})
