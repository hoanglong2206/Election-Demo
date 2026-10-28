import type { AppMode } from '@/types/electron.d'
import type { ViewState } from '../../components/layout/Layout'
import type { RetrievalCitation, RetrievalDiagnostics } from '../../services/ai-model/context'
import type { ContextUsageInfo } from '../../services/ai-model/copilot'
import type { AnswerStrategyId } from '../../services/ai-model/strategy'
import type { GroundingResult } from '../../services/ai-model/grounding'
import type { RoutingDecision } from '../../services/ai-model/model-router'
import type { HistorySuggestion } from '@/services/session-history'
import type { IntentDetectionResult } from '../../services/ai-model/intent'
import type { ResponseLanguage } from '../../services/ai-model/aiModels'
import type { AssembledExchange as ScannedExchangeResult } from '../../services/ai-model/copilot/exchangeAssembler'
export type { ScannedExchangeResult }
import type { CopilotState } from './machines/copilotStateMachine'

export interface TranscriptLine {
  id: number
  original: string
  translated: string
  speaker: string
  timestamp: string
}

export interface AISuggestion {
  id: number
  type: 'answer' | 'option'
  label?: string
  content: string
  confidence?: number
  contextUsage?: ContextUsageInfo
}

export type StreamingState = 'idle' | 'connecting' | 'streaming' | 'done' | 'interrupted' | 'error'

export interface InterviewVariation {
  id: number
  type: 'answer'
  label: string
  content: string
  shortContent: string
  confidence: number
  contextUsage?: ContextUsageInfo
  strategy?: {
    strategyId: AnswerStrategyId
    confidence: number
    reasoningTags: string[]
    outputSections: string[]
  }
  grounding?: GroundingResult
  retrieval?: {
    citations: RetrievalCitation[]
    diagnostics: RetrievalDiagnostics
  }
  routing?: RoutingDecision
  failover?: {
    switched: boolean
    fromProvider?: string
    toProvider?: string
    reason?: string
  }
  isStreaming?: boolean
  streamingState?: StreamingState
  appliedCorrected?: boolean
}

export interface UseCopilotGenerationProps {
  mode: AppMode
  sessionId: string
  activeCV: string
  activeJD: string
  cvAnalysis: string
  discussionAnalysis: string
  discussionTopic?: string
  meetingSummary: string | null
  latestIntent: IntentDetectionResult | null
  aiSuggestionsHistoryRef: React.MutableRefObject<HistorySuggestion[]>
  setContextUsage: (usage: ContextUsageInfo | null) => void
}

export interface UseCopilotGenerationReturn {
  copilotState: CopilotState
  isGeneratingAIResponse: boolean
  customInterviewAnswer: InterviewVariation | null
  customDiscussionSuggestions: AISuggestion[] | null
  isShortened: boolean
  isRegenerating: boolean
  aiError: string | null
  responseLang: ResponseLanguage
  answerStrategyOverride: AnswerStrategyId | undefined
  copiedAnswer: boolean
  copiedOptionId: number | null
  activeAnswerContent: string
  suggestions: AISuggestion[]
  setAiError: (err: string | null) => void
  setAnswerStrategyOverride: (strategy: AnswerStrategyId | undefined) => void
  handleGenerateCopilotResponse: (
    lines: TranscriptLine[],
    summaryOverride?: string | null,
    scannedOverride?: ScannedExchangeResult | null
  ) => Promise<void>
  handleRegenerate: (lines: TranscriptLine[], scanned?: ScannedExchangeResult | null) => Promise<void>
  handleToggleShorten: () => void
  handleToggleCorrectedAnswer: () => void
  handleResponseLangChange: (lang: ResponseLanguage) => void
  handleCopyAnswer: () => void
  handleCopyOption: (text: string, id: number, e: React.MouseEvent) => void
  cancelStream: () => void
  resetCopilot: () => void
}

export interface MeetingModeProps {
  mode?: AppMode
  onModeChange?: (mode: AppMode) => void
  onViewChange?: (view: ViewState) => void
}
