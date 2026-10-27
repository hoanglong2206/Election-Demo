import type { AppMode } from '@/types/electron.d'
import { callUniversalLLM } from './universalLlm'
import { stripCodeFences } from './parseOptions'
import { getOrCreateCandidateBrief } from './candidateBrief'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TIERED CONTEXT ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 * Tier 1: Permanent Context  — CandidateBrief / CV / JD (~600–900 tokens)
 * Tier 2: Session Memory     — Rolling summary, decisions, facts (~400–600 tokens)
 * Tier 3: Short-Term Memory  — 3-5 most recent conversational utterances (~300–500 tokens)
 * Tier 4: Current Input      — Active question / immediate user prompt (~300–400 tokens)
 *
 * Priority Rule on Exceeding Budget:
 * Current Input (P1) > Short-Term Memory (P2) > Session Memory (P3) > Permanent Context (P4)
 */

export interface PermanentContext {
  cvSummary?: string
  jobDescription?: string
  meetingObjective?: string
  discussionTopic?: string
  backgroundAnalysis?: string
  userPreferences?: string
  role?: string
  companyName?: string
  customInstructions?: string
  presetName?: string
}

export interface RollingSessionMemory {
  topics: string[]
  facts: string[]
  decisions: string[]
  openQuestions: string[]
  importantStatements: string[]
  lastProcessedIndex: number
  updatedAt: number
}

export interface LayerTokenBudget {
  permanent: number
  sessionMemory: number
  shortTerm: number
  currentInput: number
  totalMax: number
}

export const DEFAULT_TOKEN_BUDGET: LayerTokenBudget = {
  permanent: 1200,
  sessionMemory: 600,
  shortTerm: 600,
  currentInput: 400,
  totalMax: 2800,
}

export interface TranscriptUtterance {
  speaker: string
  original: string
  translated?: string
  timestamp?: string
}

export interface ContextAssemblyOptions {
  permanentOverride?: string
  fullContext?: boolean
}

export interface AssembledContext {
  permanentBlock: string
  sessionMemoryBlock: string
  shortTermBlock: string
  currentInputBlock: string
  fullPromptContext: string
  estimatedTokens: {
    permanent: number
    sessionMemory: number
    shortTerm: number
    currentInput: number
    total: number
  }

  tokenBudget: LayerTokenBudget
  usagePercent: number
  isTruncated: boolean
}

/**
 * Heuristic BPE token estimator tailored for English, Code, and Vietnamese Unicode.
 * - ASCII chars: ~3.8-4 chars per token.
 * - Non-ASCII (Vietnamese diacritics/CJK): ~1.8-2 chars per token.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  let asciiCount = 0
  let nonAsciiCount = 0

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 128) {
      asciiCount++
    } else {
      nonAsciiCount++
    }
  }

  const tokens = Math.ceil(asciiCount / 4) + Math.ceil(nonAsciiCount / 2)
  return Math.max(1, tokens)
}

/**
 * Truncates text cleanly at word boundaries to fit within a target token count.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false }
  const currentTokens = estimateTokenCount(text)
  if (currentTokens <= maxTokens) return { text, truncated: false }

  // Suffix overhead reserved (~5 tokens)
  const safeTargetTokens = Math.max(5, maxTokens - 5)
  const ratio = safeTargetTokens / currentTokens
  const targetChars = Math.floor(text.length * ratio)
  let sliced = text.slice(0, targetChars)

  // Align to last word boundary
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace > targetChars * 0.7) {
    sliced = sliced.slice(0, lastSpace)
  }

  return { text: sliced.trim() + ' ... (đã lược bớt)', truncated: true }
}

/**
 * Independent, headless Context Manager orchestrating Multi-Tier Context Memory.
 */
export class TieredContextManager {
  private sessionId: string
  private permanent: PermanentContext = {}
  private transcriptLines: TranscriptUtterance[] = []
  private rollingMemory: RollingSessionMemory
  private budget: LayerTokenBudget
  private isSummarizingIncremental = false

  // Incremental threshold: when unsummarized old lines reach 10 lines
  private readonly BATCH_THRESHOLD = 10
  // Short-term memory window kept raw (last 5 turns)
  private readonly RECENT_WINDOW = 5

