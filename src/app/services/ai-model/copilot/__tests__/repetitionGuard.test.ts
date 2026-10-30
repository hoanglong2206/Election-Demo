import { describe, it, expect } from 'bun:test'
import {
  hasRepetitiveDegeneration,
  pruneRepetitiveTail,
  shortenContent,
} from '../repetitionGuard'

describe('repetitionGuard', () => {
  it('detects prompt echoing degeneration (Image 1 case)', () => {
    const degenerateImage1 =
      'Vẫn nội dung của đó vào định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh) định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh) định dạng ở trên (mỗi CONTENT là một câu trả lời hoàn chỉnh)'
    expect(hasRepetitiveDegeneration(degenerateImage1)).toBe(true)
  })

  it('detects repetitive n-gram looping degeneration (Image 2 & 3 case)', () => {
    const degenerateImage2 =
      'Trạng thái trưởng thành của người tham gia có giá trị cao không thể thời gian 0-100, nó thông qua điều khiển cấu trúc của nó, cho biết có một số nguy cơ cao của bệnh tật nhận xét trong những loại nguyên liệu nhỏ bé và cần thiết để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia.'
    expect(hasRepetitiveDegeneration(degenerateImage2)).toBe(true)
  })

  it('preserves clean valid text without false positives (Image 4 case)', () => {
    const cleanImage4 =
      'Chỉ số tiền tiểu đường trong đánh giá Sức khỏe Chuyển hóa rất cao trên thang điểm từ 0 đến 100, cho thấy rủi ro sức khỏe nội tại đáng kể mà các bác sĩ của Function Health hiện đang theo dõi thông qua các xét nghiệm insulin và cholesterol hàng tháng.'
    expect(hasRepetitiveDegeneration(cleanImage4)).toBe(false)
  })

  it('prunes repetitive tail and keeps the valid first part', () => {
    const textWithRepetitiveTail =
      'Hệ thống đang hoạt động ổn định và cần theo dõi chỉ số insulin. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia. Cần cần thiết sử dụng các số nguy cơ cao của chế độ điều khiển của người tham gia để đưa ra các số nguy cơ cao của chế độ điều khiển của người tham gia.'
    const pruned = pruneRepetitiveTail(textWithRepetitiveTail)
    expect(pruned).toContain('Hệ thống đang hoạt động ổn định và cần theo dõi chỉ số insulin.')
    expect(pruned.length).toBeLessThan(textWithRepetitiveTail.length)
  })

  describe('shortenContent', () => {
    it('shortens bullet points to top 1-2 points', () => {
      const bullets = '• Bước 1: Khởi động Redis cluster.\n• Bước 2: Đồng bộ hóa dữ liệu cache.\n• Bước 3: Thiết lập giám sát cảnh báo Prometheus.\n• Bước 4: Kiểm thử chịu tải 10k QPS.'
      const shortened = shortenContent(bullets)
      expect(shortened).toBe('• Bước 1: Khởi động Redis cluster.\n• Bước 2: Đồng bộ hóa dữ liệu cache.')
    })

    it('shortens multi-sentence text to the first 1-2 sentences', () => {
      const multi =
        'To verify improvement from this high baseline, the team will track monthly data points for insulin and cholesterol levels. This ensures that lifestyle changes effectively lower the metabolic risk score over time. Additionally, secondary metrics will be recorded.'
      const shortened = shortenContent(multi)
      expect(shortened).toBe('To verify improvement from this high baseline, the team will track monthly data points for insulin and cholesterol levels.')
    })

    it('shortens single long sentence cleanly at major clause marker (Vietnamese - Image 4)', () => {
      const vietnameseLong =
        'Chỉ số tiền tiểu đường trong đánh giá Sức khỏe Chuyển hóa rất cao trên thang điểm từ 0 đến 100, cho thấy rủi ro sức khỏe nội tại đáng kể mà các bác sĩ của Function Health hiện đang theo dõi thông qua các xét nghiệm insulin và cholesterol hàng tháng.'
      const shortened = shortenContent(vietnameseLong)
      expect(shortened).toBe('Chỉ số tiền tiểu đường trong đánh giá Sức khỏe Chuyển hóa rất cao trên thang điểm từ 0 đến 100.')
    })

    it('shortens single long sentence cleanly at major clause marker (English - Image 2 Option 01)', () => {
      const englishLong =
        "The participant's pre-diabetic trace score is extremely high on the 0-100 scale, indicating significant internal metabolic dysfunction that aligns with the urgent need for the monthly monitoring of insulin, hormones, and cholesterol by Function Health."
      const shortened = shortenContent(englishLong)
      expect(shortened).toBe("The participant's pre-diabetic trace score is extremely high on the 0-100 scale.")
    })

    it('returns short text unmodified', () => {
      const short = 'Cần kiểm tra lại cấu hình Redis.'
      expect(shortenContent(short)).toBe(short)
    })
  })
})

