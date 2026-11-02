import '@/test/setupDom'
import { describe, it, expect, mock, afterEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { SessionHeader } from '../SessionHeader'
import type { MeetingSession } from '@/services/session-history'

const mockSession: MeetingSession = {
  id: 'sess-test-1',
  title: 'Cuộc họp Thảo luận Live',
  date: '2026-11-02 12:44:00',
  durationMinutes: 15,
  mode: 'discussion',
  aiModel: 'gemini-3-flash-preview',
  audioSource: 'system',
  contextApplied: false,
  transcripts: [],
  suggestions: [],
  screenshotQuestions: [],
  _isFullyLoaded: true,
}

describe('SessionHeader Export Dropdown', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders export dropdown button when currentSession is present', async () => {
    let result: any
    await act(async () => {
      result = render(
        <SessionHeader
          totalSessions={1}
          currentSession={mockSession}
        />
      )
    })

    const exportBtn = result.getByRole('button', { name: /Xuất báo cáo/i })
    expect(exportBtn).toBeDefined()
  })

  it('opens export menu when clicking trigger and displays 3 format options', async () => {
    let result: any
    await act(async () => {
      result = render(
        <SessionHeader
          totalSessions={1}
          currentSession={mockSession}
        />
      )
    })

    const exportBtn = result.getByRole('button', { name: /Xuất báo cáo/i })
    await act(async () => {
      fireEvent.click(exportBtn)
    })

    expect(result.getByText(/Định dạng xuất file/i)).toBeDefined()
    expect(result.getByText(/Xuất file PDF/i)).toBeDefined()
    expect(result.getByText(/Xuất Markdown/i)).toBeDefined()
    expect(result.getByText(/Xuất JSON/i)).toBeDefined()
  })

  it('triggers PDF export and closes dropdown when PDF option clicked', async () => {
    const originalOpen = window.open
    const dummyWindow = {
      document: {
        write: mock(() => {}),
        close: mock(() => {}),
      },
      focus: mock(() => {}),
      print: mock(() => {}),
    }
    const openMock = mock(() => dummyWindow)
    window.open = openMock as any

    try {
      let result: any
      await act(async () => {
        result = render(
          <SessionHeader
            totalSessions={1}
            currentSession={mockSession}
          />
        )
      })

      const exportBtn = result.getByRole('button', { name: /Xuất báo cáo/i })
      await act(async () => {
        fireEvent.click(exportBtn)
      })

      const pdfBtn = result.getByText(/Xuất file PDF/i)
      await act(async () => {
        fireEvent.click(pdfBtn)
      })

      expect(openMock).toHaveBeenCalled()
      expect(result.queryByText(/Định dạng xuất file/i)).toBeNull()
    } finally {
      window.open = originalOpen
    }
  })

  it('closes dropdown when clicking outside', async () => {
    let result: any
    await act(async () => {
      result = render(
        <div>
          <div data-testid="outside">Outside area</div>
          <SessionHeader
            totalSessions={1}
            currentSession={mockSession}
          />
        </div>
      )
    })

    const exportBtn = result.getByRole('button', { name: /Xuất báo cáo/i })
    await act(async () => {
      fireEvent.click(exportBtn)
    })

    expect(result.getByText(/Định dạng xuất file/i)).toBeDefined()

    const outside = result.getByTestId('outside')
    await act(async () => {
      fireEvent.mouseDown(outside)
    })

    expect(result.queryByText(/Định dạng xuất file/i)).toBeNull()
  })
})