  private visualQuestions: Array<{
    id: string
    timestamp: string
    title: string
    contentType: string
    problemSummary: string
    recommendedAnswer: string
    language?: string
    extractedCode?: string
  }> = []

  constructor(sessionId: string = `session_${Date.now()}`, budget?: Partial<LayerTokenBudget>) {
    this.sessionId = sessionId
    this.budget = { ...DEFAULT_TOKEN_BUDGET, ...(budget || {}) }
    this.rollingMemory = this.initEmptyRollingMemory()
    this.restoreSessionMemory()
  }

  public addVisualQuestion(q: {
    id: string
    timestamp: string
    title: string
    contentType: string
    problemSummary: string
    recommendedAnswer: string
    language?: string
    extractedCode?: string
  }): void {
    this.visualQuestions = [q, ...this.visualQuestions.slice(0, 9)]
  }

  public getVisualQuestions() {
    return this.visualQuestions
  }

  public clearVisualQuestions(): void {
    this.visualQuestions = []
  }

  public formatVisualQuestionsBlock(): string {
    if (this.visualQuestions.length === 0) return ''
    return this.visualQuestions
      .map(
        (v) =>
          `[CÂU HỎI TRÊN MÀN HÌNH (SCREENSHOT 📸) - ${v.timestamp} - ${v.title} (${v.contentType}${v.language ? ` / ${v.language}` : ''})]\n` +
          `• Tóm tắt: ${v.problemSummary}\n` +
          (v.extractedCode ? `• Mã nguồn: ${v.extractedCode.slice(0, 200)}\n` : '') +
          `• Phản hồi đề xuất: ${v.recommendedAnswer}`
      )
      .join('\n\n')
  }

  private initEmptyRollingMemory(): RollingSessionMemory {
    return {
      topics: [],
      facts: [],
      decisions: [],
      openQuestions: [],
      importantStatements: [],
      lastProcessedIndex: 0,
      updatedAt: Date.now(),
    }
  }

