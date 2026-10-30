import { describe, it, expect, spyOn } from 'bun:test'
import { generateDiscussionOptions } from '../discussion'
import * as llmModule from '../../llm'

describe('generateDiscussionOptions', () => {
  it('parses valid 3-block @@@ delimited format cleanly', async () => {
    const rawOutput = `@@@
LABEL: Trả lời trực tiếp
CONFIDENCE: 95
CONTENT: Điểm số trao đổi chất hiện tại rất cao, cần theo dõi insulin hàng tháng.
@@@
LABEL: Phân tích rủi ro
CONFIDENCE: 91
CONTENT: Nguy cơ tiểu đường ảnh hưởng đến kế hoạch lâu dài của gia đình.
@@@
LABEL: Đề xuất kiểm chứng
CONFIDENCE: 88
CONTENT: Cần xét nghiệm lại chỉ số sau 30 ngày thử nghiệm chế độ ăn.`

    const spy = spyOn(llmModule, 'callUniversalLLM').mockResolvedValueOnce({
      text: rawOutput,
      modelName: 'gemini-1.5-flash',
      provider: 'gemini',
      truncated: false,
    } as any)

    const result = await generateDiscussionOptions({
      latestLine: 'What do the day one results show?',
      isQuestion: true,
      meetingSummary: 'Health discussion',
    })

    expect(result).not.toBeNull()
    expect(result!.length).toBe(3)
    expect(result![0].label).toBe('Trả lời trực tiếp')
    expect(result![0].content).toContain('Điểm số trao đổi chất hiện tại rất cao')
    expect(result![1].label).toBe('Phân tích rủi ro')
    expect(result![2].label).toBe('Đề xuất kiểm chứng')

    spy.mockRestore()
  })

  it('retries or rejects degenerate prompt echoing text (Image 1 case)', async () => {
    const degenerateText =
      'Vẫn nội dung của đó vào định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh) định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh)'

    // Return degenerate on both initial and retry
    const spy = spyOn(llmModule, 'callUniversalLLM')
      .mockResolvedValueOnce({
        text: degenerateText,
        modelName: 'gemini-1.5-flash',
        provider: 'gemini',
        truncated: false,
      } as any)
      .mockResolvedValueOnce({
        text: degenerateText,
        modelName: 'gemini-1.5-flash',
        provider: 'gemini',
        truncated: false,
      } as any)

    const result = await generateDiscussionOptions({
      latestLine: 'What do the results show?',
      isQuestion: true,
      meetingSummary: 'Health discussion',
    })

    // Degenerate output MUST NOT be rendered as raw text in UI!
    expect(result).toBeNull()
    spy.mockRestore()
  })
})

