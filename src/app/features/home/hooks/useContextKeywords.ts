import { useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import { type MeetingContextData, saveMeetingContext } from '@/services/meetingContext'
import { jdKeywordExtractor } from '@/services/ai-model/stt'
import { profileContextService, type ProfilePreset } from '@/services/profile-preset'

export interface UseContextKeywordsProps {
  mode: AppMode
  contextData: MeetingContextData
  activeProfile: ProfilePreset | null
  setContextData: React.Dispatch<React.SetStateAction<MeetingContextData>>
}

export interface UseContextKeywordsReturn {
  handleAddKeyword: (newKw: string) => void
  handleRemoveKeyword: (kwToRemove: string) => void
  handleReExtractKeywords: () => void
}

export function useContextKeywords({
  mode,
  contextData,
  activeProfile,
  setContextData,
}: UseContextKeywordsProps): UseContextKeywordsReturn {
  const handleAddKeyword = useCallback(
    (newKw: string) => {
      const normalized = jdKeywordExtractor.normalizeKeyword(newKw)
      if (!normalized) return
      if (mode === 'interview') {
        const current = contextData.keywords || []
        if (current.some((k) => k.toLowerCase() === normalized.toLowerCase())) return
        const updated = {
          ...contextData,
          keywords: [...current, normalized],
        }
        setContextData(updated)
        saveMeetingContext(updated)
        if (activeProfile) {
          profileContextService.updateProfile(activeProfile.id, {
            keywords: updated.keywords,
          })
        }
      } else {
        const current = contextData.discussionKeywords || []
        if (current.some((k) => k.toLowerCase() === normalized.toLowerCase())) return
        const updated = {
          ...contextData,
          discussionKeywords: [...current, normalized],
        }
        setContextData(updated)
        saveMeetingContext(updated)
      }
    },
    [contextData, mode, activeProfile, setContextData]
  )

  const handleRemoveKeyword = useCallback(
    (kwToRemove: string) => {
      if (mode === 'interview') {
        const current = contextData.keywords || []
        const updatedKeywords = current.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase())
        const updated = {
          ...contextData,
          keywords: updatedKeywords,
        }
        setContextData(updated)
        saveMeetingContext(updated)
        if (activeProfile) {
          profileContextService.updateProfile(activeProfile.id, {
            keywords: updatedKeywords,
          })
        }
      } else {
        const current = contextData.discussionKeywords || []
        const updatedKeywords = current.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase())
        const updated = {
          ...contextData,
          discussionKeywords: updatedKeywords,
        }
        setContextData(updated)
        saveMeetingContext(updated)
      }
    },
    [contextData, mode, activeProfile, setContextData]
  )

  const handleReExtractKeywords = useCallback(() => {
    if (mode === 'interview') {
      const targetText = contextData.jobDescription || ''
      if (!targetText.trim()) return
      const extracted = jdKeywordExtractor.extractKeywords(targetText)
      const updated = {
        ...contextData,
        keywords: extracted,
      }
      setContextData(updated)
      saveMeetingContext(updated)
      if (activeProfile) {
        profileContextService.updateProfile(activeProfile.id, {
          keywords: extracted,
        })
      }
    } else {
      const targetText = contextData.discussionTopic || ''
      if (!targetText.trim()) return
      const extracted = jdKeywordExtractor.extractKeywords(targetText)
      const updated = {
        ...contextData,
        discussionKeywords: extracted,
      }
      setContextData(updated)
      saveMeetingContext(updated)
    }
  }, [contextData, mode, activeProfile, setContextData])

  return {
    handleAddKeyword,
    handleRemoveKeyword,
    handleReExtractKeywords,
  }
}
