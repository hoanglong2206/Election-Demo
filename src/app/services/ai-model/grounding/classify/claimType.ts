import type { ClaimType, EvidenceIndex } from '../types'

// Lookaround-based patterns with Unicode flag 'u' to safely handle Vietnamese diacritics
export const PERSONAL_PATTERN = /(?<!\p{L})(?:i|i've|i have|i led|i built|i worked|i managed|my|we|our|ours|our team|our system|tôi|tôi đã|mình|chúng tôi|chúng em|em|em đã|anh đã|chị đã|bên mình|team mình|công ty cũ|nhóm mình|phía mình|kinh nghiệm của tôi|dự án của tôi|bản thân tôi|team của tôi)(?!\p{L})|(?<!\p{L})(?:at|tại)\s+[A-Z\p{Lu}][\p{L}\p{N}.-]+/iu

export const STARTING_ACTION_VERBS = /^\s*(?:implemented|led|built|designed|developed|optimized|scaled|managed|architected|created|integrated|migrated|authored|deployed|delivered|triển khai|xây dựng|thiết kế|tối ưu|tối ưu hóa|dẫn dắt|quản lý|chủ trì|phát triển|tạo ra|tích hợp|chuyển đổi|vận hành|đã\s+[\p{L}]+)\b/iu

export const BULLET_PREFIX_REGEX = /^\s*(?:[-*•]|\d+\.)\s+/

export const METRIC_PATTERN = /(?<!\p{L})(?:\d+(?:\.\d+)?%?|\d+\+?\s*(?:years?|năm|tháng|months?|members?|thành viên|engineers?|kỹ sư|người|people|triệu|million|scale|tỷ|billion|k|m|ms|rps|qps))(?!\p{L})/iu

// Architectural & theoretical concepts (tool names like kafka, docker, k8s, cache, sql, etc. removed)
export const GENERAL_TECHNICAL_MARKERS = /(?<!\p{L})(?:theorem|algorithm|architecture|pattern|protocol|concept|definition|trade-off|tradeoff|indexes|định lý|nguyên lý|mô hình|kiến trúc|khái niệm|bản chất|thông thường|theo lý thuyết|về mặt lý thuyết|trong thực tế|về cơ bản|in theory|by definition|stands for|is defined as|refers to|means that|là một khái niệm|được định nghĩa là|acid|cap|cap theorem|acid properties|acid principle|b-tree|cache-aside|event-driven|microservices|monolith)(?!\p{L})/iu

export const OPINION_APPROACH_MARKERS = /(?<!\p{L})(?:i would|i typically|i prefer|in my opinion|approach|strategy|theo tôi|quan điểm của tôi|thông thường tôi|tôi thường ưu tiên|phương pháp tiếp cận|giải pháp đề xuất)(?!\p{L})/iu

/**
 * Determines whether a sentence expresses personal experience or actions without requiring 1st-person pronouns.
 */
export function isPersonalSentence(sentence: string, index?: EvidenceIndex): boolean {
  if (PERSONAL_PATTERN.test(sentence)) return true
  if (STARTING_ACTION_VERBS.test(sentence)) return true
  if (BULLET_PREFIX_REGEX.test(sentence)) return true

  if (index?.candidateCompanies) {
    const lower = sentence.toLowerCase()
    for (const company of index.candidateCompanies) {
      if (company.length >= 3 && lower.includes(company)) {
        return true
      }
    }
  }
  return false
}

/**
 * Categorizes a claim to decide proper verification policy.
 */
export function classifyClaimType(sentence: string, index?: EvidenceIndex): ClaimType {
  if (OPINION_APPROACH_MARKERS.test(sentence)) {
    return 'opinion_approach'
  }

  const isPersonal = isPersonalSentence(sentence, index)
  const hasMetric = METRIC_PATTERN.test(sentence)

  if (hasMetric && (isPersonal || /(?:reduced|increased|scaled|achieved|tăng|giảm|đạt)/i.test(sentence))) {
    return 'metric'
  }
  if (isPersonal) {
    return 'personal_experience'
  }

  // Not personal: general technical concept, principle, architecture, or 3rd-person mechanics
  return 'general_technical'
}
