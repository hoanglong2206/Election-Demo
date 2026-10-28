import { useState, useEffect, useRef } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { ProfilePresetSnapshot } from '@/services/profile-preset'
import {
  analyzeCvBackground,
  analyzeDiscussionBackground,
  getCachedCvAnalysis,
  getCachedDiscussionAnalysis,
  prewarmCopilotCache,
} from '@/services/ai-model/copilotResponseService'
import { tieredContextManager } from '@/services/ai-model/copilot'

export interface UseBackgroundAnalysisProps {
  mode: AppMode
  activeCV: string
  activeJD: string
  discussionTopic?: string
  sessionId: string
  profileSnapshot: ProfilePresetSnapshot
}

export interface UseBackgroundAnalysisReturn {
  cvAnalysis: string
  discussionAnalysis: string
  isAnalyzingBackground: boolean
}

export function useBackgroundAnalysis({
  mode,
  activeCV,
  activeJD,
  discussionTopic,
  sessionId,
  profileSnapshot,
}: UseBackgroundAnalysisProps): UseBackgroundAnalysisReturn {
  const isMountedRef = useRef(true)
  const analyzedKeyRef = useRef<string>('')
  const lastWarmedKeyRef = useRef<string>('')

  const [cvAnalysis, setCvAnalysis] = useState<string>(() => {
    return getCachedCvAnalysis(activeCV, activeJD) || ''
  })
  const [discussionAnalysis, setDiscussionAnalysis] = useState<string>(() => {
    return getCachedDiscussionAnalysis(discussionTopic || '') || ''
  })
  const [isAnalyzingBackground, setIsAnalyzingBackground] = useState<boolean>(false)

  // Run background analysis strictly ONCE per unique context key
  useEffect(() => {
    let isCurrent = true
    const currentKey =
      mode === 'interview'
        ? `interview_${activeCV.trim()}:::${activeJD.trim()}`
        : `discussion_${discussionTopic?.trim() || ''}`

    if (analyzedKeyRef.current === currentKey) return
    analyzedKeyRef.current = currentKey

    const runAnalysis = async () => {
      if (mode === 'interview') {
        const cached = getCachedCvAnalysis(activeCV, activeJD)
        if (cached) {
          if (isCurrent) setCvAnalysis(cached)
          return
        }
      } else {
        const cached = getCachedDiscussionAnalysis(discussionTopic || '')
        if (cached) {
          if (isCurrent) setDiscussionAnalysis(cached)
          return
        }
      }

      if (
        (mode === 'interview' && (activeCV || activeJD)) ||
        (mode === 'discussion' && discussionTopic)
      ) {
        if (isCurrent) setIsAnalyzingBackground(true)
        try {
          if (mode === 'interview') {
            const result = await analyzeCvBackground(activeCV, activeJD)
            if (isCurrent) setCvAnalysis(result)
          } else {
            const result = await analyzeDiscussionBackground(discussionTopic || '')
            if (isCurrent) setDiscussionAnalysis(result)
          }
        } catch (err) {
          console.warn('[useBackgroundAnalysis] Background analysis error:', err)
        } finally {
          if (isCurrent) setIsAnalyzingBackground(false)
        }
      }
    }

    runAnalysis()
    return () => {
      isCurrent = false
    }
  }, [mode, activeCV, activeJD, discussionTopic])

  // Synchronize Tier 1 Permanent Context
  useEffect(() => {
    tieredContextManager.setPermanentContext({
      cvSummary: activeCV,
      jobDescription: activeJD,
      role: mode === 'interview' ? profileSnapshot.role : undefined,
      companyName: mode === 'interview' ? profileSnapshot.companyName : undefined,
      customInstructions: mode === 'interview' ? profileSnapshot.customInstructions : undefined,
      presetName: mode === 'interview' ? profileSnapshot.name : undefined,
      discussionTopic,
      meetingObjective: discussionTopic,
      backgroundAnalysis: mode === 'interview' ? cvAnalysis : discussionAnalysis,
    })
  }, [activeCV, activeJD, profileSnapshot, discussionTopic, mode, cvAnalysis, discussionAnalysis])

  // Pre-warm LLM prompt cache when meeting starts with active CV
  useEffect(() => {
    if (mode !== 'interview' || !activeCV || !activeCV.trim()) return
    const warmKey = `${activeCV.trim()}::${activeJD.trim()}`
    if (lastWarmedKeyRef.current === warmKey) return
    lastWarmedKeyRef.current = warmKey

    prewarmCopilotCache({
      cvSummary: activeCV,
      jobDescription: activeJD,
      backgroundAnalysis: cvAnalysis,
      role: profileSnapshot.role,
      companyName: profileSnapshot.companyName,
      customInstructions: profileSnapshot.customInstructions,
      sessionId,
    }).catch(() => {})
  }, [mode, activeCV, activeJD, cvAnalysis, profileSnapshot, sessionId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    cvAnalysis,
    discussionAnalysis,
    isAnalyzingBackground,
  }
}
