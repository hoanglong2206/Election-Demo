import '@/test/setupDom'
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { formatDiscussionTitleSnippet } from '../hooks/useMeetingSession'
import { formatDiscussionContextSnippet } from '../components/shell/MeetingHeader'
import {
  LocalStorageMeetingContextRepository,
  type MeetingContextData,
} from '@/services/meeting-context'

describe('Discussion Context Snippet & Title Formatting', () => {
  it('formats short discussion title cleanly', () => {
    expect(formatDiscussionTitleSnippet('youtube')).toBe('youtube')
  })

  it('removes "Chủ đề:" prefix and limits title to 40 characters', () => {
    const topic = 'Chủ đề: Tối ưu kiến trúc Caching và giảm tải Database cho sự kiện Mega Sale'
    const formatted = formatDiscussionTitleSnippet(topic, 40)
    expect(formatted.startsWith('Tối ưu kiến trúc')).toBe(true)
    expect(formatted.includes('Chủ đề:')).toBe(false)
    expect(formatted.length).toBeLessThanOrEqual(43) // 40 chars + '...'
  })

  it('handles multiline discussion input by picking first line and stripping prefix', () => {
    const multiline = `Chủ đề thảo luận: Thiết kế kiến trúc Microservices
Ngữ cảnh & Vấn đề hiện tại:
- Hệ thống bị nghẽn cổ chai tại database
- Độ trễ p99 vượt quá 500ms`
    const formatted = formatDiscussionTitleSnippet(multiline, 40)
    expect(formatted).toBe('Thiết kế kiến trúc Microservices')
  })

  it('formats sub-bar snippet with max 60 characters and cleans prefix', () => {
    const raw = `Chủ đề: Tối ưu kiến trúc Caching và giảm tải Database cho sự kiện Mega Sale
Ngữ cảnh & Vấn đề hiện tại:
- Cụm Redis Cluster hiện tại chạm ngưỡng 85% CPU`

    const snippet = formatDiscussionContextSnippet(raw, 60)
    expect(snippet.includes('Redis')).toBe(false)
    expect(snippet.includes('Chủ đề:')).toBe(false)
    expect(snippet.length).toBeLessThanOrEqual(63)
    expect(snippet.endsWith('...')).toBe(true)
    expect(snippet.startsWith('Tối ưu kiến trúc Caching')).toBe(true)
  })

  it('returns default fallback when discussion topic is empty or whitespace', () => {
    expect(formatDiscussionContextSnippet('')).toBe('Chủ đề thảo luận')
    expect(formatDiscussionContextSnippet('   ')).toBe('Chủ đề thảo luận')
    expect(formatDiscussionTitleSnippet('')).toBe('')
  })
})

describe('MeetingContextRepository Event Dispatch', () => {
  let repo: LocalStorageMeetingContextRepository

  beforeEach(() => {
    repo = new LocalStorageMeetingContextRepository()
    repo.clear()
  })

  it('dispatches meeting-context-updated event with payload upon save', () => {
    let capturedDetail: MeetingContextData | null = null
    const listener = (event: Event) => {
      capturedDetail = (event as CustomEvent<MeetingContextData>).detail
    }

    window.addEventListener('meeting-context-updated', listener)

    const payload: MeetingContextData = {
      jobDescription: '',
      cvSummary: '',
      discussionTopic: 'youtube',
      keywords: [],
      discussionKeywords: ['youtube', 'streaming'],
    }

    repo.save(payload)

    expect(capturedDetail).not.toBeNull()
    expect((capturedDetail as any).discussionTopic).toBe('youtube')
    window.removeEventListener('meeting-context-updated', listener)
  })
})
