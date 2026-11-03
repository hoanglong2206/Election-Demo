import { ensureDomEnvironment } from '@/test/setupDom'
import { describe, expect, it, mock, afterEach, beforeEach } from 'bun:test'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { createRef } from 'react'
import { LiveTranscriptPane } from '../LiveTranscriptPane'
import { TranscriptLineItem } from '../TranscriptLineItem'
import { HighlightText } from '../HighlightText'
import type { TranscriptLine } from '../../../types'

function createMockLines(count: number): TranscriptLine[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    speaker: i % 2 === 0 ? 'Interviewer' : 'You',
    timestamp: `10:0${Math.floor(i / 10)}:${(i % 10) * 6}`,
    original: `This is speech utterance number ${i + 1} discussing system architecture.`,
    translated: `Đây là câu phát biểu số ${i + 1} thảo luận về kiến trúc hệ thống.`,
  }))
}

describe('LiveTranscriptPane Component & Virtualization (Plan 4)', () => {
  beforeEach(() => {
    ensureDomEnvironment()
  })

  afterEach(() => {
    cleanup()
  })

  const baseProps = {
    sourceType: 'system' as const,
    onSwitchSource: mock(() => {}),
    validLines: [] as TranscriptLine[],
    latestLine: null,
    isCapturing: false,
    isListening: false,
    isTranscribing: false,
    onClearTranscript: mock(() => {}),
    onToggleListening: mock(() => {}),
    scrollRef: createRef<HTMLDivElement>(),
    sttEngineLabel: 'Whisper Base C++',
    mode: 'interview' as const,
    meetingSummary: null,
    isSummarizing: false,
    copiedSummary: false,
    onCopySummary: mock(() => {}),
    onGenerateSummary: mock(() => {}),
  }

  it('renders initial empty state when not capturing and transcript is empty', async () => {
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} />)
    })

    expect(result.getByText('Chưa bắt đầu thu âm cuộc họp')).toBeDefined()
    expect(result.getByText('Bắt đầu thu âm cuộc họp')).toBeDefined()
  })

  it('renders capturing pulse state when isCapturing is true and no lines yet', async () => {
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} isCapturing={true} isListening={true} />)
    })

    expect(result.getByText('Đang lắng nghe âm thanh cuộc họp...')).toBeDefined()
  })

  it('renders transcript lines with speaker and original text', async () => {
    const lines = createMockLines(3)
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} validLines={lines} />)
    })

    expect(result.getByText('This is speech utterance number 1 discussing system architecture.')).toBeDefined()
    expect(result.getByText('Đây là câu phát biểu số 1 thảo luận về kiến trúc hệ thống.')).toBeDefined()
    expect(result.getByText('This is speech utterance number 2 discussing system architecture.')).toBeDefined()
  })

  it('applies sliding window virtualization for long meetings (> 50 lines)', async () => {
    const lines = createMockLines(120)
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} validLines={lines} />)
    })

    expect(result.getByText(/đã ẩn/)).toBeDefined()
    expect(result.getByText('+ 50 câu')).toBeDefined()
    expect(result.getByText('Tất cả (120)')).toBeDefined()

    expect(result.queryByText('This is speech utterance number 1 discussing system architecture.')).toBeNull()
    expect(result.getByText('This is speech utterance number 120 discussing system architecture.')).toBeDefined()
  })

  it('expands window by 50 when clicking "+ 50 câu"', async () => {
    const lines = createMockLines(120)
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} validLines={lines} />)
    })

    const expand50Btn = result.getByText('+ 50 câu')
    await act(async () => {
      fireEvent.click(expand50Btn)
    })

    // Line 50 should now be rendered (window expanded to 100)
    expect(result.getByText('This is speech utterance number 50 discussing system architecture.')).toBeDefined()
  })

  it('expands full transcript when clicking "Tất cả"', async () => {
    const lines = createMockLines(80)
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} validLines={lines} />)
    })

    const allBtn = result.getByText('Tất cả (80)')
    await act(async () => {
      fireEvent.click(allBtn)
    })

    expect(result.getByText('Bật tối ưu (50 câu)')).toBeDefined()
    expect(result.getByText('This is speech utterance number 1 discussing system architecture.')).toBeDefined()

    await act(async () => {
      fireEvent.click(result.getByText('Bật tối ưu (50 câu)'))
    })
    expect(result.queryByText('This is speech utterance number 1 discussing system architecture.')).toBeNull()
  })

  it('opens and closes search bar cleanly via search toggle button', async () => {
    const lines = createMockLines(3)
    let result: any
    await act(async () => {
      result = render(<LiveTranscriptPane {...baseProps} validLines={lines} />)
    })

    const searchToggleBtn = result.getByTitle('Tìm kiếm từ khóa trong transcript')
    await act(async () => {
      fireEvent.click(searchToggleBtn)
    })

    // Search bar is open
    expect(result.getByPlaceholderText('Tìm kiếm nội dung hội thoại...')).toBeDefined()

    // Close search
    const closeBtn = result.getByTitle('Đóng tìm kiếm')
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    expect(result.queryByPlaceholderText('Tìm kiếm nội dung hội thoại...')).toBeNull()
  })

  it('TranscriptLineItem renders correctly and handles copy callbacks', async () => {
    const line: TranscriptLine = {
      id: 99,
      speaker: 'Interviewer',
      timestamp: '11:20:00',
      original: 'How does Kafka achieve high throughput with sequential I/O?',
      translated: 'Kafka đạt throughput cao như thế nào với sequential I/O?',
    }
    const onCopy = mock(() => {})

    let result: any
    await act(async () => {
      result = render(
        <TranscriptLineItem
          line={line}
          isLatest={true}
          isMatched={true}
          isCopied={false}
          searchQuery="Kafka"
          onCopy={onCopy}
        />
      )
    })

    expect(result.getByText('Interviewer')).toBeDefined()
    expect(result.getByText('11:20:00')).toBeDefined()

    const copyBtn = result.getByTitle('Sao chép câu thoại')
    await act(async () => {
      fireEvent.click(copyBtn)
    })
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('HighlightText wraps matching query with mark element', async () => {
    let result: any
    await act(async () => {
      result = render(<HighlightText text="Kubernetes cluster orchestration" query="cluster" />)
    })

    const mark = result.container.querySelector('mark')
    expect(mark).toBeDefined()
    expect(mark?.textContent).toBe('cluster')
  })
})