  public setSessionId(newSessionId: string): void {
    if (this.sessionId !== newSessionId) {
      this.sessionId = newSessionId
      this.rollingMemory = this.initEmptyRollingMemory()
      this.transcriptLines = []
      this.restoreSessionMemory()
    }
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public setPermanentContext(context: PermanentContext): void {
    this.permanent = { ...this.permanent, ...context }
  }

  public getCandidateContext(fullContext = false): string {
    if (fullContext) {
      const parts = [
        this.permanent.cvSummary ? `HỒ SƠ CV ỨNG VIÊN:\n${this.permanent.cvSummary}` : '',
        this.permanent.jobDescription ? `MÔ TẢ CÔNG VIỆC (JD):\n${this.permanent.jobDescription}` : '',
        this.permanent.backgroundAnalysis ? `PHÂN TÍCH CV NÂNG CAO:\n${this.permanent.backgroundAnalysis}` : '',
      ].filter(Boolean)
      return parts.join('\n\n')
    }

    if (this.permanent.cvSummary) {
      const brief = getOrCreateCandidateBrief({
        cvText: this.permanent.cvSummary,
        jdText: this.permanent.jobDescription,
        backgroundAnalysis: this.permanent.backgroundAnalysis,
        role: this.permanent.role,
        companyName: this.permanent.companyName,
      })
      return brief.formattedBriefText
    }

    return ''
  }

  public getPermanentContext(): PermanentContext {
    return { ...this.permanent }
  }

  public setTranscriptLines(lines: TranscriptUtterance[]): void {
    this.transcriptLines = [...lines]
  }

  public addTranscriptLine(line: TranscriptUtterance): void {
    this.transcriptLines.push(line)
  }

  public getRollingMemory(): RollingSessionMemory {
    return { ...this.rollingMemory }
  }

  public setRollingMemory(mem: RollingSessionMemory): void {
    this.rollingMemory = { ...mem }
    this.persistSessionMemory()
  }

  /**
   * Evaluates if incremental summarization is needed:
   * Triggers when the unsummarized backlog exceeds BATCH_THRESHOLD.
   */
  public shouldTriggerIncrementalSummary(): boolean {
    if (this.isSummarizingIncremental) return false
    const totalLines = this.transcriptLines.length
    const unsummarizedCount = totalLines - this.RECENT_WINDOW - this.rollingMemory.lastProcessedIndex
    return unsummarizedCount >= this.BATCH_THRESHOLD
  }

  /**
   * Executes incremental summarization:
   * Takes ONLY old unsummarized chunks, merges into rolling memory schema, and updates persistence.
   */
  public async runIncrementalSummary(
    customCaller?: (prompt: string) => Promise<string | null>
  ): Promise<boolean> {
    if (this.isSummarizingIncremental) return false

    const totalLines = this.transcriptLines.length
    const endIdx = totalLines - this.RECENT_WINDOW
    const startIdx = this.rollingMemory.lastProcessedIndex

    if (endIdx - startIdx < this.BATCH_THRESHOLD) {
      return false
    }

    this.isSummarizingIncremental = true
    try {
      const sliceToSummarize = this.transcriptLines.slice(startIdx, endIdx)
      const transcriptText = sliceToSummarize
        .map((l) => `${l.speaker} [${l.timestamp || '--:--'}]: ${l.original}`)
        .join('\n')

      const prompt = `Bạn là Trợ lý Quản lý Bộ nhớ Cuộc họp (Session Memory Compressor).
Dưới đây là một đoạn hội thoại mới vừa diễn ra trong cuộc họp (từ câu #${startIdx + 1} đến #${endIdx}):
${transcriptText}

Bộ nhớ tóm tắt cuốn chiếu hiện tại của cuộc họp:
- Topics: ${this.rollingMemory.topics.join(', ') || '(chưa có)'}
- Facts & Tech: ${this.rollingMemory.facts.join('; ') || '(chưa có)'}
- Decisions: ${this.rollingMemory.decisions.join('; ') || '(chưa có)'}
- Open Questions: ${this.rollingMemory.openQuestions.join('; ') || '(chưa có)'}
- Important Statements: ${this.rollingMemory.importantStatements.join('; ') || '(chưa có)'}

Nhiệm vụ của bạn:
CẬP NHẬT và NÉN cuốn chiếu bộ nhớ trên với thông tin mới từ đoạn transcript.
QUY TẮC:
1. KHÔNG viết văn xuôi dài dòng. CHỈ trích xuất các ý chính dạng bullet point ngắn gọn, súc tích.
2. Cập nhật thêm topics mới thảo luận; các facts/công nghệ/số liệu mới nhắc tới; quyết định đã chốt; câu hỏi còn dang dở; phát biểu quan trọng.
3. Nếu câu hỏi dang dở cũ đã được trả lời trong đoạn mới, hãy loại bỏ nó khỏi openQuestions.
4. Mỗi danh sách tối đa 5-7 mục ngắn để giữ kích thước bộ nhớ không bị phình to.

Trả về kết quả duy nhất ở định dạng JSON hợp lệ:
{
  "topics": ["chủ đề 1", "chủ đề 2"],
  "facts": ["số liệu hoặc công nghệ 1", "sự thật 2"],
  "decisions": ["quyết định 1"],
  "openQuestions": ["câu hỏi còn tồn đọng"],
  "importantStatements": ["phát biểu đáng chú ý của các bên"]
}`

      let responseText: string | null = null
      if (customCaller) {
        responseText = await customCaller(prompt)
      } else {
        const res = await callUniversalLLM(prompt, { maxTokens: 600, temperature: 0.2 })
        responseText = res?.text || null
      }

      if (!responseText) {
        return false
      }

      const cleanJson = stripCodeFences(responseText).trim()
      let parsed: any = null
      try {
        parsed = JSON.parse(cleanJson)
      } catch {
        const match = cleanJson.match(/\{[\s\S]*\}/)
        if (match) {
          parsed = JSON.parse(match[0])
        }
      }

      if (parsed && typeof parsed === 'object') {
        const sanitizeArray = (arr: any) =>
          Array.isArray(arr) ? arr.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 7) : []

        this.rollingMemory = {
          topics: sanitizeArray(parsed.topics),
          facts: sanitizeArray(parsed.facts),
          decisions: sanitizeArray(parsed.decisions),
          openQuestions: sanitizeArray(parsed.openQuestions),
          importantStatements: sanitizeArray(parsed.importantStatements),
          lastProcessedIndex: endIdx,
          updatedAt: Date.now(),
        }

        this.persistSessionMemory()
        console.log(`[TieredContextManager] Incremental summary merged for lines #${startIdx + 1}-#${endIdx}. Memory updated.`)
        return true
      }

      return false
    } catch (err) {
      console.warn('[TieredContextManager] Error during incremental summary:', err)
      return false
    } finally {
      this.isSummarizingIncremental = false
    }
  }

