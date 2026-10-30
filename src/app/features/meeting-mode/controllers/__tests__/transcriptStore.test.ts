import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { TranscriptStore } from '../transcriptStore'

describe('TranscriptStore Controller', () => {
  let store: TranscriptStore

  beforeEach(() => {
    store = new TranscriptStore()
  })

  it('starts with empty transcript', () => {
    expect(store.getSnapshot()).toEqual([])
    expect(store.getValidLines()).toEqual([])
    expect(store.getLatestLine()).toBeNull()
  })

  it('commits first line and notifies listeners', () => {
    const listener = mock(() => {})
    const unsub = store.subscribe(listener)

    const result = store.commitSegment({
      result: { success: true, text: 'Xin chào các bạn' },
      speakerLabel: 'Interviewer',
      timestampStr: '01:05',
    })

    expect(result).not.toBeNull()
    expect(result?.isNew).toBe(true)
    expect(result?.textToTranslate).toBe('Xin chào các bạn')

    const lines = store.getValidLines()
    expect(lines.length).toBe(1)
    expect(lines[0].original).toBe('Xin chào các bạn')
    expect(lines[0].speaker).toBe('Interviewer')
    expect(listener).toHaveBeenCalledTimes(1)

    unsub()
  })

  it('stitches continuation fragments seamlessly when continuation=true', () => {
    store.commitSegment({
      result: { success: true, text: 'Hôm nay chúng ta' },
      speakerLabel: 'Interviewer',
      timestampStr: '00:01',
    })

    const continuationResult = store.commitSegment({
      result: { success: true, text: 'sẽ thảo luận về Redis cluster.' },
      speakerLabel: 'Interviewer',
      timestampStr: '00:03',
      continuation: true,
    })

    expect(continuationResult).not.toBeNull()
    expect(continuationResult?.isNew).toBe(false)
    expect(continuationResult?.textToTranslate).toContain('Hôm nay chúng ta sẽ thảo luận về Redis cluster.')

    const lines = store.getValidLines()
    expect(lines.length).toBe(1)
    expect(lines[0].original).toBe('Hôm nay chúng ta sẽ thảo luận về Redis cluster.')
  })

  it('does NOT stitch if previous line ended with a full sentence (. ? !)', () => {
    store.commitSegment({
      result: { success: true, text: 'Hôm nay chúng ta sẽ thảo luận về Redis cluster.' },
      speakerLabel: 'Interviewer',
      timestampStr: '00:01',
    })

    const nextResult = store.commitSegment({
      result: { success: true, text: 'Các bạn đã chuẩn bị tài liệu chưa?' },
      speakerLabel: 'Interviewer',
      timestampStr: '00:05',
      continuation: true,
    })

    expect(nextResult?.isNew).toBe(true)
    expect(store.getValidLines().length).toBe(2)
    expect(store.getValidLines()[0].original).toBe('Hôm nay chúng ta sẽ thảo luận về Redis cluster.')
    expect(store.getValidLines()[1].original).toBe('Các bạn đã chuẩn bị tài liệu chưa?')
  })

  it('does NOT stitch if previous line is already longer than 130 characters', () => {
    store.commitSegment({
      result: {
        success: true,
        text: 'Chúng tôi đang triển khai hệ thống kiến trúc phân tán với rất nhiều node backend và cơ chế caching nhiều tầng nhằm đạt throughput tối đa',
      },
      speakerLabel: 'Interviewer',
      timestampStr: '00:01',
    })

    const nextResult = store.commitSegment({
      result: { success: true, text: 'đồng thời kiểm soát chặt chẽ độ trễ' },
      speakerLabel: 'Interviewer',
      timestampStr: '00:06',
      continuation: true,
    })

    expect(nextResult?.isNew).toBe(true)
    expect(store.getValidLines().length).toBe(2)
  })

  it('does NOT stitch if speaker changes even if continuation=true', () => {
    store.commitSegment({
      result: { success: true, text: 'Bạn có câu hỏi gì không?' },
      speakerLabel: 'Interviewer',
    })

    const result = store.commitSegment({
      result: { success: true, text: 'Dạ tôi có.' },
      speakerLabel: 'You',
      continuation: true,
    })

    expect(result?.isNew).toBe(true)
    expect(store.getValidLines().length).toBe(2)
  })

  it('suppresses exact duplicate transcript text', () => {
    store.commitSegment({
      result: { success: true, text: 'Hello world' },
      speakerLabel: 'Speaker',
    })

    const dupResult = store.commitSegment({
      result: { success: true, text: 'hello world' },
      speakerLabel: 'Speaker',
    })

    expect(dupResult).toBeNull()
    expect(store.getValidLines().length).toBe(1)
  })

  it('patches translation for a specific line ID', () => {
    const commit = store.commitSegment({
      result: { success: true, text: 'What is your background?' },
      speakerLabel: 'Interviewer',
    })
    expect(commit).not.toBeNull()
    expect(store.getLatestLine()?.translated).toBe('')

    const lineId = commit!.targetLineId
    const patched = store.patchTranslation(lineId, 'Kinh nghiệm của bạn là gì?')

    expect(patched).toBe(true)
    const latest = store.getLatestLine()
    expect(latest?.translated).toBe('Kinh nghiệm của bạn là gì?')
  })

  it('clears lines completely', () => {
    store.commitSegment({
      result: { success: true, text: 'Sample text' },
    })
    expect(store.getValidLines().length).toBe(1)

    store.clear()
    expect(store.getValidLines().length).toBe(0)
    expect(store.getLatestLine()).toBeNull()
  })
})
