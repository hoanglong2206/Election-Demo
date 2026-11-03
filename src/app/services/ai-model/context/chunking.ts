import { estimateTokenCount } from './tokenBudget'
import { splitSentences } from '../grounding/text/sentences'

export interface StructuralChunk {
  chunkId?: string
  text: string
  rawText: string
  section: string
  contextHeader: string
  tokenCount: number
  index: number
}

export interface ChunkingOptions {
  maxChars?: number
  minChars?: number
  overlapRatio?: number
  defaultSection?: string
}

const DEFAULT_MAX_CHARS = 950
const DEFAULT_MIN_CHARS = 80
const DEFAULT_OVERLAP_RATIO = 0.15 // 15% overlap

// Standard CV and JD section patterns in Vietnamese and English
const SECTION_KEYWORDS = [
  'kinh nghiệm làm việc',
  'kinh nghiệm chuyên môn',
  'kinh nghiệm',
  'work experience',
  'professional experience',
  'experience',
  'dự án tiêu biểu',
  'dự án nổi bật',
  'dự án cá nhân',
  'dự án',
  'key projects',
  'featured projects',
  'projects',
  'kỹ năng chuyên môn',
  'kỹ năng công nghệ',
  'kỹ năng',
  'technical skills',
  'core competencies',
  'skills',
  'học vấn & chứng chỉ',
  'học vấn và chứng chỉ',
  'học vấn',
  'education',
  'chứng chỉ',
  'certifications',
  'certificates',
  'mục tiêu nghề nghiệp',
  'giới thiệu bản thân',
  'tóm tắt',
  'summary',
  'professional summary',
  'about me',
  'yêu cầu công việc',
  'mô tả công việc',
  'trách nhiệm',
  'job description',
  'requirements',
  'responsibilities',
  'quyền lợi',
  'benefits',
]

interface ParsedSection {
  title: string
  level: number
  lines: string[]
  subEntities: ParsedEntity[]
}

interface ParsedEntity {
  name: string
  lines: string[]
}

/**
 * Checks if a line is a markdown heading (#, ##, ###) or a section title.
 */
function detectHeading(line: string): { title: string; level: number } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Markdown headings (#, ##, ###, ####)
  const mdMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
  if (mdMatch && mdMatch[1] && mdMatch[2]) {
    return {
      level: mdMatch[1].length,
      title: mdMatch[2].replace(/\*\*|__/g, '').trim(),
    }
  }

  // Bold headings: **Header** or __Header__
  const boldMatch = trimmed.match(/^(\*\*|__)(.+?)\1:?$/)
  if (boldMatch && boldMatch[2]) {
    const candidate = boldMatch[2].trim()
    const lower = candidate.toLowerCase()
    if (SECTION_KEYWORDS.some((kw) => lower.includes(kw)) || candidate.length < 50) {
      return { level: 2, title: candidate }
    }
  }

  // All-caps heading or numbered heading (e.g., "KINH NGHIỆM LÀM VIỆC", "1. DỰ ÁN TIÊU BIỂU", "I. HỌC VẤN")
  const numberedMatch = trimmed.match(/^([I|V|X\d]+[.)]\s+)(.+)$/)
  if (numberedMatch && numberedMatch[2]) {
    const candidate = numberedMatch[2].trim()
    const lower = candidate.toLowerCase()
    if (SECTION_KEYWORDS.some((kw) => lower.includes(kw))) {
      return { level: 2, title: candidate }
    }
  }

  // Pure section name match on short line (< 50 chars)
  const cleanLine = trimmed.replace(/[:\-–—]$/, '').trim()
  const lowerClean = cleanLine.toLowerCase()
  if (cleanLine.length < 50 && SECTION_KEYWORDS.some((kw) => lowerClean === kw)) {
    return { level: 2, title: cleanLine }
  }

  return null
}

/**
 * Checks if a line starts a new project or company entity block within a section.
 */