  /**
   * Builds the formatted Session Memory block from structured schema.
   */
  public formatSessionMemoryBlock(): string {
    const mem = this.rollingMemory
    const parts: string[] = []

    if (mem.topics.length > 0) {
      parts.push(`• Chủ đề đã thảo luận: ${mem.topics.join(', ')}`)
    }
    if (mem.facts.length > 0) {
      parts.push(`• Thông tin & Công nghệ: ${mem.facts.join('; ')}`)
    }
    if (mem.decisions.length > 0) {
      parts.push(`• Quyết định đã thống nhất: ${mem.decisions.join('; ')}`)
    }
    if (mem.openQuestions.length > 0) {
      parts.push(`• Câu hỏi còn mở / chưa chốt: ${mem.openQuestions.join('; ')}`)
    }
    if (mem.importantStatements.length > 0) {
      parts.push(`• Phát biểu then chốt: ${mem.importantStatements.join('; ')}`)
    }

    if (parts.length === 0) {
      return '(Chưa có diễn biến trước đó)'
    }

    return parts.join('\n')
  }

  /**
   * Retrieves ready incremental summary text if available.
   */
  public getIncrementalSummary(): string {
    const formatted = this.formatSessionMemoryBlock()
    if (formatted === '(Chưa có diễn biến trước đó)') return ''
    return formatted
  }

