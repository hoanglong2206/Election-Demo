import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import type { TranscriptLine } from '../types'
import {
  transcriptStore,
} from '../controllers/transcriptStore'
import { chunkProducer } from '../controllers/chunkProducer'
import {
  sttJobQueue,
  type STTQueueMetrics,
} from '@/services/ai-model/stt'
import { whisperPort } from '@/infrastructure/ipc'
import { translationService } from '@/services/ai-model/translation'
import { settingsManager } from '@/services/settings/settingsManager'
import {
  getSavedSTTEngineId,
  type ResponseLanguage,
  STORAGE_KEYS,
} from '@/services/ai-model/aiModels'

export interface UseTranscriptProps {
  responseLang: ResponseLanguage
  sessionId?: string
}

export interface UseTranscriptReturn {
  transcriptLines: TranscriptLine[]
  validLines: TranscriptLine[]
  latestLine: TranscriptLine | null
  isTranscribing: boolean
  queueMetrics: STTQueueMetrics
  sttLang: 'auto' | 'vi' | 'en'
  handleClearTranscript: () => void
  handleSttLangChange: (lang: 'auto' | 'vi' | 'en') => void
}

export function useTranscript({ responseLang, sessionId }: UseTranscriptProps): UseTranscriptReturn {
  const transcriptLines = useSyncExternalStore(
    transcriptStore.subscribe,
    transcriptStore.getSnapshot
  )
  const validLines = useSyncExternalStore(
    transcriptStore.subscribe,
    transcriptStore.getValidLines
  )
  const latestLine = transcriptStore.getLatestLine()

  const [isTranscribing, setIsTranscribing] = useState(false)
  const [queueMetrics, setQueueMetrics] = useState<STTQueueMetrics>(() => sttJobQueue.getMetrics())

  const [sttLang, setSttLang] = useState<'auto' | 'vi' | 'en'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STT_LANGUAGE)
    return saved === 'en' || saved === 'auto' ? saved : 'vi'
  })

  const handleSttLangChange = useCallback((lang: 'auto' | 'vi' | 'en') => {
    setSttLang(lang)
    localStorage.setItem(STORAGE_KEYS.STT_LANGUAGE, lang)
  }, [])

  // Hot-swap STT provider on engine change
  const savedSTTEngineId = getSavedSTTEngineId()
  useEffect(() => {
    sttJobQueue.handleProviderSwitch(savedSTTEngineId)
  }, [savedSTTEngineId])

  // Reset chunkProducer & sttJobQueue whenever entering or switching meeting session
  useEffect(() => {
    if (sessionId) {
      chunkProducer.resetAll(sessionId)
    }
  }, [sessionId])

  // Subscribe to STTJobQueue metrics & Transcript commits
  useEffect(() => {
    if (whisperPort.isAvailable) {
      whisperPort.prewarm().catch((err) => {
        console.warn('[useTranscript] STT Prewarm warning:', err)
      })
    }

    const unsubMetrics = sttJobQueue.subscribe((m) => {
      setQueueMetrics(m)
      setIsTranscribing(m.processingJobs > 0 || m.queueDepth > 0)
    })

    const unsubCommit = sttJobQueue.assembler.onCommit((commit) => {
      const commitRes = transcriptStore.commitSegment(commit)
      if (commitRes) {
        chunkProducer.updateLastTranscriptText(commitRes.textToTranslate)

        // Non-blocking background translation (auto translates non-Vietnamese speech to Vietnamese)
        const translationEnabled = settingsManager.get('translationEnabled') !== false
        const isLocalOnly = settingsManager.get('modelRouterPolicy') === 'local-only'
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

        if (translationEnabled && !isLocalOnly && !isOffline) {
          const targetId = commitRes.targetLineId
          translationService.enqueueLine({
            id: targetId,
            text: commitRes.textToTranslate,
            sttReportedLang: sttLang,
            onTranslate: (translated, status) => {
              if (status === 'translated' && translated && translated !== commitRes.textToTranslate) {
                transcriptStore.patchTranslation(targetId, translated)
              }
            },
          })
        }
      }
    })

    return () => {
      unsubMetrics()
      unsubCommit()
    }
  }, [responseLang, sttLang])

  const handleClearTranscript = useCallback(() => {
    transcriptStore.clear()
    chunkProducer.resetAll(sessionId)
  }, [sessionId])

  return {
    transcriptLines,
    validLines,
    latestLine,
    isTranscribing,
    queueMetrics,
    sttLang,
    handleClearTranscript,
    handleSttLangChange,
  }
}