function detectEntityStart(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // ### Project Name or ### Role at Company
  const md3 = trimmed.match(/^#{3,4}\s+(.+)$/)
  if (md3 && md3[1]) {
    return md3[1].replace(/\*\*|__/g, '').trim()
  }

  // Patterns like:
  // "Dự án: E-commerce Platform"
  // "Project: Real-time Chat"
  // "Tech Lead - Tiki (2021 - 2023)"
  // "**Dự án E-commerce**"
  const prefixMatch = trimmed.match(/^(?:dự án|project|vị trí|role|công ty|company)\s*[:–—\-]\s*(.+)$/i)
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].replace(/\*\*|__/g, '').trim()
  }

  const boldPrefix = trimmed.match(/^\*\*(?:dự án|project|vị trí|role)?\s*[:–—\-]?\s*(.+?)\*\*/i)
  if (boldPrefix && boldPrefix[1] && boldPrefix[1].length < 60) {
    return boldPrefix[1].trim()
  }

  // Role - Company (Period): e.g. "Senior Backend Developer – VNG (05/2021 – 11/2023)"
  if (/^[\p{L}\s]+[–—\-]\s*[\p{L}\d\s]+(?:\(.*\))?$/u.test(trimmed) && trimmed.length < 80) {
    return trimmed.replace(/\*\*|__/g, '').trim()
  }

  return null
}

/**
 * Splits lines into hierarchical sections and entity blocks.
 */
function parseDocumentHierarchy(text: string, defaultSection = 'Tài liệu'): ParsedSection[] {
  const lines = text.split('\n')
  const sections: ParsedSection[] = []

  let currentSection: ParsedSection = {
    title: defaultSection,
    level: 1,
    lines: [],
    subEntities: [],
  }

  let currentEntity: ParsedEntity | null = null

  for (const rawLine of lines) {
    const heading = detectHeading(rawLine)

    if (heading && heading.level <= 2) {
      // Finalize previous entity if any
      if (currentEntity && currentEntity.lines.length > 0) {
        currentSection.subEntities.push(currentEntity)
        currentEntity = null
      }
      // Finalize previous section if it has content
      if (currentSection.lines.length > 0 || currentSection.subEntities.length > 0) {
        sections.push(currentSection)
      }

      currentSection = {
        title: heading.title,
        level: heading.level,
        lines: [],
        subEntities: [],
      }
      continue
    }

    const entityName = detectEntityStart(rawLine)
    if (entityName) {
      if (currentEntity && currentEntity.lines.length > 0) {
        currentSection.subEntities.push(currentEntity)
      }
      currentEntity = {
        name: entityName,
        lines: [rawLine],
      }
      continue
    }

    if (currentEntity) {
      currentEntity.lines.push(rawLine)
    } else {
      currentSection.lines.push(rawLine)
    }
  }

  // Final flush
  if (currentEntity && currentEntity.lines.length > 0) {
    currentSection.subEntities.push(currentEntity)
  }
  if (currentSection.lines.length > 0 || currentSection.subEntities.length > 0) {
    sections.push(currentSection)
  }

  return sections.length > 0 ? sections : [{ title: defaultSection, level: 1, lines: [text], subEntities: [] }]
}

/**
 * Splits long block of text into chunks preserving list bullets, sentences, and adding sliding overlap.
 */
function splitBlockWithOverlap(
  rawBody: string,
  maxChars: number,
  minChars: number,
  overlapRatio: number
): string[] {
  const trimmed = rawBody.trim()
  if (!trimmed) return []

  if (trimmed.length <= maxChars) {
    return [trimmed]
  }

  // Break block into atomic narrative units (bullet points or sentences)
  const lines = trimmed.split('\n')
  const units: string[] = []

  for (const line of lines) {
    const lineTrim = line.trim()
    if (!lineTrim) continue

    // If it's a markdown bullet item or numbered item, keep it intact
    if (/^[-*•]\s+|^\d+\.\s+/.test(lineTrim)) {
      units.push(lineTrim)
      continue
    }

    // Otherwise split normal text lines by sentences
    const sentences = splitSentences(lineTrim)
    if (sentences.length > 0) {
      units.push(...sentences)
    } else {
      units.push(lineTrim)
    }
  }

  if (units.length === 0) {
    return [trimmed]
  }

  const chunks: string[] = []
  let currentUnits: string[] = []
  let currentLen = 0

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]!
    const unitLen = unit.length + 1 // + 1 for newline or space

    if (currentLen + unitLen > maxChars && currentUnits.length > 0) {
      // Chunk reached maximum budget, flush it
      const chunkContent = currentUnits.join('\n').trim()
      if (chunkContent.length >= minChars || chunks.length === 0) {
        chunks.push(chunkContent)
      }

      // Compute sliding overlap from the end of currentUnits (approx 15% of maxChars)
      const targetOverlapChars = Math.floor(maxChars * overlapRatio)
      const overlapUnits: string[] = []
      let overlapChars = 0

      for (let j = currentUnits.length - 1; j >= 0; j--) {
        const candidate = currentUnits[j]!
        if (overlapChars + candidate.length <= targetOverlapChars || overlapUnits.length === 0) {
          overlapUnits.unshift(candidate)
          overlapChars += candidate.length
        } else {
          break
        }
      }

      currentUnits = [...overlapUnits]
      currentLen = currentUnits.reduce((acc, u) => acc + u.length + 1, 0)
    }

    currentUnits.push(unit)
    currentLen += unitLen
  }

  if (currentUnits.length > 0) {
    const finalChunk = currentUnits.join('\n').trim()
    if (finalChunk) {
      // If the last chunk is very small and we have previous chunks, merge it with the last chunk if fits
      if (finalChunk.length < minChars && chunks.length > 0) {
        const lastIdx = chunks.length - 1
        const combined = `${chunks[lastIdx]}\n${finalChunk}`
        if (combined.length <= maxChars * 1.35) {
          chunks[lastIdx] = combined
        } else {
          chunks.push(finalChunk)
        }
      } else {
        chunks.push(finalChunk)
      }
    }
  }

  return chunks.filter(Boolean)
}

