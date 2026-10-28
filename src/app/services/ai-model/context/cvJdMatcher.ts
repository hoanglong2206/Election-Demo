import { callUniversalLLM } from '../llm'
import { computeCacheKey } from './cache'

export interface CvJdMatchResult {
  score: number // 0 - 100
  level: 'excellent' | 'good' | 'moderate' | 'low'
  summary: string
  matchedKeywords: string[]
  missingKeywords: string[]
  strengths: string[]
  recommendations: string[]
  isAI: boolean
}

// Memory cache for match results
const matchCache = new Map<string, CvJdMatchResult>()

/**
 * Common technical keywords dictionary for instant offline / fallback heuristic matching
 */
const COMMON_TECH_KEYWORDS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'C++', 'C#', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'SQL',
  // Frontend
  'React', 'React Native', 'Next.js', 'Vue', 'Vue.js', 'Nuxt', 'Angular', 'Svelte', 'Tailwind', 'TailwindCSS', 'CSS3', 'HTML5', 'Redux', 'Zustand', 'Vite', 'Webpack', 'Sass', 'Responsive Design', 'SSR', 'Micro-frontends',
  // Backend
  'Node.js', 'Express', 'NestJS', 'Spring Boot', 'Django', 'FastAPI', 'Flask', 'Laravel', 'ASP.NET', '.NET Core', 'Gin', 'Fiber', 'Ruby on Rails',
  // Database & Cache
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Oracle', 'SQL Server', 'SQLite', 'Prisma', 'TypeORM', 'Mongoose', 'Cassandra',
  // DevOps & Cloud
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Google Cloud', 'Azure', 'CI/CD', 'GitHub Actions', 'GitLab CI', 'Jenkins', 'Terraform', 'Nginx', 'Linux', 'Serverless',
  // Architecture & API
  'Microservices', 'Monolith', 'REST API', 'RESTful', 'GraphQL', 'gRPC', 'WebSocket', 'Message Queue', 'Kafka', 'RabbitMQ', 'Clean Architecture', 'DDD', 'Event-Driven',
  // Quality & Testing
  'Unit Test', 'Integration Test', 'Jest', 'Cypress', 'Playwright', 'TDD', 'Clean Code', 'Refactoring',
  // Methodologies & Soft Skills
  'Agile', 'Scrum', 'System Design', 'High Concurrency', 'Performance Optimization', 'Security', 'Scalability', 'Problem Solving', 'Leadership', 'Code Review'
]

/**
 * Fast local heuristic matcher for 0ms instant analysis without API dependency
 */
export function analyzeCvJdMatchHeuristic(cvText: string, jdText: string): CvJdMatchResult {
  const cvLower = (cvText || '').toLowerCase()
  const jdLower = (jdText || '').toLowerCase()

  if (!cvLower.trim() || !jdLower.trim()) {
    return {
      score: 0,
      level: 'low',
      summary: 'Vui lòng cung cấp cả nội dung CV và JD để phân tích độ tương thích.',
      matchedKeywords: [],
      missingKeywords: [],
      strengths: [],
      recommendations: ['Cần nhập đầy đủ CV và JD'],
      isAI: false,
    }
  }

  // Find keywords present in JD
  const jdKeywords: string[] = []
  for (const kw of COMMON_TECH_KEYWORDS) {
    const kwLower = kw.toLowerCase()
    // Match whole word or symbol boundary
    const regex = new RegExp(`\\b${escapeRegExp(kwLower)}\\b`, 'i')
    if (regex.test(jdLower)) {
      jdKeywords.push(kw)
    }
  }

  // Determine which ones are in CV vs missing
  const matchedKeywords: string[] = []
  const missingKeywords: string[] = []

  for (const kw of jdKeywords) {
    const kwLower = kw.toLowerCase()
    const regex = new RegExp(`\\b${escapeRegExp(kwLower)}\\b`, 'i')
    if (regex.test(cvLower)) {
      matchedKeywords.push(kw)
    } else {
      missingKeywords.push(kw)
    }
  }

  // Calculate score
  const totalKeywords = jdKeywords.length
  let score = 50 // baseline
  if (totalKeywords > 0) {
    const ratio = matchedKeywords.length / totalKeywords
    score = Math.round(ratio * 70 + 25) // scaled between 25% and 95%
    score = Math.min(96, Math.max(20, score))
  }

  let level: CvJdMatchResult['level'] = 'moderate'
  if (score >= 80) level = 'excellent'
  else if (score >= 65) level = 'good'
  else if (score >= 45) level = 'moderate'
  else level = 'low'

  const strengths: string[] = []
  if (matchedKeywords.length > 0) {
    strengths.push(`Hồ sơ đáp ứng trực tiếp các công nghệ then chốt của JD: ${matchedKeywords.slice(0, 4).join(', ')}.`)
  }
  if (cvLower.includes('năm') || cvLower.includes('year') || cvLower.includes('senior') || cvLower.includes('lead')) {
    strengths.push('Hồ sơ có dấu hiệu thâm niên và kinh nghiệm thực chiến phù hợp với yêu cầu.')
  }

  const recommendations: string[] = []
  if (missingKeywords.length > 0) {
    recommendations.push(
      `Người phỏng vấn có thể sẽ hỏi sâu về các công nghệ chưa thấy trong CV: ${missingKeywords.slice(0, 3).join(', ')}. Hãy chuẩn bị trước phương án trả lời về việc tự học hoặc kiến thức lý thuyết.`
    )
  }
  recommendations.push('Tập trung dẫn chứng số liệu thực tế (dự án, quy mô traffic, kết quả) để gia tăng độ thuyết phục.')

  const summary =
    score >= 75
      ? `Độ khớp cao (${score}%). Ứng viên nắm vững phần lớn các yêu cầu kỹ thuật trọng tâm của vị trí này.`
      : score >= 55
      ? `Độ khớp khá (${score}%). Ứng viên có nền tảng tốt, nhưng cần chuẩn bị giải trình về một số kỹ năng/công nghệ JD yêu cầu.`
      : `Độ khớp ở mức cần củng cố (${score}%). Có khoảng cách đáng kể giữa kỹ năng trong CV và yêu cầu của JD.`

  return {
    score,
    level,
    summary,
    matchedKeywords,
    missingKeywords,
    strengths,
    recommendations,
    isAI: false,
  }
}

