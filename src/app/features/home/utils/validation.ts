import type { AppMode } from '@/types/electron.d'
import {
  estimateTokenCount,
  isValidCvContent,
  isValidJdContent,
} from '@/services/meeting-context'

export { isValidCvContent, isValidJdContent }

export interface MeetingLaunchValidationResult {
  canLaunch: boolean
  error: string | null
  targetTab?: 'cv' | 'jd'
}

export function validateMeetingLaunch(
  mode: AppMode,
  context: { cvSummary?: string; jobDescription?: string; discussionTopic?: string }
): MeetingLaunchValidationResult {
  if (mode !== 'interview') {
    return { canLaunch: true, error: null }
  }

  const hasCV = isValidCvContent(context.cvSummary)
  const hasJD = isValidJdContent(context.jobDescription)

  if (!hasCV && !hasJD) {
    const rawCvProvided = Boolean(context.cvSummary && context.cvSummary.trim())
    const rawJdProvided = Boolean(context.jobDescription && context.jobDescription.trim())
    const errorMsg =
      rawCvProvided || rawJdProvided
        ? 'Nội dung CV hoặc JD chưa hợp lệ (quá ngắn hoặc viết không đúng định dạng). Vui lòng bổ sung đầy đủ.'
        : 'Chế độ Phỏng Vấn yêu cầu phải có cả CV và JD trước khi vào phòng họp. Vui lòng bổ sung đầy đủ.'

    return {
      canLaunch: false,
      error: errorMsg,
      targetTab: !hasCV ? 'cv' : 'jd',
    }
  }

  if (!hasCV) {
    const rawCvProvided = Boolean(context.cvSummary && context.cvSummary.trim())
    return {
      canLaunch: false,
      error: rawCvProvided
        ? 'CV chưa hợp lệ (quá ngắn hoặc thiếu thông tin kinh nghiệm/kỹ năng). Vui lòng bổ sung.'
        : 'Chế độ Phỏng Vấn yêu cầu phải có CV. Vui lòng dán hoặc upload CV của bạn.',
      targetTab: 'cv',
    }
  }

  if (!hasJD) {
    const rawJdProvided = Boolean(context.jobDescription && context.jobDescription.trim())
    return {
      canLaunch: false,
      error: rawJdProvided
        ? 'JD chưa hợp lệ (quá ngắn hoặc thiếu thông tin yêu cầu/mô tả công việc). Vui lòng bổ sung.'
        : 'Chế độ Phỏng Vấn yêu cầu phải có JD (Mô tả công việc). Vui lòng nhập thông tin JD.',
      targetTab: 'jd',
    }
  }

  return { canLaunch: true, error: null }
}

export interface ContextTokenSummary {
  cvTokens: number
  jdTokens: number
  discussionTokens: number
  currentModeTokens: number
  hasModeContext: boolean
  hasCV: boolean
  hasJD: boolean
  canEnterMeeting: boolean
}

export function computeContextTokens(
  context: { cvSummary?: string; jobDescription?: string; discussionTopic?: string },
  mode: AppMode
): ContextTokenSummary {
  const cvTokens = estimateTokenCount(context.cvSummary || '')
  const jdTokens = estimateTokenCount(context.jobDescription || '')
  const discussionTokens = estimateTokenCount(context.discussionTopic || '')
  const currentModeTokens = mode === 'interview' ? cvTokens + jdTokens : discussionTokens
  const hasModeContext = currentModeTokens > 0
  const hasCV = isValidCvContent(context.cvSummary)
  const hasJD = isValidJdContent(context.jobDescription)
  const canEnterMeeting = mode === 'discussion' || (hasCV && hasJD)

  return {
    cvTokens,
    jdTokens,
    discussionTokens,
    currentModeTokens,
    hasModeContext,
    hasCV,
    hasJD,
    canEnterMeeting,
  }
}
