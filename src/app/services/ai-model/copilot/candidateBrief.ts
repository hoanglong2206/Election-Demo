/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CANDIDATE BRIEF & CONTEXT COMPRESSION SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Compresses raw CV, Job Description (JD), and Background Analysis
 * from ~1,500–3,000 tokens down to a concise, structured brief of ~600–900 tokens.
 *
 * Caches the brief by hash(CV + JD) in memory and localStorage so it is generated
 * only ONCE per profile change.
 *
 * Provides citation tags ([EXP-1], [PRJ-1], [SKILL-1]) for answer grounding
 * while keeping token count small and deterministic for byte-identical prompt caching.
 */

export interface CandidateBrief {
  hash: string
  role?: string
  companyName?: string
  yearsOfExperience?: string
  headline: string
  keyExperience: Array<{ id: string; role: string; company: string; metrics: string }>
  keyProjects: Array<{ id: string; name: string; tech: string; achievement: string }>
  topSkills: string[]
  gapsAndRisks: string[]
  formattedBriefText: string
  tokenEstimate: number
  createdAt: number
}

const BRIEF_STORAGE_PREFIX = 'copilot_candidate_brief_'
const briefMemoryCache = new Map<string, CandidateBrief>()

/**
 * Fast, deterministic string hashing (FNV-1a 32-bit + length).
 * Produces a stable hash string across both Browser and Node/Bun test environments.
 */
export function computeProfileHash(cvText: string, jdText: string = ''): string {
  const combined = `${cvText.trim()}::${jdText.trim()}`
  let hash = 0x811c9dc5
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return `brief_${(hash >>> 0).toString(16)}_${combined.length}`
}

/**
 * Heuristic token estimator (~3.8 chars per token for English/code, ~2 for Vietnamese)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let ascii = 0
  let nonAscii = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++
    else nonAscii++
  }
  return Math.ceil(ascii / 3.8 + nonAscii / 2.0)
}

/**
 * Extract structured information from CV and JD using deterministic heuristics
 * to generate a concise, token-efficient CandidateBrief (~600–900 tokens).
 */
