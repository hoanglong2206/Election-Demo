import type { AppMode } from '@/types/electron.d'
import { getOrCreateCandidateBrief } from './candidateBrief'
import { estimateTokenCount, truncateToTokenLimit } from './tokenBudget'
import type {
  AssembledContext,
  ContextAssemblyOptions,
  LayerTokenBudget,
  PermanentContext,
  TranscriptUtterance,
} from './types'

export interface AssembleContextParams {
  currentQuestion: string
  mode?: AppMode
  budget: LayerTokenBudget
  permanent: PermanentContext
  transcriptLines: TranscriptUtterance[]
  recentWindow: number
  sessionMemoryBlock: string
  visualQuestionsBlock: string
  options?: ContextAssemblyOptions
}

/**
 * Assembles the 4-tier context with strict token budgeting and priority truncation.
 */
export function assembleMultiTierContext(params: AssembleContextParams): AssembledContext {
  const {
    currentQuestion,
    mode = 'interview',
    budget,
    permanent,
    transcriptLines,
    recentWindow,
    sessionMemoryBlock: rawSessionMemory,
    visualQuestionsBlock,
    options,
  } = params

  let isTruncated = false

  // Tier 4: Current Input (Highest Priority)
  const currentInputClean = currentQuestion.trim()
  const { text: currentInputBlock } = truncateToTokenLimit(currentInputClean, budget.currentInput)
  const currentInputTokens = estimateTokenCount(currentInputBlock)

  // Tier 3: Short-Term Memory (Priority 2: recent utterances + On-screen Visual Questions)
  const recentLines = transcriptLines.slice(-recentWindow)
  let recentFormatted = recentLines
    .map((l) => `${l.speaker}: ${l.original}${l.translated && l.translated !== l.original ? ` | ${l.translated}` : ''}`)
    .join('\n')

  if (visualQuestionsBlock) {
    recentFormatted = recentFormatted
      ? `${recentFormatted}\n\n${visualQuestionsBlock}`
      : visualQuestionsBlock
  }

  const stRes = truncateToTokenLimit(
    recentFormatted || '(chưa có thoại)',
    budget.shortTerm
  )
  let shortTermBlock = stRes.text
  const shortTermTruncated = stRes.truncated
  if (shortTermTruncated) isTruncated = true
  let shortTermTokens = estimateTokenCount(shortTermBlock)

  // Tier 2: Session Memory (Priority 3: Rolling Summary)
  const smRes = truncateToTokenLimit(
    rawSessionMemory,
    budget.sessionMemory
  )
  let sessionMemoryBlock = smRes.text
  const sessionTruncated = smRes.truncated
  if (sessionTruncated) isTruncated = true
  let sessionMemoryTokens = estimateTokenCount(sessionMemoryBlock)

  // Tier 1: Permanent Context (Priority 4: CV, JD, Objectives, Profile Instructions)
  const permParts: string[] = []
  if (mode === 'interview') {
    if (permanent.role) {
      permParts.push(
        `VỊ TRÍ PHỎNG VẤN (ROLE): ${permanent.role}${
          permanent.companyName ? ` tại ${permanent.companyName}` : ''
        }${permanent.presetName ? ` [Profile: ${permanent.presetName}]` : ''}`
      )
    }
    if (permanent.customInstructions) {
      permParts.push(
        `HƯỚNG DẪN RIÊNG CHO AI (CUSTOM INSTRUCTIONS):\n${permanent.customInstructions}`
      )
    }
    if (options?.fullContext) {
      if (permanent.cvSummary) {
        permParts.push(`HỒ SƠ CV ỨNG VIÊN:\n${permanent.cvSummary}`)
      }
      if (permanent.jobDescription) {
        permParts.push(`MÔ TẢ CÔNG VIỆC (JD):\n${permanent.jobDescription}`)
      }
      if (permanent.backgroundAnalysis) {
        permParts.push(`PHÂN TÍCH CV NÂNG CAO:\n${permanent.backgroundAnalysis}`)
      }
    } else if (permanent.cvSummary) {
      // Compress CV + JD into concise CandidateBrief (~600–900 tokens)
      const brief = getOrCreateCandidateBrief({
        cvText: permanent.cvSummary,
        jdText: permanent.jobDescription,
        backgroundAnalysis: permanent.backgroundAnalysis,
        role: permanent.role,
        companyName: permanent.companyName,
      })
      permParts.push(brief.formattedBriefText)
    }
  } else {
    if (permanent.discussionTopic || permanent.meetingObjective) {
      permParts.push(`CHỦ ĐỀ & MỤC TIÊU CUỘC HỌP:\n${permanent.discussionTopic || permanent.meetingObjective}`)
    }
    if (permanent.backgroundAnalysis) {
      permParts.push(`PHÂN TÍCH CHỦ ĐỀ NÂNG CAO:\n${permanent.backgroundAnalysis}`)
    }
  }

  if (permanent.userPreferences) {
    permParts.push(`TÙY CHỌN NGƯỜI DÙNG: ${permanent.userPreferences}`)
  }

  const rawPermanent = options?.permanentOverride ?? permParts.join('\n\n')
  const permRes = truncateToTokenLimit(
    rawPermanent || '(không có)',
    budget.permanent
  )
  let permanentBlock = permRes.text
  const permanentTruncated = permRes.truncated
  if (permanentTruncated) isTruncated = true
  let permanentTokens = estimateTokenCount(permanentBlock)

  // Check total budget with strict priority hierarchy:
  // Current Input (P1) > Short-Term Memory (P2) > Session Memory (P3) > Permanent Context (P4)
  let totalTokens = currentInputTokens + shortTermTokens + sessionMemoryTokens + permanentTokens
  if (totalTokens > budget.totalMax) {
    let excess = totalTokens - budget.totalMax

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

  const usagePercent = Math.min(100, Math.round((totalTokens / budget.totalMax) * 100))

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
    tokenBudget: budget,
    usagePercent,
    isTruncated,
  }
}
