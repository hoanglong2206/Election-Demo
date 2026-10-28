import { useState, useRef, useCallback, useEffect } from 'react'
import type { StreamingState } from '../types'
import {
  generateInterviewAnswerStream,
  type GenerateInterviewAnswerParams,
  type InterviewStreamInit,
} from '@/services/ai-model/copilot/interview'
import type { CopilotInterviewResult } from '@/services/ai-model/copilot/types'
import type { GateDecision } from '@/services/ai-model/intent'

export type StreamingAnswerCallbacks = {
  onInit?: (init: InterviewStreamInit) => void
  onFirstToken?: (ttftMs: number) => void
  onDelta?: (delta: string, currentFullText: string) => void
  onDone?: (result: CopilotInterviewResult) => void
  onError?: (error: Error, partialText: string) => void
  onGateDecision?: (decision: GateDecision) => void
}

export interface UseStreamingAnswerReturn {
  streamingState: StreamingState
  streamedContent: string
  ttftMs: number | null
  totalDurationMs: number | null
  error: string | null
  activeRequestId: string | null
  startStream: (
    params: GenerateInterviewAnswerParams,
    callbacks?: StreamingAnswerCallbacks
  ) => Promise<void>
  cancelStream: () => void
  reset: () => void
}

export function useStreamingAnswer(): UseStreamingAnswerReturn {
  const [streamingState, setStreamingState] = useState<StreamingState>('idle')
  const [streamedContent, setStreamedContent] = useState<string>('')
  const [ttftMs, setTtftMs] = useState<number | null>(null)
  const [totalDurationMs, setTotalDurationMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)

  const activeRequestIdRef = useRef<string | null>(null)
  const accumulatedTextRef = useRef<string>('')
  const cancelActiveStreamRef = useRef<(() => void) | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const streamStartTimeRef = useRef<number>(0)

  // Flush accumulated text via requestAnimationFrame
  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      setStreamedContent(accumulatedTextRef.current)
      rafIdRef.current = null
    })
  }, [])

  const cancelStream = useCallback(() => {
    if (cancelActiveStreamRef.current) {
      cancelActiveStreamRef.current()
      cancelActiveStreamRef.current = null
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (streamingState === 'connecting' || streamingState === 'streaming') {
      setStreamingState('interrupted')
      setStreamedContent(accumulatedTextRef.current)
    }
  }, [streamingState])

  const reset = useCallback(() => {
    cancelStream()
    activeRequestIdRef.current = null
    accumulatedTextRef.current = ''
    setActiveRequestId(null)
    setStreamingState('idle')
    setStreamedContent('')
    setTtftMs(null)
    setTotalDurationMs(null)
    setError(null)
  }, [cancelStream])

  const startStream = useCallback(
    async (
      params: GenerateInterviewAnswerParams,
      callbacks?: StreamingAnswerCallbacks
    ) => {
      // 1. Cancel previous stream if active
      if (cancelActiveStreamRef.current) {
        cancelActiveStreamRef.current()
        cancelActiveStreamRef.current = null
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      activeRequestIdRef.current = requestId
      accumulatedTextRef.current = ''
      streamStartTimeRef.current = performance.now()

      setActiveRequestId(requestId)
      setStreamingState('connecting')
      setStreamedContent('')
      setTtftMs(null)
      setTotalDurationMs(null)
      setError(null)

      try {
        const cancelFn = await generateInterviewAnswerStream(params, {
          onInit: (init) => {
            if (activeRequestIdRef.current !== requestId) return
            callbacks?.onInit?.(init)
          },
          onFirstToken: (tokenTtft) => {
            if (activeRequestIdRef.current !== requestId) return
            setTtftMs(tokenTtft)
            setStreamingState('streaming')
            callbacks?.onFirstToken?.(tokenTtft)
          },
          onGateDecision: (decision) => {
            if (activeRequestIdRef.current !== requestId) return
            callbacks?.onGateDecision?.(decision)
          },
          onDelta: (delta) => {
            if (activeRequestIdRef.current !== requestId) return
            accumulatedTextRef.current += delta
            scheduleFlush()
            callbacks?.onDelta?.(delta, accumulatedTextRef.current)
          },
          onDone: (result) => {
            if (activeRequestIdRef.current !== requestId) return
            if (rafIdRef.current !== null) {
              cancelAnimationFrame(rafIdRef.current)
              rafIdRef.current = null
            }
            const duration = Math.round(performance.now() - streamStartTimeRef.current)
            setTotalDurationMs(duration)
            setStreamedContent(result.content)
            setStreamingState('done')
            callbacks?.onDone?.(result)
          },
          onError: (err, partialText) => {
            if (activeRequestIdRef.current !== requestId) return
            if (rafIdRef.current !== null) {
              cancelAnimationFrame(rafIdRef.current)
              rafIdRef.current = null
            }
            const isGateAbort = err.message?.includes('Intent Gate')
            if (isGateAbort) {
              // Zero UI flicker: do not render anything to UI, reset state to idle
              accumulatedTextRef.current = ''
              setStreamedContent('')
              setError(null)
              setStreamingState('idle')
              callbacks?.onError?.(err, '')
              return
            }
            const fallback = accumulatedTextRef.current || partialText
            setStreamedContent(fallback)
            setError(err.message)
            setStreamingState(fallback.trim() ? 'interrupted' : 'error')
            callbacks?.onError?.(err, fallback)
          },
        })

        if (activeRequestIdRef.current === requestId) {
          cancelActiveStreamRef.current = cancelFn
        } else {
          cancelFn()
        }
      } catch (err: unknown) {
        if (activeRequestIdRef.current === requestId) {
          const message = err instanceof Error ? err.message : 'Lỗi khi khởi chạy luồng stream'
          setError(message)
          setStreamingState('error')
          callbacks?.onError?.(err instanceof Error ? err : new Error(message), '')
        }
      }
    },
    [scheduleFlush]
  )

  useEffect(() => {
    return () => {
      if (cancelActiveStreamRef.current) {
        cancelActiveStreamRef.current()
        cancelActiveStreamRef.current = null
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  return {
    streamingState,
    streamedContent,
    ttftMs,
    totalDurationMs,
    error,
    activeRequestId,
    startStream,
    cancelStream,
    reset,
  }
}
