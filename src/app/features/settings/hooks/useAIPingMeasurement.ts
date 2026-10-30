import { useState, useEffect, useCallback, useRef } from 'react'
import {
  measureRealAIPing,
  measureRealSTTLatency,
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

function isLikelyLLMModelId(value?: string): boolean {
  if (!value || !value.trim()) return false
  return !/(whisper|tts|transcribe|speech|audio)/i.test(value)
}

export function useAIPingMeasurement({
  selectedLLM,
  selectedSTT,
  modelsList,
  sttEnginesList,
}: UseAIPingMeasurementProps) {
  const isMountedRef = useRef(true)
  const modelsListRef = useRef(modelsList)
  const sttEnginesListRef = useRef(sttEnginesList)
  const selectedLLMRef = useRef(selectedLLM)
  const selectedSTTRef = useRef(selectedSTT)

  useEffect(() => {
    modelsListRef.current = modelsList
    sttEnginesListRef.current = sttEnginesList
    selectedLLMRef.current = selectedLLM
    selectedSTTRef.current = selectedSTT
  })

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
      const idToTest = targetModelId || selectedLLMRef.current
      if (!idToTest || !isLikelyLLMModelId(idToTest)) return
      const reqId = ++llmPingReqRef.current
      setIsPingingLLM(true)
      try {
        const ping = await measureRealAIPing(idToTest)
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          setLiveLLMPing(ping)
        }
      } catch {
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          const target = modelsListRef.current.find((m) => m.id === idToTest)
          setLiveLLMPing(target?.pingMs || 120)
        }
      } finally {
        if (isMountedRef.current && reqId === llmPingReqRef.current) {
          setIsPingingLLM(false)
        }
      }
    },
    []
  )

  const handleTestGroqSTTPing = useCallback(
    async (targetSTTId?: string) => {
      const idToTest = targetSTTId || selectedSTTRef.current || 'whisper-large-v3-turbo'
      const active = sttEnginesListRef.current.find((e) => e.id === idToTest)
      if (active?.provider === 'Local' || idToTest.includes('local') || idToTest.includes('ggml')) {
        setGroqSTTTestResult(null)
        setIsCheckingGroqSTT(false)
        return
      }

      const reqId = ++groqPingReqRef.current
      setIsCheckingGroqSTT(true)
      try {
        const ping = await measureRealSTTLatency(idToTest)
        if (isMountedRef.current && reqId === groqPingReqRef.current) {
          setGroqSTTTestResult({
            latencyMs: ping,
            text: `Ping Groq LPU: ${ping}ms`,
          })
        }
      } catch {
        if (isMountedRef.current && reqId === groqPingReqRef.current) {
          const found = sttEnginesListRef.current.find((e) => e.id === idToTest)
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
    []
  )

  // Auto-ping only when the selected LLM actually changes.
  // Strictly decoupled: does not trigger when STT changes or when parent re-renders.
  useEffect(() => {
    if (selectedLLM && isLikelyLLMModelId(selectedLLM)) {
      const timer = setTimeout(() => {
        void handleTestLLMPing(selectedLLM)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedLLM, handleTestLLMPing])

  // Auto-ping only when selected STT changes.
  // Strictly decoupled: does not trigger when LLM changes or when parent re-renders.
  useEffect(() => {
    const active = sttEnginesListRef.current.find((e) => e.id === selectedSTT)
    const isLocal = active?.provider === 'Local' || selectedSTT.includes('local') || selectedSTT.includes('ggml')

    if (!isLocal && selectedSTT) {
      const timer = setTimeout(() => {
        void handleTestGroqSTTPing(selectedSTT)
      }, 0)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setGroqSTTTestResult(null)
          setIsCheckingGroqSTT(false)
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedSTT, handleTestGroqSTTPing])

  return {
    liveLLMPing,
    isPingingLLM,
    isCheckingGroqSTT,
    groqSTTTestResult,
    handleTestLLMPing,
    handleTestGroqSTTPing,
  }
}
