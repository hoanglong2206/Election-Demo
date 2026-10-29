import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import {
  analyzeCvJdMatchHeuristic,
  analyzeCvJdMatchWithAI,
  type CvJdMatchResult,
} from '@/services/ai-model/context'

export interface UseCvJdMatchProps {
  mode: AppMode
  hasCV: boolean
  hasJD: boolean
  cvSummary: string
  jobDescription: string
}

export interface UseCvJdMatchReturn {
  isMatchDialogOpen: boolean
  matchResult: CvJdMatchResult | null
  isAnalyzingMatch: boolean
  analysisError: string | null
  setIsMatchDialogOpen: (open: boolean) => void
  handleOpenMatchAnalysis: () => Promise<void>
  handleReAnalyzeWithAI: () => Promise<void>
  clearAnalysisError: () => void
}

export function useCvJdMatch({
  mode,
  hasCV,
  hasJD,
  cvSummary,
  jobDescription,
}: UseCvJdMatchProps): UseCvJdMatchReturn {
  const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false)
  const [matchResult, setMatchResult] = useState<CvJdMatchResult | null>(null)
  const [isAnalyzingMatch, setIsAnalyzingMatch] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const isMountedRef = useRef(true)
  const matchRequestIdRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Real-time calculation of CV - JD match score (heuristic)
  useEffect(() => {
    if (mode === 'interview' && hasCV && hasJD) {
      const heuristic = analyzeCvJdMatchHeuristic(cvSummary, jobDescription)
      setTimeout(() => {
        if (isMountedRef.current) {
          setMatchResult((prev) => (prev?.isAI ? prev : heuristic))
        }
      }, 0)
    } else {
      setTimeout(() => {
        if (isMountedRef.current) {
          setMatchResult(null)
          setAnalysisError(null)
        }
      }, 0)
    }
  }, [mode, hasCV, hasJD, cvSummary, jobDescription])

  const clearAnalysisError = useCallback(() => {
    setAnalysisError(null)
  }, [])

  const handleOpenMatchAnalysis = useCallback(async () => {
    setIsMatchDialogOpen(true)
    setAnalysisError(null)
    if (hasCV && hasJD && (!matchResult || !matchResult.isAI) && !isAnalyzingMatch) {
      const reqId = ++matchRequestIdRef.current
      setIsAnalyzingMatch(true)
      try {
        const aiRes = await analyzeCvJdMatchWithAI(cvSummary, jobDescription)
        if (isMountedRef.current && reqId === matchRequestIdRef.current) {
          setMatchResult(aiRes)
          if (!aiRes.isAI) {
            setAnalysisError('Không kết nối được AI để phân tích sâu. Đang hiển thị kết quả phân tích nhanh (Heuristic).')
          }
        }
      } catch (err) {
        if (isMountedRef.current && reqId === matchRequestIdRef.current) {
          console.warn('[useCvJdMatch] AI match analysis error:', err)
          setAnalysisError((err as Error)?.message || 'Lỗi khi kết nối dịch vụ AI.')
        }
      } finally {
        if (isMountedRef.current && reqId === matchRequestIdRef.current) {
          setIsAnalyzingMatch(false)
        }
      }
    }
  }, [hasCV, hasJD, matchResult, isAnalyzingMatch, cvSummary, jobDescription])

  const handleReAnalyzeWithAI = useCallback(async () => {
    if (!hasCV || !hasJD || isAnalyzingMatch) return
    const reqId = ++matchRequestIdRef.current
    setIsAnalyzingMatch(true)
    setAnalysisError(null)
    try {
      const aiRes = await analyzeCvJdMatchWithAI(cvSummary, jobDescription, true)
      if (isMountedRef.current && reqId === matchRequestIdRef.current) {
        setMatchResult(aiRes)
        if (!aiRes.isAI) {
          setAnalysisError('AI không phản hồi hoặc gặp lỗi. Đang hiển thị kết quả phân tích nhanh (Heuristic).')
        } else {
          setAnalysisError(null)
        }
      }
    } catch (err) {
      if (isMountedRef.current && reqId === matchRequestIdRef.current) {
        console.warn('[useCvJdMatch] Re-analyze error:', err)
        setAnalysisError((err as Error)?.message || 'Lỗi khi phân tích lại bằng AI.')
      }
    } finally {
      if (isMountedRef.current && reqId === matchRequestIdRef.current) {
        setIsAnalyzingMatch(false)
      }
    }
  }, [hasCV, hasJD, isAnalyzingMatch, cvSummary, jobDescription])

  return {
    isMatchDialogOpen,
    matchResult,
    isAnalyzingMatch,
    analysisError,
    setIsMatchDialogOpen,
    handleOpenMatchAnalysis,
    handleReAnalyzeWithAI,
    clearAnalysisError,
  }
}
