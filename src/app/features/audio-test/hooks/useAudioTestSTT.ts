import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getSavedSTTEngineId,
  getAvailableSTTEngines,
  LOCAL_WHISPER_BASE_ENGINE,
} from '@/services/ai-model/aiModels'
import {
  sttJobQueue,
  type STTJob,
  type STTQueueMetrics,
  whisperPromptBuilder,
} from '@/services/ai-model/stt'
import { getSavedMeetingContext } from '@/services/meeting-context'
import { YOUTUBE_STT_SAMPLES } from '../constants'
import type { STTLang, STTPreviewLine } from '../types'
import type { AudioSegment } from '@/core/audio/types'

export interface UseAudioTestSTTParams {
  isCapturing: boolean
  sourceType: 'mic' | 'system'
  getAudioSegmentSince: (sinceSample: number, minDurationSec?: number) => AudioSegment | null
}

export function useAudioTestSTT({
  isCapturing,
  sourceType,
  getAudioSegmentSince,
}: UseAudioTestSTTParams) {
  const [selectedSTT, setSelectedSTT] = useState<string>(getSavedSTTEngineId)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [sttLines, setSttLines] = useState<STTPreviewLine[]>([])
  const [isSimulatingSTT, setIsSimulatingSTT] = useState(false)
  const [queueMetrics, setQueueMetrics] = useState<STTQueueMetrics>(() => sttJobQueue.getMetrics())
  const [sttLang, setSttLang] = useState<STTLang>('auto')

  const availableSTTEngines = getAvailableSTTEngines()
  const currentSTTEngine =
    availableSTTEngines.find((e) => e.id === selectedSTT) ||
    availableSTTEngines[0] ||
    LOCAL_WHISPER_BASE_ENGINE

  const sequenceIdRef = useRef<number>(1)
  const [initialSessionId] = useState(() => 'audiotest_' + Date.now())
  const sessionIdRef = useRef<string>(initialSessionId)
  const lastProcessedSampleRef = useRef<number>(0)

  const sttLangRef = useRef<STTLang>('auto')
  const selectedSTTRef = useRef<string>(selectedSTT)
  const sourceTypeRef = useRef<string>(sourceType)

  useEffect(() => {
    sttLangRef.current = sttLang
    selectedSTTRef.current = selectedSTT
    sourceTypeRef.current = sourceType
  }, [sttLang, selectedSTT, sourceType])

  // Reset sample pointer when capture state toggles
  useEffect(() => {
    if (isCapturing) {
      lastProcessedSampleRef.current = 0
    }
  }, [isCapturing])

  // Revert sttJobQueue provider back to settings configuration when unmounting
  useEffect(() => {
    return () => {
      sttJobQueue.handleProviderSwitch(getSavedSTTEngineId())
    }
  }, [])

  // Sync STT provider & concurrency limit
  useEffect(() => {
    sttJobQueue.handleProviderSwitch(selectedSTT)
  }, [selectedSTT])

  // Subscribe to STTJobQueue metrics & TranscriptAssembler monotonic commits
  useEffect(() => {
    const unsubMetrics = sttJobQueue.subscribe((m) => {
      setQueueMetrics(m)
      setIsTranscribing(m.processingJobs > 0 || m.queueDepth > 0)
    })

    const unsubCommit = sttJobQueue.assembler.onCommit((commit) => {
      const { result, speakerLabel, timestampStr } = commit
      if (result.success && result.text.trim()) {
        const newLine: STTPreviewLine = {
          id: Date.now() + Math.random(),
          timestamp: timestampStr || '00:00',
          originalEn: result.text,
          translatedVi: result.translatedVi || result.text,
          confidence: result.confidence || 98,
          latencyMs: result.latencyMs,
          speaker: speakerLabel || 'Audio Stream',
          engineBadge: `${result.engineName.split(' (')[0]}`,
          isReal: true,
        }

        setSttLines((prev) => {
          if (
            prev.length > 0 &&
            prev[prev.length - 1].originalEn.trim().toLowerCase() === result.text.trim().toLowerCase()
          ) {
            return prev
          }
          return [...prev, newLine]
        })
      }
    })

    return () => {
      unsubMetrics()
      unsubCommit()
    }
  }, [])

  // Real-Time Automatic Speech-to-Text Queue Producer Loop
  useEffect(() => {
    if (!isCapturing) {
      sttJobQueue.pause()
      return
    }

    sttJobQueue.resume()

    const intervalTimer = setInterval(() => {
      const segment = getAudioSegmentSince(lastProcessedSampleRef.current, 1.2)
      if (!segment) return

      lastProcessedSampleRef.current = segment.endSample

      const seqId = sequenceIdRef.current++
      const now = new Date()
      const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(
        now.getSeconds()
      ).padStart(2, '0')}`

      const job: STTJob = {
        jobId: `stt_${sessionIdRef.current}_${seqId}_${Date.now()}`,
        sessionId: sessionIdRef.current,
        sequenceId: seqId,
        audioBuffer: segment.blob,
        hasSpeech: segment.hasAudio,
        createdAt: Date.now(),
        priority: segment.hasAudio ? 1 : 0,
        engineId: selectedSTTRef.current,
        language: sttLangRef.current,
        sourceType: sourceTypeRef.current as 'system' | 'mic',
        speakerLabel:
          sourceTypeRef.current === 'system' ? 'YouTube / Loopback' : 'Microphone Speaker',
        timestampStr: timeStr,
        prompt: whisperPromptBuilder.buildPrompt(getSavedMeetingContext().keywords || []) || undefined,
      }

      sttJobQueue.enqueue(job)
    }, 1000)

    return () => {
      clearInterval(intervalTimer)
      sttJobQueue.pause()
    }
  }, [isCapturing, getAudioSegmentSince])

  const handleSimulateSTT = useCallback(() => {
    setIsSimulatingSTT(true)
    setSttLines((prev) => {
      if (prev.length === 0) {
        const first = YOUTUBE_STT_SAMPLES[0]
        return [
          {
            id: Date.now(),
            timestamp: '00:04',
            originalEn: first.originalEn,
            translatedVi: first.translatedVi,
            confidence: first.confidence,
            latencyMs: first.latencyMs,
            speaker: 'YouTube / Audio Stream',
            engineBadge: `${currentSTTEngine.name.split(' (')[0]}`,
          },
        ]
      }
      const idx = prev.length % YOUTUBE_STT_SAMPLES.length
      const sample = YOUTUBE_STT_SAMPLES[idx]
      return [
        ...prev,
        {
          id: Date.now(),
          timestamp: `00:${String((prev.length + 1) * 4).padStart(2, '0')}`,
          originalEn: sample.originalEn,
          translatedVi: sample.translatedVi,
          confidence: sample.confidence,
          latencyMs: sample.latencyMs,
          speaker: sourceTypeRef.current === 'system' ? 'YouTube / Audio Stream' : 'Microphone Speaker',
          engineBadge: `${currentSTTEngine.name.split(' (')[0]}`,
        },
      ]
    })
  }, [currentSTTEngine.name])

  const handleClearSTT = useCallback(() => {
    setSttLines([])
    setIsSimulatingSTT(false)
    sequenceIdRef.current = 1
    sessionIdRef.current = 'audiotest_' + Date.now()
    lastProcessedSampleRef.current = 0
    sttJobQueue.reset(sessionIdRef.current)
  }, [])

  const handleSelectSTTEngine = useCallback((engineId: string) => {
    setSelectedSTT(engineId)
    sttJobQueue.handleProviderSwitch(engineId)
  }, [])

  return {
    selectedSTT,
    setSelectedSTT: handleSelectSTTEngine,
    availableSTTEngines,
    currentSTTEngine,
    sttLang,
    setSttLang,
    sttLines,
    isTranscribing,
    isSimulatingSTT,
    queueMetrics,
    handleSimulateSTT,
    handleClearSTT,
  }
}