  /**
   * Assembles the 4-tier context with strict token budgeting and priority truncation.
   */
  public assembleContext(
    currentQuestion: string,
    mode: AppMode = 'interview',
    options?: ContextAssemblyOptions,
  ): AssembledContext {
    let isTruncated = false

    // Tier 4: Current Input (Highest Priority)
    const currentInputClean = currentQuestion.trim()
    const { text: currentInputBlock } = truncateToTokenLimit(currentInputClean, this.budget.currentInput)
    const currentInputTokens = estimateTokenCount(currentInputBlock)

    // Tier 3: Short-Term Memory (Priority 2: 10-20 recent utterances + On-screen Visual Questions)
    const recentLines = this.transcriptLines.slice(-this.RECENT_WINDOW)
    let recentFormatted = recentLines
      .map((l) => `${l.speaker}: ${l.original}${l.translated && l.translated !== l.original ? ` | ${l.translated}` : ''}`)
      .join('\n')

    const visualBlock = this.formatVisualQuestionsBlock()
    if (visualBlock) {
      recentFormatted = recentFormatted
        ? `${recentFormatted}\n\n${visualBlock}`
        : visualBlock
    }

    let { text: shortTermBlock, truncated: shortTermTruncated } = truncateToTokenLimit(
      recentFormatted || '(chưa có thoại)',
      this.budget.shortTerm
    )
    if (shortTermTruncated) isTruncated = true
    let shortTermTokens = estimateTokenCount(shortTermBlock)

    // Tier 2: Session Memory (Priority 3: Rolling Summary)
    const rawSessionMemory = this.formatSessionMemoryBlock()
    let { text: sessionMemoryBlock, truncated: sessionTruncated } = truncateToTokenLimit(
      rawSessionMemory,
      this.budget.sessionMemory
    )
    if (sessionTruncated) isTruncated = true
    let sessionMemoryTokens = estimateTokenCount(sessionMemoryBlock)

    // Tier 1: Permanent Context (Priority 4: CV, JD, Objectives, Profile Instructions)
    const permParts: string[] = []
    if (mode === 'interview') {
      if (this.permanent.role) {
        permParts.push(
          `VỊ TRÍ PHỎNG VẤN (ROLE): ${this.permanent.role}${
            this.permanent.companyName ? ` tại ${this.permanent.companyName}` : ''
          }${this.permanent.presetName ? ` [Profile: ${this.permanent.presetName}]` : ''}`
        )
      }
      if (this.permanent.customInstructions) {
        permParts.push(
          `HƯỚNG DẪN RIÊNG CHO AI (CUSTOM INSTRUCTIONS):\n${this.permanent.customInstructions}`
        )
      }
      if (options?.fullContext) {
        if (this.permanent.cvSummary) {
          permParts.push(`HỒ SƠ CV ỨNG VIÊN:\n${this.permanent.cvSummary}`)
        }
        if (this.permanent.jobDescription) {
          permParts.push(`MÔ TẢ CÔNG VIỆC (JD):\n${this.permanent.jobDescription}`)
        }
        if (this.permanent.backgroundAnalysis) {
          permParts.push(`PHÂN TÍCH CV NÂNG CAO:\n${this.permanent.backgroundAnalysis}`)
        }
      } else if (this.permanent.cvSummary) {
        // Compress CV + JD into concise CandidateBrief (~600–900 tokens)
        const brief = getOrCreateCandidateBrief({
          cvText: this.permanent.cvSummary,
          jdText: this.permanent.jobDescription,
          backgroundAnalysis: this.permanent.backgroundAnalysis,
          role: this.permanent.role,
          companyName: this.permanent.companyName,
        })
        permParts.push(brief.formattedBriefText)
      }
    } else {
      if (this.permanent.discussionTopic || this.permanent.meetingObjective) {
        permParts.push(`CHỦ ĐỀ & MỤC TIÊU CUỘC HỌP:\n${this.permanent.discussionTopic || this.permanent.meetingObjective}`)
      }
      if (this.permanent.backgroundAnalysis) {
        permParts.push(`PHÂN TÍCH CHỦ ĐỀ NÂNG CAO:\n${this.permanent.backgroundAnalysis}`)
      }
    }

    if (this.permanent.userPreferences) {
      permParts.push(`TÙY CHỌN NGƯỜI DÙNG: ${this.permanent.userPreferences}`)
    }

    const rawPermanent = options?.permanentOverride ?? permParts.join('\n\n')
    let { text: permanentBlock, truncated: permanentTruncated } = truncateToTokenLimit(
      rawPermanent || '(không có)',
      this.budget.permanent
    )
    if (permanentTruncated) isTruncated = true
    let permanentTokens = estimateTokenCount(permanentBlock)

    // Check total budget with strict priority hierarchy:
    // Current Input (P1) > Short-Term Memory (P2) > Session Memory (P3) > Permanent Context (P4)
    let totalTokens = currentInputTokens + shortTermTokens + sessionMemoryTokens + permanentTokens
    if (totalTokens > this.budget.totalMax) {
      let excess = totalTokens - this.budget.totalMax

      // 1. Truncate Tier 1: Permanent Context (P4 - lowest priority)
      if (excess > 0 && permanentTokens > 50) {
        const canTrim = permanentTokens - 50
        const toTrim = Math.min(canTrim, excess)
        const allowed = Math.max(20, permanentTokens - toTrim)
        permanentBlock = truncateToTokenLimit(permanentBlock, allowed).text
        const newTokens = estimateTokenCount(permanentBlock)
        excess = Math.max(0, excess - (permanentTokens - newTokens))
        permanentTokens = newTokens
        isTruncated = true
      }

      // 2. Truncate Tier 2: Session Memory (P3)
      if (excess > 0 && sessionMemoryTokens > 50) {
        const canTrim = sessionMemoryTokens - 50
        const toTrim = Math.min(canTrim, excess)
        const allowed = Math.max(20, sessionMemoryTokens - toTrim)
        sessionMemoryBlock = truncateToTokenLimit(sessionMemoryBlock, allowed).text
        const newTokens = estimateTokenCount(sessionMemoryBlock)
        excess = Math.max(0, excess - (sessionMemoryTokens - newTokens))
        sessionMemoryTokens = newTokens
        isTruncated = true
      }

      // 3. Truncate Tier 3: Short-Term Memory (P2)
      if (excess > 0 && shortTermTokens > 80) {
        const canTrim = shortTermTokens - 80
        const toTrim = Math.min(canTrim, excess)
        const allowed = Math.max(40, shortTermTokens - toTrim)
        shortTermBlock = truncateToTokenLimit(shortTermBlock, allowed).text
        const newTokens = estimateTokenCount(shortTermBlock)
        excess = Math.max(0, excess - (shortTermTokens - newTokens))
        shortTermTokens = newTokens
        isTruncated = true
      }

      totalTokens = currentInputTokens + shortTermTokens + sessionMemoryTokens + permanentTokens
    }

    const fullPromptContext = `=== [TẦNG 1: PERMANENT CONTEXT] ===
${permanentBlock}

=== [TẦNG 2: SESSION MEMORY (ROLLING SUMMARY)] ===
${sessionMemoryBlock}

=== [TẦNG 3: SHORT-TERM MEMORY (RECENT TRANSCRIPTS)] ===
${shortTermBlock}

=== [TẦNG 4: CURRENT INPUT] ===
${currentInputBlock}`

    const usagePercent = Math.min(100, Math.round((totalTokens / this.budget.totalMax) * 100))

    return {
      permanentBlock,
      sessionMemoryBlock,
      shortTermBlock,
      currentInputBlock,
      fullPromptContext,
      estimatedTokens: {
        permanent: estimateTokenCount(permanentBlock),
        sessionMemory: estimateTokenCount(sessionMemoryBlock),
        shortTerm: estimateTokenCount(shortTermBlock),
        currentInput: currentInputTokens,
        total: totalTokens,
      },
      tokenBudget: this.budget,
      usagePercent,
      isTruncated,
    }
  }

