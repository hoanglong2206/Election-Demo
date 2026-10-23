export type ResponseLanguage = 'bilingual' | 'en' | 'vi'

export const RESPONSE_LANGUAGE_OPTIONS: {
  value: ResponseLanguage
  label: string
  short: string
}[] = [
  { value: 'bilingual', label: 'Song ngữ', short: 'EN+VI' },
  { value: 'en', label: 'Tiếng Anh', short: 'EN' },
  { value: 'vi', label: 'Tiếng Việt', short: 'VI' },
]

export function normalizeResponseLanguage(value?: string | null): ResponseLanguage {
  return value === 'en' || value === 'vi' ? value : 'bilingual'
}

/** True when the user should get a per-response "Dịch" button. */
export function needsVietnameseTranslation(lang: ResponseLanguage): boolean {
  return lang === 'bilingual'
}

/**
 * Instruction injected into every AI prompt so the model answers in the
 * language the user configured on the Settings page.
 *
 * `bilingual` deliberately asks for ENGLISH only: the UI renders English and
 * exposes a per-response "Dịch" button that produces the Vietnamese version on
 * demand (see `translateToVietnamese`).
 */
export function languageInstruction(lang: ResponseLanguage): string {
  if (lang === 'en') {
    return 'NGÔN NGỮ PHẢN HỒI (bắt buộc): viết TOÀN BỘ nội dung bằng TIẾNG ANH. Không dùng tiếng Việt.'
  }
  if (lang === 'vi') {
    return 'NGÔN NGỮ PHẢN HỒI (bắt buộc): viết TOÀN BỘ nội dung bằng TIẾNG VIỆT (chỉ giữ tiếng Anh cho thuật ngữ kỹ thuật không có từ tương đương).'
  }
  return 'NGÔN NGỮ PHẢN HỒI (bắt buộc): viết TOÀN BỘ nội dung bằng TIẾNG ANH. Người dùng sẽ bấm nút "Dịch" để xem bản tiếng Việt, nên TUYỆT ĐỐI KHÔNG viết tiếng Việt trong nội dung trả lời.'
}
