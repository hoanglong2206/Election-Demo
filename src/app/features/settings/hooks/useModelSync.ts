import { useState, useCallback, useRef, useEffect } from 'react'
import {
  getAllAIModels,
  syncActiveAIModels,
  saveAIModelId,
  type AIModelConfig,
} from '@/services/ai-model/aiModels'
import { modelRegistryService } from '@/services/ai-model/model-registry'

interface UseModelSyncProps {
  selectedLLM: string
  setSelectedLLM: (id: string) => void
  setModelsList: (models: AIModelConfig[]) => void
}

export function useModelSync({
  selectedLLM,
  setSelectedLLM,
  setModelsList,
}: UseModelSyncProps) {
  const isMountedRef = useRef(true)
  const callbacksRef = useRef({ setSelectedLLM, setModelsList })

  useEffect(() => {
    callbacksRef.current = { setSelectedLLM, setModelsList }
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [syncMeta, setSyncMeta] = useState(() => modelRegistryService.getSyncState())
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    text: string
    isError: boolean
    isWarning?: boolean
  } | null>(null)

  const syncModelsSelection = useCallback(
    (models: AIModelConfig[]) => {
      callbacksRef.current.setModelsList(models)
      if (models.length > 0 && (!selectedLLM || !models.some((m) => m.id === selectedLLM))) {
        callbacksRef.current.setSelectedLLM(models[0].id)
        saveAIModelId(models[0].id)
      } else if (models.length === 0) {
        callbacksRef.current.setSelectedLLM('')
        saveAIModelId('')
      }
    },
    [selectedLLM]
  )

  const handleSyncModels = useCallback(async () => {
    setIsSyncing(true)
    setSyncStatus((prev) =>
      prev
        ? {
            text: 'Đang kết nối và đồng bộ danh sách mô hình từ API...',
            isError: false,
            isWarning: false,
          }
        : null
    )
    try {
      const res = await syncActiveAIModels()
      syncModelsSelection(getAllAIModels())
      const state = modelRegistryService.getSyncState()
      setSyncMeta(state)

      if (state.status === 'error' || !res.success) {
        setSyncStatus({
          text:
            state.error ||
            res.error ||
            'API không trả về model nào. Hãy kiểm tra API key rồi thử lại.',
          isError: true,
        })
      } else if (state.modelSource === 'mixed') {
        setSyncStatus({
          text: `Đồng bộ một phần: ${state.providerBreakdown}. Một số model đang dùng cache từ lần đồng bộ trước.`,
          isError: false,
          isWarning: true,
        })
      } else {
        setSyncStatus({
          text: `Đồng bộ API thành công! Đã nạp ${res.totalLoaded} model (${res.providerBreakdown}).`,
          isError: false,
        })
      }
    } catch (err) {
      setSyncStatus({
        text: (err as Error)?.message || 'Lỗi khi đồng bộ danh sách model từ API.',
        isError: true,
      })
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false)
      }
    }
  }, [syncModelsSelection])

  return {
    syncMeta,
    setSyncMeta,
    isSyncing,
    syncStatus,
    setSyncStatus,
    syncModelsSelection,
    handleSyncModels,
  }
}
