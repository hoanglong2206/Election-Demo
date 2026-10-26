import type { AIUsageFeature } from '@/services/usage-tracker'

export type CostTrackerViewTab = 'overview' | 'charts' | 'distribution' | 'budget' | 'pricing' | 'logs'

export type ChartMetricMode = 'cost' | 'tokens' | 'requests'

export type ChartDaysRange = 7 | 14 | 30

export type DistributionCategory = 'provider' | 'model' | 'feature'

export type DistributionMetric = 'cost' | 'tokens' | 'requests'

export const FEATURE_NAMES: Record<AIUsageFeature, string> = {
  copilot_interview: 'Cố vấn Phỏng vấn (STAR Answer)',
  copilot_discussion: 'Gợi ý Thảo luận (Discussion)',
  copilot: 'Meeting Copilot AI',
  visual_question: 'Phân tích Màn hình (Vision OCR)',
  stt: 'Nhận diện Giọng nói (STT Whisper)',
  exchange_scanner: 'Quét Trao đổi Gần nhất',
  translate: 'Dịch thuật Song ngữ',
  summary: 'Tóm tắt & Biên bản Họp',
  grounding: 'Kiểm chứng Thông tin (Grounding Judge)',
  general: 'Yêu cầu Tổng quát',
}
