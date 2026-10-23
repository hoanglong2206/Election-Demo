import type { STTPreviewLine } from './types'

export const YOUTUBE_STT_SAMPLES: Omit<STTPreviewLine, 'id' | 'timestamp'>[] = [
  {
    originalEn:
      'Welcome back everyone. Today we are doing a deep dive into high-throughput distributed system architecture.',
    translatedVi:
      'Chào mừng các bạn đã quay trở lại. Hôm nay chúng ta sẽ phân tích chuyên sâu về kiến trúc hệ thống phân tán chịu tải cao.',
    confidence: 98,
    latencyMs: 240,
    speaker: 'YouTube / Audio Stream',
  },
  {
    originalEn:
      'Under heavy flash-sale traffic, an unoptimized database will quickly exhaust its active connection pool.',
    translatedVi:
      'Khi lưu lượng truy cập flash-sale tăng đột biến, cơ sở dữ liệu chưa tối ưu sẽ nhanh chóng làm cạn kiệt connection pool.',
    confidence: 96,
    latencyMs: 275,
    speaker: 'YouTube / Audio Stream',
  },
  {
    originalEn:
      'By introducing a two-tier in-memory cache, we can safely offload 90 percent of repetitive read queries.',
    translatedVi:
      'Bằng việc áp dụng bộ nhớ đệm Two-Tier In-Memory, chúng ta có thể giảm tải an toàn 90% các truy vấn đọc lặp lại.',
    confidence: 97,
    latencyMs: 260,
    speaker: 'YouTube / Audio Stream',
  },
  {
    originalEn:
      'Notice how the audio pipeline streams 16kHz PCM linear chunks directly into our real-time Whisper engine.',
    translatedVi:
      'Hãy quan sát cách luồng âm thanh truyền các khối PCM 16kHz trực tiếp vào mô hình Whisper theo thời gian thực.',
    confidence: 99,
    latencyMs: 220,
    speaker: 'YouTube / Audio Stream',
  },
  {
    originalEn:
      'Both English audio transcription and Vietnamese instant translation are running smoothly with zero lag.',
    translatedVi:
      'Cả nhận diện giọng nói tiếng Anh và dịch tức thì tiếng Việt đều đang chạy rất mượt mà, sẵn sàng 100% cho cuộc họp!',
    confidence: 98,
    latencyMs: 245,
    speaker: 'YouTube / Audio Stream',
  },
]

export const STT_LANG_OPTIONS: {
  id: 'auto' | 'en' | 'vi'
  name: string
  desc: string
}[] = [
  {
    id: 'auto',
    name: 'Tự động (Auto)',
    desc: 'Tự động nhận diện ngôn ngữ nói',
  },
  {
    id: 'en',
    name: 'Tiếng Anh (EN)',
    desc: 'Bỏ qua bước dò, tăng tốc giải mã',
  },
  {
    id: 'vi',
    name: 'Tiếng Việt (VI)',
    desc: 'Nhận diện trực tiếp giọng nói Tiếng Việt',
  },
]
