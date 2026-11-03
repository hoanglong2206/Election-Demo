import type { RefObject } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine, ScannedExchangeResult } from '../../types'
import type { STTQueueMetrics } from '@/services/ai-model/stt'

export interface LiveTranscriptPaneProps {
  sourceType: 'system' | 'mic'
  onSwitchSource: (type: 'system' | 'mic') => void
  validLines: TranscriptLine[]
  latestLine: TranscriptLine | null
  latestExchange?: ScannedExchangeResult | null
  isScanningExchange?: boolean
  isCapturing: boolean
  isListening: boolean
  isTranscribing: boolean
  queueMetrics?: STTQueueMetrics
  onClearTranscript: () => void
  onToggleListening: () => void
  scrollRef: RefObject<HTMLDivElement | null>
  sttEngineLabel: string
  mode: AppMode
  meetingSummary: string | null
  isSummarizing: boolean
  summaryError?: string | null
  copiedSummary: boolean
  onCopySummary: () => void
  onGenerateSummary: (lines: TranscriptLine[]) => void
  showTranslate?: boolean
  sttLang?: 'auto' | 'vi' | 'en'
  onSttLangChange?: (lang: 'auto' | 'vi' | 'en') => void
}
