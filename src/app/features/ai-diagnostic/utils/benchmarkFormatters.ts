import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'

export type AIBenchmarkErrorCategory = NonNullable<AIBenchmarkResult['errorCategory']>

export interface LatencyClassification {
  status: 'excellent' | 'good' | 'slow'
  label: string
  color: string
}

export function classifyLatency(latencyMs: number): LatencyClassification {
  if (latencyMs < 300) {
    return {
      status: 'excellent',
      label: '⚡ Cực nhanh (Fast)',
      color: 'text-emerald-300',
    }
  }
  if (latencyMs < 800) {
    return {
      status: 'good',
      label: 'Ổn định (Normal)',
      color: 'text-amber-300',
    }
  }
  return {
    status: 'slow',
    label: 'Chậm / Đang chờ',
    color: 'text-rose-300',
  }
}

export interface TokenRateFormat {
  formatted: string
  speedLabel: string
  note: string
}

export function formatTokenRate(
  tokensPerSec: number,
  isEstimate = false
): TokenRateFormat {
  if (!tokensPerSec || tokensPerSec <= 0) {
    return {
      formatted: '-- tok/s',
      speedLabel: 'Chưa đo',
      note: 'Chưa đo',
    }
  }

  const speedLabel =
    tokensPerSec > 80
      ? `🚀 Siêu tốc${isEstimate ? ' (ước tính)' : ''}`
      : isEstimate
      ? 'Ước tính từ nội dung'
      : 'Theo usage API'

  return {
    formatted: `${tokensPerSec} tok/s`,
    speedLabel,
    note: isEstimate ? 'Ước tính' : 'Chuẩn API',
  }
}

export interface BenchmarkErrorDetails {
  title: string
  advice: string | null
}

export function getBenchmarkErrorDetails(
  category?: AIBenchmarkErrorCategory
): BenchmarkErrorDetails {
  if (!category) {
    return {
      title: 'Lỗi API',
      advice: null,
    }
  }

  const titles: Record<AIBenchmarkErrorCategory, string> = {
    authentication: 'API key / quyền truy cập',
    model: 'Model không khả dụng',
    quota: 'Quota / billing đã hết',
    rate_limit: 'Giới hạn tốc độ (rate limit)',
    request: 'Request không hợp lệ',
    service: 'Provider đang gặp sự cố',
    network: 'Lỗi kết nối mạng',
    unknown: 'Lỗi chưa phân loại',
  }

  const advices: Record<AIBenchmarkErrorCategory, string> = {
    authentication:
      'Kiểm tra API key và quyền truy cập model trong trang quản lý của provider.',
    model:
      'Model có thể đã ngừng phục vụ hoặc key không được cấp quyền. Hãy đồng bộ lại danh sách rồi chọn model khác.',
    quota:
      'Kiểm tra quota, billing hoặc giới hạn chi tiêu trong dashboard của provider.',
    rate_limit:
      'Đang gửi quá nhanh hoặc chạm giới hạn tạm thời. Chờ thời gian reset rồi thử lại.',
    request:
      'Provider từ chối cấu hình gửi lên. Kiểm tra model, endpoint và tham số hỗ trợ.',
    service: 'Provider đang gặp sự cố tạm thời. Thử lại sau.',
    network: 'Kiểm tra kết nối mạng rồi thử lại.',
    unknown: 'Xem chi tiết lỗi từ provider bên dưới.',
  }

  return {
    title: titles[category] || 'Lỗi API',
    advice: advices[category] || null,
  }
}

export interface TacticalRecommendation {
  category: 'speed' | 'balanced' | 'deep' | 'risky'
  badgeTitle: string
  badgeVariant: 'emerald' | 'amber' | 'violet' | 'rose'
  headline: string
  bestFor: string
  advice: string
  riskWarning?: string
  suitabilityScore: number
}

export function getTacticalRecommendation(
  benchmarkResult: AIBenchmarkResult | null
): TacticalRecommendation | null {
  if (!benchmarkResult) return null

  // 1. Trường hợp lỗi API / Rate limit / Quota
  if (!benchmarkResult.isRealAPI || benchmarkResult.errorCategory) {
    const errorDetails = getBenchmarkErrorDetails(benchmarkResult.errorCategory)
    return {
      category: 'risky',
      badgeTitle: '🚫 Cảnh Báo Rủi Ro (High Risk)',
      badgeVariant: 'rose',
      headline: 'Không nên dùng cho phiên họp hôm nay',
      bestFor: 'Cần khắc phục kết nối hoặc cấu hình lại API Key',
      advice:
        errorDetails.advice ||
        'Model đang gặp sự cố kết nối hoặc giới hạn quota. Sử dụng lúc này có thể làm gián đoạn cuộc họp.',
      riskWarning: `Phát hiện lỗi: ${errorDetails.title}. Vui lòng thử lại hoặc chọn model khác.`,
      suitabilityScore: 15,
    }
  }

  const effectiveLatency = benchmarkResult.ttftMs ?? benchmarkResult.latencyMs

  // 2. Siêu tốc độ: TTFT < 550ms
  if (effectiveLatency < 550) {
    return {
      category: 'speed',
      badgeTitle: '⚡ Vua Tốc Độ (Speed King)',
      badgeVariant: 'emerald',
      headline: 'Khuyên dùng: Phỏng vấn phản xạ nhanh & Giao tiếp trực tiếp',
      bestFor: 'Phỏng vấn HR, câu hỏi hành vi (Behavioral Q&A), phản xạ thời gian thực',
      advice:
        'Thời gian tới token đầu tiên siêu nhanh (<550ms). Người phỏng vấn sẽ không hề nhận ra độ trễ giữa lúc đặt câu hỏi và lúc bạn trả lời.',
      suitabilityScore: 98,
    }
  }

  // 3. Cân bằng kỹ thuật: TTFT 550ms - 1500ms
  if (effectiveLatency <= 1500) {
    return {
      category: 'balanced',
      badgeTitle: '🎯 Cân Bằng & Chuẩn Xác (Balanced Tech)',
      badgeVariant: 'amber',
      headline: 'Khuyên dùng: Live Coding & Giải thuật (LeetCode / Technical)',
      bestFor: 'Phỏng vấn kỹ thuật, viết thuật toán, phân tích code và sửa lỗi logic',
      advice:
        'Độ trễ ở mức lý tưởng cho bài toán logic. Nội dung sinh ra chi tiết, đúng cú pháp và ít ảo giác.',
      suitabilityScore: 92,
    }
  }

  // 4. Lập luận chuyên sâu: TTFT > 1500ms
  return {
    category: 'deep',
    badgeTitle: '🧠 Lập Luận Chuyên Sâu (Deep Reasoner)',
    badgeVariant: 'violet',
    headline: 'Khuyên dùng: Thiết kế Hệ thống & Bài toán Kiến trúc (System Design)',
    bestFor: 'System Design, bài toán phân tán, thảo luận chiến lược cấp cao',
    advice:
      'Tư duy phân tích chiều sâu rất mạnh nhưng thời gian phản hồi tương đối lâu (>1.5s).',
    riskWarning:
      'Lưu ý: Không nên dùng cho các câu hỏi cần trả lời ngay lập tức để tránh khoảng lặng ngập ngừng trong cuộc họp.',
    suitabilityScore: 78,
  }
}
