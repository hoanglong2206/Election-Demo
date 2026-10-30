import { describe, it, expect, spyOn } from 'bun:test'
import { translateToVietnamese } from '../translate'
import * as llmModule from '../../llm'

describe('translateToVietnamese', () => {
  it('returns null when input text is empty or whitespace', async () => {
    const res = await translateToVietnamese('   ')
    expect(res).toBeNull()
  })

  it('translates clean text directly on first call', async () => {
    const spy = spyOn(llmModule, 'callUniversalLLM').mockResolvedValueOnce({
      text: 'Chỉ số sức khỏe bình thường.',
      modelName: 'gemini-1.5-flash',
      provider: 'gemini',
      truncated: false,
    } as any)

    const res = await translateToVietnamese('Health metrics are normal.')
    expect(res).toBe('Chỉ số sức khỏe bình thường.')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('retries when first response contains repetitive degeneration loop', async () => {
    const loopingText =
      'Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia.'

    const cleanRetryText =
      'Chỉ số tiền tiểu đường trong đánh giá rất cao, cần theo dõi insulin và cholesterol hàng tháng.'

    const spy = spyOn(llmModule, 'callUniversalLLM')
      .mockResolvedValueOnce({
        text: loopingText,
        modelName: 'gemini-1.5-flash',
        provider: 'gemini',
        truncated: false,
      } as any)
      .mockResolvedValueOnce({
        text: cleanRetryText,
        modelName: 'gemini-1.5-flash',
        provider: 'gemini',
        truncated: false,
      } as any)

    const res = await translateToVietnamese('The pre-diabetic trace is high.')
    expect(res).toBe(cleanRetryText)
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

