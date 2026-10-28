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
