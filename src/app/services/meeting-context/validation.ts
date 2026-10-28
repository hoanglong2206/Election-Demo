// Domain-Specific CV & JD Content Validation Service
// Protects interview mode from gibberish, spam, or invalid text inputs

const REPEATED_CHAR_REGEX = /(.)\1{5,}/
const CONSONANT_ONLY_REGEX = /^[^aeiouyáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ\s\d\W]{10,}$/i

const CV_DOMAIN_MARKERS =
  /(kinh nghiệm|kỹ năng|dự án|học vấn|đại học|lập trình|công nghệ|vị trí|tốt nghiệp|phát triển|kỹ sư|chuyên viên|mục tiêu|bằng cấp|chứng chỉ|ngôn ngữ|kinh doanh|vận hành|hệ thống|thành tựu|nhiệm vụ|trách nhiệm|experience|skills?|projects?|education|university|developer|engineer|software|responsibilities|achievements?|summary|profile|work history|frontend|backend|fullstack|devops|architect|lead|junior|senior|intern)/i

const JD_DOMAIN_MARKERS =
  /(yêu cầu|mô tả|trách nhiệm|quyền lợi|phúc lợi|kinh nghiệm|ứng viên|kỹ năng|vị trí|mức lương|chế độ|năm kinh nghiệm|thành thạo|ưu tiên|công việc|tuyển dụng|đãi ngộ|vai trò|lợi ích|requirements?|responsibilities|qualifications?|description|benefits?|salary|candidate|role|job|proficient|knowledge|minimum|preferred|years? of experience|team|company|join us|looking for|overview|what you'?ll do|what we offer|stack)/i

const COMMON_TECH_STACK_MARKERS =
  /(react|vue|angular|node|java|python|c\+\+|c#|golang|rust|php|javascript|typescript|sql|postgres|mysql|mongodb|redis|kafka|docker|kubernetes|aws|azure|gcp|git|linux|api|rest|ci\/cd|microservices|html|css|spring|flutter|swift|kotlin|django|fastapi|graphql)/i

function hasGibberishPatterns(cleaned: string): boolean {
  if (REPEATED_CHAR_REGEX.test(cleaned)) {
    return true
  }

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length >= 5) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()))
    if (uniqueWords.size / words.length < 0.4) {
      return true
    }
  }

  for (const word of words) {
    if (word.length >= 10 && CONSONANT_ONLY_REGEX.test(word)) {
      return true
    }
  }

  return false
}

export function isValidCvContent(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false
  const cleaned = text.trim()
  if (cleaned.length < 35) return false

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length < 5) return false

  if (hasGibberishPatterns(cleaned)) return false

  return CV_DOMAIN_MARKERS.test(cleaned) || COMMON_TECH_STACK_MARKERS.test(cleaned)
}

export function isValidJdContent(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false
  const cleaned = text.trim()
  if (cleaned.length < 35) return false

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length < 5) return false

  if (hasGibberishPatterns(cleaned)) return false

  return JD_DOMAIN_MARKERS.test(cleaned) || COMMON_TECH_STACK_MARKERS.test(cleaned)
}

export interface ContextValidationFeedback {
  isValid: boolean
  message: string
}

export function getCvValidationFeedback(text: string | null | undefined): ContextValidationFeedback {
  if (!text || !text.trim()) {
    return { isValid: false, message: 'Chưa nạp nội dung CV' }
  }
  const cleaned = text.trim()
  if (cleaned.length < 35 || cleaned.split(/\s+/).filter(Boolean).length < 5) {
    return {
      isValid: false,
      message: 'Nội dung CV quá ngắn (cần tối thiểu 35 ký tự và 5 từ).',
    }
  }
  if (hasGibberishPatterns(cleaned)) {
    return {
      isValid: false,
      message: 'Nội dung CV có dấu hiệu lặp ký tự hoặc không có nghĩa.',
    }
  }
  if (!isValidCvContent(cleaned)) {
    return {
      isValid: false,
      message: 'Nội dung chưa đúng định dạng CV (cần mô tả kinh nghiệm, kỹ năng, dự án hoặc công nghệ).',
    }
  }
  return { isValid: true, message: 'CV đã nạp hợp lệ vào ngữ cảnh AI' }
}

export function getJdValidationFeedback(text: string | null | undefined): ContextValidationFeedback {
  if (!text || !text.trim()) {
    return { isValid: false, message: 'Chưa nạp nội dung JD' }
  }
  const cleaned = text.trim()
  if (cleaned.length < 35 || cleaned.split(/\s+/).filter(Boolean).length < 5) {
    return {
      isValid: false,
      message: 'Nội dung JD quá ngắn (cần tối thiểu 35 ký tự và 5 từ).',
    }
  }
  if (hasGibberishPatterns(cleaned)) {
    return {
      isValid: false,
      message: 'Nội dung JD có dấu hiệu lặp ký tự hoặc không có nghĩa.',
    }
  }
  if (!isValidJdContent(cleaned)) {
    return {
      isValid: false,
      message: 'Nội dung chưa đúng định dạng JD (cần mô tả vị trí, yêu cầu hoặc trách nhiệm công việc).',
    }
  }
  return { isValid: true, message: 'JD đã nạp hợp lệ vào ngữ cảnh AI' }
}

