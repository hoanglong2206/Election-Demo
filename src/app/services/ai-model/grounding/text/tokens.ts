import { normalize } from './normalize'

export const SHORT_TECH_TERMS = new Set([
  'go', 'c#', 'ai', 'ml', 'js', 'ts', 'ci', 'cd', 'qa', 'qc', 'ui', 'ux', 'db', 'os', 'k8s', 'ar', 'vr'
])

export const STOP_WORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'have', 'been', 'were', 'for', 'about',
  'our', 'my', 'their', 'its', 'next', 'then', 'also', 'currently', 'previously', 'first', 'second', 'finally',
  'đã', 'và', 'có', 'là', 'cho', 'trong', 'một', 'những', 'các', 'với', 'khi', 'được', 'để',
  'em', 'anh', 'chị', 'bằng', 'như', 'vào', 'tại', 'về', 'tới', 'sang', 'qua', 'ra',
  'tiếp theo', 'sau đó', 'đồng thời', 'ngoài ra',
  'bên', 'mình', 'chúng', 'của', 'tôi',
])

/**
 * Extracts meaningful tokens.
 */
export function tokens(text: string): string[] {
  const norm = normalize(text)
  if (!norm) return []
  return norm
    .split(' ')
    .map((token) => token.replace(/^[.,;:!?]+|[.,;:!?]+$/g, ''))
    .filter((token) => {
      if (!token) return false
      if (STOP_WORDS.has(token)) return false
      if (/^\d+(?:\.\d+)?%?$/.test(token)) return true
      if (token.length > 2) return true
      if (SHORT_TECH_TERMS.has(token)) return true
      if (token.length === 2 && /[\p{L}]/u.test(token)) return true
      return false
    })
}
