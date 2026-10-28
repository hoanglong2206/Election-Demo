import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAllAIModels,
  getSavedAIModelId,
  EMPTY_PLACEHOLDER_MODEL,
  runAILatencyBenchmark,
  type AIModelConfig,
  type AIBenchmarkResult,
} from '@/services/ai-model/aiModels'

export interface UseLLMBenchmarkProps {
  onError?: (error: string) => void
}

export interface UseLLMBenchmarkReturn {
  allLLMModels: AIModelConfig[]
  selectedLLMId: string
  setSelectedLLMId: (id: string) => void
  currentLLM: AIModelConfig
  benchmarkResult: AIBenchmarkResult | null
  isBenchmarking: boolean
  handleRunBenchmark: (modelIdToTest: string, promptToTest: string) => Promise<void>
  clearBenchmarkResult: () => void
}

export function useLLMBenchmark({
  onError,
}: UseLLMBenchmarkProps = {}): UseLLMBenchmarkReturn {
  const [allLLMModels, setAllLLMModels] = useState<AIModelConfig[]>(() =>
    getAllAIModels()
  )
  const [selectedLLMId, setSelectedLLMId] = useState<string>(() =>
    getSavedAIModelId()
  )
  const [benchmarkResult, setBenchmarkResult] =
    useState<AIBenchmarkResult | null>(null)
  const [isBenchmarking, setIsBenchmarking] = useState(false)

  const currentLLM = useMemo(() => {
    return (
      allLLMModels.find((model) => model.id === selectedLLMId) ||
      EMPTY_PLACEHOLDER_MODEL
    )
  }, [allLLMModels, selectedLLMId])

  // Sync available models on storage, focus, and custom update event
  useEffect(() => {
    const handleSync = () => {
      setAllLLMModels(getAllAIModels())
    }
    window.addEventListener('storage', handleSync)
    window.addEventListener('focus', handleSync)
    window.addEventListener('ai-models-updated', handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('focus', handleSync)
      window.removeEventListener('ai-models-updated', handleSync)
    }
  }, [])

  const handleRunBenchmark = useCallback(
    async (modelIdToTest: string, promptToTest: string) => {
      setIsBenchmarking(true)
      try {
        const res = await runAILatencyBenchmark(modelIdToTest, promptToTest)
        setBenchmarkResult(res)
      } catch (err: any) {
        const msg = err?.message || 'Không thể thực hiện đo tốc độ AI.'
        if (onError) onError(msg)
      } finally {
        setIsBenchmarking(false)
      }
    },
    [onError]
  )

  const clearBenchmarkResult = useCallback(() => {
    setBenchmarkResult(null)
  }, [])

  return {
    allLLMModels,
    selectedLLMId,
    setSelectedLLMId,
    currentLLM,
    benchmarkResult,
    isBenchmarking,
    handleRunBenchmark,
    clearBenchmarkResult,
  }
}
