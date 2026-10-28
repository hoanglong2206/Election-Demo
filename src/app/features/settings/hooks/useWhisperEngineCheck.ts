import { useState, useEffect, useCallback, useRef } from 'react'
import { whisperPort } from '@/infrastructure/ipc'
import {
  getAvailableSTTEngines,
  syncLocalSTTModelsFromStatus,
  saveSTTEngineId,
  type STTEngineConfig,
} from '@/services/ai-model/aiModels'

interface UseWhisperEngineCheckProps {
  selectedSTT: string
  setSelectedSTT: (id: string) => void
  setSttEnginesList: (engines: STTEngineConfig[]) => void
}

export function useWhisperEngineCheck({
  selectedSTT,
  setSelectedSTT,
  setSttEnginesList,
}: UseWhisperEngineCheckProps) {
  const isMountedRef = useRef(true)
  const [isCheckingNative, setIsCheckingNative] = useState(false)
  const [nativeTestResult, setNativeTestResult] = useState<{
    latencyMs: number
    isNative: boolean
    text: string
  } | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sync available local models from whisper status
  useEffect(() => {
    if (!whisperPort.isAvailable) return
    let isCancelled = false
    whisperPort
      .getStatus()
      .then((st) => {
        if (isCancelled) return
        if (st?.availableModels && Array.isArray(st.availableModels)) {
          syncLocalSTTModelsFromStatus(st.availableModels)
          const updated = getAvailableSTTEngines()
          setSttEnginesList(updated)
          if (!updated.some((e) => e.id === selectedSTT)) {
            const nextId = updated[0]?.id || 'ggml-tiny.bin'
            setSelectedSTT(nextId)
            saveSTTEngineId(nextId)
          }
        }
      })
      .catch(() => {})

    return () => {
      isCancelled = true
    }
  }, [selectedSTT, setSelectedSTT, setSttEnginesList])

  const handleCheckNativeEngine = useCallback(async () => {
    setIsCheckingNative(true)
    setNativeTestResult(null)
    try {
      if (whisperPort.isAvailable) {
        // 1. Pre-flight health check on binary and model
        try {
          const health = await whisperPort.healthCheck(selectedSTT)
          if (health && !health.healthy) {
            if (isMountedRef.current) {
              setNativeTestResult({
                latencyMs: 0,
                isNative: false,
                text: `Health Check Failed: ${health.error}`,
              })
            }
            return
          }
        } catch (healthErr: unknown) {
          const msg = healthErr instanceof Error ? healthErr.message : String(healthErr)
          console.warn('[useWhisperEngineCheck] healthCheck IPC warning:', msg)
          if (msg.includes('No handler registered')) {
            if (isMountedRef.current) {
              setNativeTestResult({
                latencyMs: 0,
                isNative: false,
                text: 'Cần khởi động lại ứng dụng Electron (nhấn Ctrl+C ở terminal và chạy lại "bun run dev") để nhận diện các IPC handler mới.',
              })
            }
            return
          }
        }

        // 2. Perform test transcription with empty wav header
        const testRes = await whisperPort.transcribe(
          'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
          { modelId: selectedSTT }
        )
        if (isMountedRef.current) {
          setNativeTestResult({
            latencyMs: testRes.latencyMs,
            isNative: testRes.isNative,
            text: testRes.text,
          })
        }
      }
    } catch (err: unknown) {
      console.error('[useWhisperEngineCheck] Error checking native whisper:', err)
      const errStr = err instanceof Error ? err.message : String(err)
      const isUnregistered = errStr.includes('No handler registered')
      if (isMountedRef.current) {
        setNativeTestResult({
          latencyMs: 0,
          isNative: false,
          text: isUnregistered
            ? 'Cần khởi động lại ứng dụng Electron (Ctrl+C và chạy lại "bun run dev") để nạp các IPC handler mới.'
            : errStr,
        })
      }
    } finally {
      if (isMountedRef.current) {
        setIsCheckingNative(false)
      }
    }
  }, [selectedSTT])

  return {
    isCheckingNative,
    nativeTestResult,
    handleCheckNativeEngine,
  }
}