/**
 * Creates structural chunks with Contextual Header Injection from a document.
 */
export function createStructuralChunks(
  text: string,
  options: ChunkingOptions = {}
): StructuralChunk[] {
  if (!text || !text.trim()) return []

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const minChars = options.minChars ?? DEFAULT_MIN_CHARS
  const overlapRatio = options.overlapRatio ?? DEFAULT_OVERLAP_RATIO
  const defaultSection = options.defaultSection || 'Tài liệu'

  const sections = parseDocumentHierarchy(text, defaultSection)
  const results: StructuralChunk[] = []
  let globalIndex = 0

  for (const section of sections) {
    const sectionTitle = section.title || defaultSection

    // 1. Process top-level section lines (not in sub-entities)
    const sectionBody = section.lines.join('\n').trim()
    if (sectionBody) {
      const bodyChunks = splitBlockWithOverlap(sectionBody, maxChars, minChars, overlapRatio)
      bodyChunks.forEach((rawChunk, partIndex) => {
        const partLabel = bodyChunks.length > 1 ? ` (Phần ${partIndex + 1}/${bodyChunks.length})` : ''
        const contextHeader = `[Ngữ cảnh: ${sectionTitle}${partLabel}]`
        const textWithHeader = `${contextHeader}\n${rawChunk}`

        results.push({
          text: textWithHeader,
          rawText: rawChunk,
          section: sectionTitle,
          contextHeader,
          tokenCount: estimateTokenCount(textWithHeader),
          index: globalIndex++,
        })
      })
    }

    // 2. Process each project / entity block with Contextual Header Injection
    for (const entity of section.subEntities) {
      const entityName = entity.name
      const entityBody = entity.lines.join('\n').trim()
      if (!entityBody) continue

      const fullSectionPath = `${sectionTitle} > ${entityName}`
      const entityChunks = splitBlockWithOverlap(entityBody, maxChars, minChars, overlapRatio)

      entityChunks.forEach((rawChunk, partIndex) => {
        const partLabel = entityChunks.length > 1 ? ` (Phần ${partIndex + 1}/${entityChunks.length})` : ''
        const contextHeader = `[Ngữ cảnh: ${sectionTitle} | Dự án/Vị trí: ${entityName}${partLabel}]`
        const textWithHeader = `${contextHeader}\n${rawChunk}`

        results.push({
          text: textWithHeader,
          rawText: rawChunk,
          section: fullSectionPath,
          contextHeader,
          tokenCount: estimateTokenCount(textWithHeader),
          index: globalIndex++,
        })
      })
    }
  }

  return results
}

/**
 * Backward-compatible helper that splits text into chunks.
 */
export function chunkText(text: string, maxCharsOrOptions: number | ChunkingOptions = DEFAULT_MAX_CHARS): string[] {
  const options: ChunkingOptions =
    typeof maxCharsOrOptions === 'number'
      ? { maxChars: maxCharsOrOptions }
      : maxCharsOrOptions

  const chunks = createStructuralChunks(text, options)
  return chunks.map((c) => c.text)
}

