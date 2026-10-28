import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine } from '../types'
import {
  classifyIntent,
  detectIntentFromRecentLines,
  type IntentDetectionResult,
  type TriggerMode,
  tieredContextManager,
  type ContextUsageInfo,
} from '@/services/ai-model/copilot'
import { sessionsPort } from '@/infrastructure/ipc'
import { settingsManager } from '@/services/settings/settingsManager'
import {
  copilotTriggerController,
} from '../controllers/copilotTriggerController'
import { chunkProducer } from '../controllers/chunkProducer'
import type { ScannedExchangeResult } from '@/services/ai-model/copilotResponseService'

export interface UseIntentTriggerProps {
  mode: AppMode
  sessionId: string
  validLines: TranscriptLine[]
  isListening: boolean
  isCapturing: boolean
  isGeneratingAIResponse: boolean
  cancelCurrentStream: () => void
  onTriggerCopilot: (exchange: ScannedExchangeResult) => Promise<void> | void
}

export interface UseIntentTriggerReturn {
  triggerMode: TriggerMode
  latestIntent: IntentDetectionResult | null
  semiAutoPendingQuestion: string | null
  isLatestAQuestion: boolean
  contextUsage: ContextUsageInfo | null
  handleTriggerModeChange: (newMode: TriggerMode) => void
  setContextUsage: (usage: ContextUsageInfo | null) => void
  setIsLatestAQuestion: (isQ: boolean) => void
  setLatestIntent: React.Dispatch<React.SetStateAction<IntentDetectionResult | null>>
}

export function useIntentTrigger({
  mode,
  sessionId,
  validLines,
  isListening,
  isCapturing,
  isGeneratingAIResponse,
  cancelCurrentStream,
  onTriggerCopilot,
}: UseIntentTriggerProps): UseIntentTriggerReturn {
  const isMountedRef = useRef(true)

  const [triggerMode, setTriggerMode] = useState<TriggerMode>(() => {
    return (settingsManager.get('triggerMode') as TriggerMode) || 'auto'
  })
  const [latestIntent, setLatestIntent] = useState<IntentDetectionResult | null>(null)
  const [semiAutoPendingQuestion, setSemiAutoPendingQuestion] = useState<string | null>(null)
  const [isLatestAQuestion, setIsLatestAQuestion] = useState(false)
  const [contextUsage, setContextUsage] = useState<ContextUsageInfo | null>(null)

  const handleTriggerModeChange = useCallback((newMode: TriggerMode) => {
    setTriggerMode(newMode)
    copilotTriggerController.setTriggerMode(newMode)
    settingsManager.set('triggerMode', newMode)
  }, [])

  // Sync mode with controller
  useEffect(() => {
    copilotTriggerController.setTriggerMode(triggerMode)
  }, [triggerMode])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      copilotTriggerController.cancelPending()
    }
  }, [])

  // Process transcript lines, classify intent, and schedule trigger
  useEffect(() => {
    const syncTimer = setTimeout(async () => {
      if (!isMountedRef.current) return

      if (validLines.length === 0) {
        setLatestIntent(null)
        setSemiAutoPendingQuestion(null)
        setIsLatestAQuestion(false)
        return
      }

      // Update TieredContextManager
      tieredContextManager.setSessionId(sessionId)
      tieredContextManager.setTranscriptLines(validLines)

      if (tieredContextManager.shouldTriggerIncrementalSummary()) {
        void tieredContextManager.runIncrementalSummary()
      }

      const lastLine = validLines[validLines.length - 1]
      const exchangeWordCount = (lastLine?.original || '').trim().split(/\s+/).filter(Boolean).length
      const currentBudgetPercent = contextUsage?.usagePercent ?? 0

      const heuristicIntent = detectIntentFromRecentLines(validLines, {
        mode,
        triggerMode,
        dedupeKey: `${mode}:${lastLine?.speaker || 'Speaker'}`,
      })

      const intentRes = heuristicIntent
        ? await classifyIntent(heuristicIntent, {
            triggerMode,
            speaker: lastLine?.speaker,
            wordCount: exchangeWordCount,
            budgetPercent: currentBudgetPercent,
          })
        : null

      if (!isMountedRef.current) return
      setLatestIntent(intentRes)

      if (intentRes?.isQuestion) {
        setIsLatestAQuestion(true)
        void sessionsPort.recovery.append({
          eventId: `question:${sessionId}:${intentRes.detectionTimestamp || intentRes.normalizedText}`,
          sessionId,
          type: 'question:detected',
          timestamp: Date.now(),
          payload: {
            id: intentRes.detectionTimestamp || intentRes.normalizedText,
            text: intentRes.questionText || intentRes.normalizedText,
            intent: intentRes.normalizedIntent,
          },
        })
      } else {
        setIsLatestAQuestion(false)
      }

      // Target exchange derived from intent
      let targetExchange: ScannedExchangeResult | null = null
      if (intentRes && intentRes.normalizedText) {
        targetExchange = {
          original: intentRes.normalizedText,
          speaker: intentRes.speaker,
          timestamp: intentRes.timestamp || lastLine?.timestamp || '',
          isQuestion: intentRes.isQuestion,
          isAiScanned: false,
          sourceLineCount: validLines.length,
        }
      }

      const exchangeText = targetExchange?.original || lastLine?.original || ''
      setContextUsage(tieredContextManager.getUsageEstimate(exchangeText, mode))

      if (!isListening || !isCapturing) return

      if (triggerMode === 'manual') {
        setSemiAutoPendingQuestion(null)
        return
      }

      if (triggerMode === 'semi-auto') {
        if (intentRes?.isQuestion && intentRes.confidence >= 0.65) {
          setSemiAutoPendingQuestion(intentRes.normalizedText)
        } else if (intentRes?.isAmbiguous && intentRes.normalizedText) {
          setSemiAutoPendingQuestion(intentRes.normalizedText)
        } else {
          setSemiAutoPendingQuestion(null)
        }
        return
      }

      // Auto mode: delegating scheduling to CopilotTriggerController
      if (targetExchange && intentRes?.shouldTriggerCopilot) {
        copilotTriggerController.scheduleTrigger({
          exchange: targetExchange,
          intent: intentRes,
          closeReason: chunkProducer.getLastCloseReason(),
          isGenerating: isGeneratingAIResponse,
          cancelCurrentStream,
          onTrigger: onTriggerCopilot,
        })
      }
    }, 0)

    return () => {
      clearTimeout(syncTimer)
    }
  }, [
    validLines,
    mode,
    triggerMode,
    sessionId,
    isListening,
    isCapturing,
    isGeneratingAIResponse,
    contextUsage?.usagePercent,
    cancelCurrentStream,
    onTriggerCopilot,
  ])

  return {
    triggerMode,
    latestIntent,
    semiAutoPendingQuestion,
    isLatestAQuestion,
    contextUsage,
    handleTriggerModeChange,
    setContextUsage,
    setIsLatestAQuestion,
    setLatestIntent,
  }
}
