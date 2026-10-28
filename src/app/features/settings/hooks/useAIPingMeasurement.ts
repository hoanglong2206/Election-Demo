import { useState, useEffect, useCallback, useRef } from 'react'
import {
  measureRealAIPing,
  getAllAIModels,
  getSavedAIModelId,
  getAvailableSTTEngines,
  getSavedSTTEngineId,
  type AIModelConfig,
  type STTEngineConfig,
} from '@/services/ai-model/aiModels'

interface UseAIPingMeasurementProps {
  selectedLLM: string
  selectedSTT: string
  modelsList: AIModelConfig[]
  sttEnginesList: STTEngineConfig[]
}

export function useAIPingMeasurement({
  selectedLLM,
  selectedSTT,
  modelsList,
  sttEnginesList,
}: UseAIPingMeasurementProps) {
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [liveLLMPing, setLiveLLMPing] = useState<number | null>(() => {
    const saved = getSavedAIModelId()
    const found = getAllAIModels().find((m) => m.id === saved)
    return found?.pingMs ?? null
  })
  const [isPingingLLM, setIsPingingLLM] = useState<boolean>(false)

  const [isCheckingGroqSTT, setIsCheckingGroqSTT] = useState<boolean>(false)
  const [groqSTTTestResult, setGroqSTTTestResult] = useState<{
    latencyMs: number
    text: string
  } | null>(() => {
    const saved = getSavedSTTEngineId()
    const found = getAvailableSTTEngines().find((e) => e.id === saved)
    if (found && found.provider !== 'Local') {
      return {
        latencyMs: found.latencyMs || 180,
        text: `Ping Groq LPU: ${found.latencyMs || 180}ms`,
      }
    }
    return null
  })

  const llmPingReqRef = useRef(0)
  const groqPingReqRef = useRef(0)

  const handleTestLLMPing = useCallback(
    async (targetModelId?: string) => {
      const idToTest = targetModelId || selectedLLM
      if (!idToTest) return
      const reqId = ++llmPingReqRef.current
      setIsPingingLLM(true)
      try {
        const ping = await measureRealAIPing(idToTest)
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          setLiveLLMPing(ping)
        }
      } catch {
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          const target = modelsList.find((m) => m.id === idToTest)
          setLiveLLMPing(target?.pingMs || 120)
        }
      } finally {
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          setIsPingingLLM(false)
        }
      }
    },
    [modelsList, selectedLLM]
  )

  const handleTestGroqSTTPing = useCallback(
    async (targetSTTId?: string) => {
      const idToTest = targetSTTId || selectedSTT || 'whisper-large-v3-turbo'
      const reqId = ++groqPingReqRef.current
      setIsCheckingGroqSTT(true)
      try {
        const ping = await measureRealAIPing(idToTest)
        if (isMountedRef.current && reqId === groqPingReqRef.current) {
          setGroqSTTTestResult({
            latencyMs: ping,
            text: `Ping Groq LPU: ${ping}ms`,
          })
        }
      } catch {
        if (isMountedRef.current && reqId === groqPingReqRef.current) {
          const found = sttEnginesList.find((e) => e.id === idToTest)
          setGroqSTTTestResult({
            latencyMs: found?.latencyMs || 180,
            text: `Ping Groq LPU: ~${found?.latencyMs || 180}ms`,
          })
        }
      } finally {
        if (isMountedRef.current && reqId === groqPingReqRef.current) {
          setIsCheckingGroqSTT(false)
        }
      }
    },
    [selectedSTT, sttEnginesList]
  )

  // Auto-ping when selected LLM changes
  useEffect(() => {
    if (selectedLLM) {
      const timer = setTimeout(() => {
        void handleTestLLMPing(selectedLLM)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedLLM, handleTestLLMPing])

  // Auto-ping when selected STT changes
  useEffect(() => {
    const active = sttEnginesList.find((e) => e.id === selectedSTT)
    if (active && active.provider !== 'Local') {
      const timer = setTimeout(() => {
        void handleTestGroqSTTPing(selectedSTT)
      }, 0)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        if (isMountedRef.current) setGroqSTTTestResult(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedSTT, sttEnginesList, handleTestGroqSTTPing])

  return {
    liveLLMPing,
    isPingingLLM,
    isCheckingGroqSTT,
    groqSTTTestResult,
    handleTestLLMPing,
    handleTestGroqSTTPing,
  }
}