export function buildDeterministicCandidateBrief(params: {
  cvText: string
  jdText?: string
  backgroundAnalysis?: string
  role?: string
  companyName?: string
}): CandidateBrief {
  const { cvText, jdText = '', backgroundAnalysis = '', role, companyName } = params
  const hash = computeProfileHash(cvText, jdText)

  // 1. Extract candidate name and headline
  const lines = cvText.split('\n').map((l) => l.trim()).filter(Boolean)
  const candidateName = lines[0]?.slice(0, 50) || 'Ứng viên'
  const headline = lines.slice(1, 4).find((l) => l.length > 10 && l.length < 100) || role || 'Software Engineer'

  // 2. Extract Experience bullet points with metrics (% or numbers)
  const expItems: Array<{ id: string; role: string; company: string; metrics: string }> = []
  const metricRegex = /(\d+(?:\.\d+)?%|\d+\s*(?:k|m|million|users|tps|qps|ms|requests|dự án|khách hàng))/i

  let expCounter = 1
  for (const line of lines) {
    if (expCounter > 4) break
    if (metricRegex.test(line) && line.length > 25 && line.length < 200) {
      expItems.push({
        id: `EXP-${expCounter}`,
        role: headline,
        company: companyName || 'Previous Company',
        metrics: line.replace(/^[-*•]\s*/, '').trim(),
      })
      expCounter++
    }
  }

  // Fallback if no metric lines detected
  if (expItems.length === 0) {
    const summaryLines = lines.slice(2, 6).filter((l) => l.length > 20)
    summaryLines.forEach((sl, idx) => {
      expItems.push({
        id: `EXP-${idx + 1}`,
        role: headline,
        company: companyName || 'Company',
        metrics: sl.replace(/^[-*•]\s*/, '').slice(0, 140).trim(),
      })
    })
  }

  // 3. Extract Projects
  const prjItems: Array<{ id: string; name: string; tech: string; achievement: string }> = []
  const projectLines = lines.filter((l) => /dự án|project|hệ thống|platform|application/i.test(l))
  let prjCounter = 1
  for (const pl of projectLines) {
    if (prjCounter > 3) break
    prjItems.push({
      id: `PRJ-${prjCounter}`,
      name: pl.slice(0, 40).replace(/^[-*•]\s*/, ''),
      tech: 'Core Tech Stack',
      achievement: pl.slice(0, 120),
    })
    prjCounter++
  }

  // 4. Extract Top Skills
  const commonTech = [
    'TypeScript', 'JavaScript', 'React', 'Next.js', 'Node.js', 'Python', 'Go', 'Java',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP',
    'GraphQL', 'REST API', 'CI/CD', 'Microservices', 'System Design', 'Git', 'Kafka'
  ]
  const cvLower = cvText.toLowerCase()
  const detectedSkills = commonTech.filter((tech) => cvLower.includes(tech.toLowerCase())).slice(0, 15)

  // 5. Extract Gaps & Risks from Background Analysis if present
  const gaps: string[] = []
  if (backgroundAnalysis) {
    const gapMatches = backgroundAnalysis
      .split('\n')
      .filter((l) => /gap|yếu|thiếu|chưa có|cần lưu ý|rủi ro/i.test(l))
      .slice(0, 3)
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
    gaps.push(...gapMatches)
  }

  // 6. Format the deterministic text block
  const formattedSections: string[] = []
  formattedSections.push(`=== [CANDIDATE BRIEF: ${candidateName.toUpperCase()}] ===`)
  if (role || companyName) {
    formattedSections.push(`MỤC TIÊU ỨNG TUYỂN: ${role || ''}${companyName ? ` tại ${companyName}` : ''}`)
  }
  formattedSections.push(`ĐỊNH DANH: ${headline}`)

  if (detectedSkills.length > 0) {
    formattedSections.push(`KỸ NĂNG CỐT LÕI (SKILLS): ${detectedSkills.join(', ')}`)
  }

  if (expItems.length > 0) {
    formattedSections.push('KINH NGHIỆM TIÊU BIỂU (EXPERIENCE):')
    for (const exp of expItems) {
      formattedSections.push(`- [${exp.id}] ${exp.metrics}`)
    }
  }

  if (prjItems.length > 0) {
    formattedSections.push('DỰ ÁN NỔI BẬT (PROJECTS):')
    for (const prj of prjItems) {
      formattedSections.push(`- [${prj.id}] ${prj.achievement}`)
    }
  }

  if (gaps.length > 0) {
    formattedSections.push('ĐIỂM CẦN LƯU Ý & PHÒNG THỦ (GAPS):')
    for (const gap of gaps) {
      formattedSections.push(`- [GAP] ${gap}`)
    }
  }

  const formattedBriefText = formattedSections.join('\n').trim()
  const tokenEstimate = estimateTokens(formattedBriefText)

  const brief: CandidateBrief = {
    hash,
    role,
    companyName,
    headline,
    keyExperience: expItems,
    keyProjects: prjItems,
    topSkills: detectedSkills,
    gapsAndRisks: gaps,
    formattedBriefText,
    tokenEstimate,
    createdAt: Date.now(),
  }

  // Cache in RAM
  briefMemoryCache.set(hash, brief)

  // Persist to localStorage if available
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`${BRIEF_STORAGE_PREFIX}${hash}`, JSON.stringify(brief))
    } catch {}
  }

  return brief
}

/**
 * Retrieves an existing CandidateBrief from cache or creates a new one.
 */
export function getOrCreateCandidateBrief(params: {
  cvText: string
  jdText?: string
  backgroundAnalysis?: string
  role?: string
  companyName?: string
}): CandidateBrief {
  const hash = computeProfileHash(params.cvText, params.jdText)

  // 1. Check RAM memory cache
  const inMemory = briefMemoryCache.get(hash)
  if (inMemory) {
    return inMemory
  }

  // 2. Check localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${BRIEF_STORAGE_PREFIX}${hash}`)
      if (stored) {
        const parsed = JSON.parse(stored) as CandidateBrief
        if (parsed && parsed.hash === hash && parsed.formattedBriefText) {
          briefMemoryCache.set(hash, parsed)
          return parsed
        }
      }
    } catch {}
  }

  // 3. Generate deterministic brief
  return buildDeterministicCandidateBrief(params)
}

/**
 * Detects if a question requires the full panoramic context (CV + JD)
 * rather than the concise CandidateBrief + RAG chunks.
 *
 * Example: "Tell me about yourself", "Introduce your whole journey", "Tổng quan sự nghiệp"
 */
export function isFullContextNeeded(question: string): boolean {
  if (!question) return false
  const q = question.toLowerCase().trim()
  const fullContextPatterns = [
    /giới thiệu (về )?(bản thân|mình|em|anh|chị)/i,
    /tell me about yourself/i,
    /introduce yourself/i,
    /walk me through your (resume|cv|background|journey)/i,
    /tổng quan (về )?(kinh nghiệm|sự nghiệp|hồ sơ)/i,
    /toàn bộ quá trình/i,
    /career overview/i,
    /tóm tắt sự nghiệp/i,
  ]
  return fullContextPatterns.some((p) => p.test(q))
}
