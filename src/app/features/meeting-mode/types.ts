import type { AppMode } from '@/types/electron.d'
import type { ViewState } from '../../components/layout/Layout'
import type { ContextUsageInfo } from '../../services/ai-model/copilot'
import type { AnswerStrategyId } from '../../services/ai-model/copilot'
import type { GroundingResult } from '../../services/ai-model/copilot'

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
}

export interface MeetingModeProps {
  mode?: AppMode
  onModeChange?: (mode: AppMode) => void
  onViewChange?: (view: ViewState) => void
}
