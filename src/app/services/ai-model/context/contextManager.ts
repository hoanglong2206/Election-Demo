import type { AppMode } from '@/types/electron.d'
import { getOrCreateCandidateBrief } from './candidateBrief'
import {
  DEFAULT_TOKEN_BUDGET,
  type AssembledContext,
  type ContextAssemblyOptions,
  type LayerTokenBudget,
  type PermanentContext,
  type RollingSessionMemory,
  type TranscriptUtterance,
} from './types'
import {
  initEmptyRollingMemory,
  formatSessionMemoryBlock,
  mergeRollingMemory,
  persistSessionMemoryToStorage,
  restoreSessionMemoryFromStorage,
  clearSessionMemoryFromStorage,
  summarizeIncrementalTranscript,
} from './rollingMemory'
import { assembleMultiTierContext } from './contextAssembler'

export { estimateTokenCount, truncateToTokenLimit } from './tokenBudget'
export * from './types'

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
    this.rollingMemory = initEmptyRollingMemory()
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

  public setSessionId(newSessionId: string): void {
    if (this.sessionId !== newSessionId) {
      this.sessionId = newSessionId
      this.rollingMemory = initEmptyRollingMemory()
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
      const updated = await summarizeIncrementalTranscript({
        lines: this.transcriptLines,
        startIdx,
        endIdx,
        currentMemory: this.rollingMemory,
        customCaller,
      })

      if (updated) {
        this.rollingMemory = updated
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
    return formatSessionMemoryBlock(this.rollingMemory)
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
    return assembleMultiTierContext({
      currentQuestion,
      mode,
      budget: this.budget,
      permanent: this.permanent,
      transcriptLines: this.transcriptLines,
      recentWindow: this.RECENT_WINDOW,
      sessionMemoryBlock: this.formatSessionMemoryBlock(),
      visualQuestionsBlock: this.formatVisualQuestionsBlock(),
      options,
    })
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
    this.rollingMemory = mergeRollingMemory(this.rollingMemory, delta, processedIndex)
    this.persistSessionMemory()
  }

  // ── Crash Recovery & Persistence ──────────────────────────────────────────

  public persistSessionMemory(): void {
    persistSessionMemoryToStorage(this.sessionId, this.rollingMemory)
  }

  public restoreSessionMemory(): boolean {
    const restored = restoreSessionMemoryFromStorage(this.sessionId)
    if (restored) {
      this.rollingMemory = restored
      return true
    }
    return false
  }

  public clearSessionMemory(): void {
    this.rollingMemory = initEmptyRollingMemory()
    clearSessionMemoryFromStorage(this.sessionId)
  }
}

// Global shared singleton
export const tieredContextManager = new TieredContextManager()