  /**
   * Helper to retrieve quick usage estimate before sending a request.
   */
  public getUsageEstimate(currentInput: string = '', mode: AppMode = 'interview') {
    const assembled = this.assembleContext(currentInput, mode)
    return {
      totalTokens: assembled.estimatedTokens.total,
      maxBudget: assembled.tokenBudget.totalMax,
      usagePercent: assembled.usagePercent,
      breakdown: assembled.estimatedTokens,
    }
  }

  /**
   * Directly merges structured memory items into rolling session memory.
   */
  public mergeIntoRollingMemory(
    delta: Partial<Omit<RollingSessionMemory, 'lastProcessedIndex' | 'updatedAt'>>,
    processedIndex: number
  ): void {
    const mergeUnique = (existing: string[], incoming?: string[]): string[] => {
      if (!incoming || incoming.length === 0) return existing
      const set = new Set(existing)
      for (const item of incoming) {
        const trimmed = item.trim()
        if (trimmed) set.add(trimmed)
      }
      return Array.from(set).slice(-10) // keep top 10 most recent/relevant items
    }

    this.rollingMemory = {
      topics: mergeUnique(this.rollingMemory.topics, delta.topics),
      facts: mergeUnique(this.rollingMemory.facts, delta.facts),
      decisions: mergeUnique(this.rollingMemory.decisions, delta.decisions),
      openQuestions: (delta.openQuestions && delta.openQuestions.length > 0)
        ? delta.openQuestions.map((q) => q.trim()).filter(Boolean).slice(-7)
        : this.rollingMemory.openQuestions,
      importantStatements: mergeUnique(this.rollingMemory.importantStatements, delta.importantStatements),
      lastProcessedIndex: processedIndex,
      updatedAt: Date.now(),
    }

    this.persistSessionMemory()
  }

  // ── Crash Recovery & Persistence ──────────────────────────────────────────

  private getStorageKey(): string {
    return `meeting_copilot_session_memory_${this.sessionId}`
  }

  private static inMemoryStore: Record<string, string> = {}

  private getStorage(): {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
  } {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage
    }
    return {
      getItem: (key: string) => TieredContextManager.inMemoryStore[key] || null,
      setItem: (key: string, value: string) => {
        TieredContextManager.inMemoryStore[key] = value
      },
      removeItem: (key: string) => {
        delete TieredContextManager.inMemoryStore[key]
      },
    }
  }

  public persistSessionMemory(): void {
    try {
      const storage = this.getStorage()
      storage.setItem(this.getStorageKey(), JSON.stringify(this.rollingMemory))
    } catch (err) {
      console.warn('[TieredContextManager] Failed to persist session memory:', err)
    }
  }

  public restoreSessionMemory(): boolean {
    try {
      const storage = this.getStorage()
      const raw = storage.getItem(this.getStorageKey())
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.topics)) {
          this.rollingMemory = parsed
          return true
        }
      }
    } catch {
      // Ignore parse errors
    }
    return false
  }

  public clearSessionMemory(): void {
    this.rollingMemory = this.initEmptyRollingMemory()
    try {
      const storage = this.getStorage()
      storage.removeItem(this.getStorageKey())
    } catch {}
  }
}

// Global shared singleton
export const tieredContextManager = new TieredContextManager()