/**
 * Deep semantic analysis between CV and JD using Universal LLM
 */
export async function analyzeCvJdMatchWithAI(
  cvText: string,
  jdText: string,
  forceRefresh = false
): Promise<CvJdMatchResult> {
  const cacheKey = computeCacheKey('cv_jd_match', `${cvText.trim()}:::${jdText.trim()}`)

  if (!forceRefresh) {
    if (matchCache.has(cacheKey)) {
      return matchCache.get(cacheKey)!
    }
    try {
      const stored = sessionStorage.getItem(`match_${cacheKey}`)
      if (stored) {
        const parsed = JSON.parse(stored) as CvJdMatchResult
        matchCache.set(cacheKey, parsed)
        return parsed
      }
    } catch {}
  }

  // Fast heuristic baseline
  const heuristic = analyzeCvJdMatchHeuristic(cvText, jdText)

  const prompt = `Bạn là chuyên gia phân tích tuyển dụng và Tech Lead đánh giá ứng viên.
Hãy so sánh chi tiết giữa Hồ sơ ứng viên (CV) và Bản mô tả công việc (JD) sau đây:

--- HỒ SƠ ỨNG VIÊN (CV) ---
${cvText.slice(0, 4000)}

--- YÊU CẦU CÔNG VIỆC (JD) ---
${jdText.slice(0, 4000)}

Hãy đánh giá khách quan độ tương thích và trả về ĐÚNG ĐỊNH DẠNG JSON sau (không kèm markdown ngoài khối json):
{
  "score": <số nguyên từ 0 đến 100 đại diện cho phần trăm tương thích>,
  "level": "<excellent | good | moderate | low>",
  "summary": "<Tóm tắt 1-2 câu nhận định ngắn gọn về độ phù hợp>",
  "matchedKeywords": ["<kỹ năng/công nghệ có trong JD mà ứng viên đã đáp ứng>"],
  "missingKeywords": ["<kỹ năng/công nghệ quan trọng trong JD mà CV còn thiếu hoặc yếu>"],
  "strengths": ["<2-3 điểm mạnh cốt lõi của ứng viên đối chiếu với JD>"],
  "recommendations": ["<2-3 chiến thuật giúp ứng viên tự tin trả lời phỏng vấn về các điểm còn thiếu>"]
}`

  try {
    const res = await callUniversalLLM(prompt, {
      maxTokens: 600,
      temperature: 0.2,
      systemPrompt: 'You are an expert technical recruiter analyzing CV vs JD compatibility. Always return clean JSON without markdown code fences if possible.',
    })

    if (!res || !res.text || !res.text.trim() || res.truncated) {
      if (res?.truncated) {
        console.warn('[cvJdMatcher] LLM response was truncated mid-stream; falling back to heuristic')
      }
      return heuristic
    }

    const cleanedText = res.text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return heuristic
    }

    const parsed = JSON.parse(jsonMatch[0])
    const finalResult: CvJdMatchResult = {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : heuristic.score,
      level: ['excellent', 'good', 'moderate', 'low'].includes(parsed.level) ? parsed.level : heuristic.level,
      summary: parsed.summary || heuristic.summary,
      matchedKeywords: Array.isArray(parsed.matchedKeywords) && parsed.matchedKeywords.length > 0 ? parsed.matchedKeywords : heuristic.matchedKeywords,
      missingKeywords: Array.isArray(parsed.missingKeywords) && parsed.missingKeywords.length > 0 ? parsed.missingKeywords : heuristic.missingKeywords,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : heuristic.strengths,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 ? parsed.recommendations : heuristic.recommendations,
      isAI: true,
    }

    matchCache.set(cacheKey, finalResult)
    try {
      sessionStorage.setItem(`match_${cacheKey}`, JSON.stringify(finalResult))
    } catch {}

    return finalResult
  } catch (err) {
    console.warn('[cvJdMatcher] AI match analysis fallback to heuristic:', err)
    return heuristic
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
