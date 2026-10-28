import type { GroundingClaim, GroundingMode } from './types'
import { PERSONAL_PATTERN } from './classify/claimType'

/**
 * Generates minimally corrected answer in the same language as input answer.
 */
export function rewriteAnswer(
  sentences: string[],
  claims: GroundingClaim[],
  mode: GroundingMode
): string {
  const isVietnamese = sentences.some((s) => /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(s))

  const kept: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const c = claims[i]
    if (!c) {
      kept.push(s)
      continue
    }

    if (c.classification === 'CONTRADICTED') {
      continue
    }

    if (
      c.classification === 'UNSUPPORTED' &&
      (c.claimType === 'personal_experience' || c.claimType === 'metric' || PERSONAL_PATTERN.test(s))
    ) {
      if (mode === 'strict') {
        continue
      }
      const caution = isVietnamese ? `${s} (cần xác nhận kinh nghiệm)` : `${s} (confirm experience)`
      kept.push(caution)
      continue
    }

    kept.push(s)
  }

  if (kept.length > 0) return kept.join(' ')

  return isVietnamese
    ? 'Tôi có thể giải thích phương pháp tiếp cận chung, nhưng cần xác nhận lại kinh nghiệm cá nhân và số liệu cụ thể trước khi trình bày.'
    : 'I can explain the approach, but I would confirm the specific personal experience and metrics before stating them.'
}
