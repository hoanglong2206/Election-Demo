import type { AppMode } from '@/types/electron.d'
import { estimateTokenCount } from '@/services/meeting-context'

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

  const hasCV = Boolean(context.cvSummary && context.cvSummary.trim())
  const hasJD = Boolean(context.jobDescription && context.jobDescription.trim())

  if (!hasCV && !hasJD) {
    return {
      canLaunch: false,
      error: 'Chế độ Phỏng Vấn yêu cầu phải có cả CV và JD trước khi vào phòng họp. Vui lòng bổ sung đầy đủ.',
      targetTab: 'cv',
    }
  }

  if (!hasCV) {
    return {
      canLaunch: false,
      error: 'Chế độ Phỏng Vấn yêu cầu phải có CV. Vui lòng dán hoặc upload CV của bạn.',
      targetTab: 'cv',
    }
  }

  if (!hasJD) {
    return {
      canLaunch: false,
      error: 'Chế độ Phỏng Vấn yêu cầu phải có JD (Mô tả công việc). Vui lòng nhập thông tin JD.',
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
  const hasCV = Boolean(context.cvSummary && context.cvSummary.trim())
  const hasJD = Boolean(context.jobDescription && context.jobDescription.trim())
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
