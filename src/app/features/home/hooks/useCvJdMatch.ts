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
  setIsMatchDialogOpen: (open: boolean) => void
  handleOpenMatchAnalysis: () => Promise<void>
  handleReAnalyzeWithAI: () => Promise<void>
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
  const isMountedRef = useRef(true)

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
        }
      }, 0)
    }
  }, [mode, hasCV, hasJD, cvSummary, jobDescription])

  const handleOpenMatchAnalysis = useCallback(async () => {
    setIsMatchDialogOpen(true)
    if (hasCV && hasJD && (!matchResult || !matchResult.isAI)) {
      setIsAnalyzingMatch(true)
      try {
        const aiRes = await analyzeCvJdMatchWithAI(cvSummary, jobDescription)
        if (isMountedRef.current) {
          setMatchResult(aiRes)
        }
      } catch (err) {
        console.warn('[useCvJdMatch] AI match analysis error:', err)
      } finally {
        if (isMountedRef.current) {
          setIsAnalyzingMatch(false)
        }
      }
    }
  }, [hasCV, hasJD, matchResult, cvSummary, jobDescription])

  const handleReAnalyzeWithAI = useCallback(async () => {
    if (!hasCV || !hasJD) return
    setIsAnalyzingMatch(true)
    try {
      const aiRes = await analyzeCvJdMatchWithAI(cvSummary, jobDescription, true)
      if (isMountedRef.current) {
        setMatchResult(aiRes)
      }
    } catch (err) {
      console.warn('[useCvJdMatch] Re-analyze error:', err)
    } finally {
      if (isMountedRef.current) {
        setIsAnalyzingMatch(false)
      }
    }
  }, [hasCV, hasJD, cvSummary, jobDescription])

  return {
    isMatchDialogOpen,
    matchResult,
    isAnalyzingMatch,
    setIsMatchDialogOpen,
    handleOpenMatchAnalysis,
    handleReAnalyzeWithAI,
  }
}
