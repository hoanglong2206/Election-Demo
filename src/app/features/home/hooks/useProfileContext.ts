import { useState, useEffect, useRef, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import {
  getSavedMeetingContext,
  saveMeetingContext,
  SAMPLE_JD,
  SAMPLE_CV,
  SAMPLE_DISCUSSION_CONTEXT,
  type MeetingContextData,
} from '@/services/meetingContext'
import { jdKeywordExtractor } from '@/services/ai-model/stt'
import { profileContextService } from '@/services/profile-preset'
import { useLatest } from '@/hooks/useLatest'
import { useProfilePresets, type UseProfilePresetsReturn } from './useProfilePresets'
import { useContextKeywords } from './useContextKeywords'

export interface UseProfileContextProps {
  mode: AppMode
}

export interface UseProfileContextReturn extends UseProfilePresetsReturn {
  contextData: MeetingContextData
  interviewTab: 'cv' | 'jd'
  isContextSaved: boolean
  isParsingDocument: boolean
  parsingError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  setInterviewTab: (tab: 'cv' | 'jd') => void
  setParsingError: (err: string | null) => void
  handleContextChange: (nextData: MeetingContextData) => void
  handleSaveContext: () => void
  handleClearContext: () => void
  handleLoadSampleCV: () => void
  handleLoadSampleJD: () => void
  handleLoadSampleDiscussion: () => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleAddKeyword: (newKw: string) => void
  handleRemoveKeyword: (kwToRemove: string) => void
  handleReExtractKeywords: () => void
  flushPendingContextSync: () => void
}

export function useProfileContext({ mode }: UseProfileContextProps): UseProfileContextReturn {
  const isMountedRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [contextData, setContextData] = useState<MeetingContextData>(getSavedMeetingContext)
  const [interviewTab, setInterviewTab] = useState<'cv' | 'jd'>('cv')
  const [isContextSaved, setIsContextSaved] = useState(false)
  const [isParsingDocument, setIsParsingDocument] = useState(false)
  const [parsingError, setParsingError] = useState<string | null>(null)

  const presets = useProfilePresets()
  const { activeProfile, handleSelectProfile: selectPresetInService } = presets

  const latestContextData = useLatest(contextData)
  const latestActiveProfile = useLatest(activeProfile)

  // Pending sync ref for debounce
  const pendingSyncRef = useRef<{
    timerId?: ReturnType<typeof setTimeout>
    profileId?: string
    data: MeetingContextData
  } | null>(null)

  const flushPendingContextSync = useCallback(() => {
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current.timerId)
      const { profileId, data } = pendingSyncRef.current
      pendingSyncRef.current = null
      saveMeetingContext(data)
      if (profileId) {
        profileContextService.updateProfile(profileId, {
          jobDescription: data.jobDescription,
          resumeContext: data.cvSummary,
          keywords: data.keywords || [],
        })
      }
    }
  }, [])

  // Subscribe to ProfileContextService active profile changes in interview mode
  useEffect(() => {
    const unsub = profileContextService.subscribe((active) => {
      if (!isMountedRef.current || mode !== 'interview') return
      const current = latestContextData.current
      const previousActive = latestActiveProfile.current
      const isDifferentProfile = !previousActive || previousActive.id !== active?.id
      const hasDataDifferences =
        current.jobDescription !== (active ? active.jobDescription : '') ||
        current.cvSummary !== (active ? active.resumeContext : '') ||
        current.interviewTitle !== (active ? active.name : '') ||
        JSON.stringify(current.keywords || []) !==
          JSON.stringify(active ? active.keywords || [] : [])

      if (isDifferentProfile || (!pendingSyncRef.current && hasDataDifferences)) {
        setContextData((prev) => ({
          ...prev,
          jobDescription: active ? active.jobDescription : '',
          cvSummary: active ? active.resumeContext : '',
          keywords: active ? active.keywords : [],
          interviewTitle: active ? active.name : '',
        }))
      }
    })
    return unsub
  }, [mode, latestContextData, latestActiveProfile])

  // Auto-extract keywords if text exists but keywords are empty
  useEffect(() => {
    if (mode === 'interview') {
      if (!contextData.keywords || contextData.keywords.length === 0) {
        if (contextData.jobDescription && contextData.jobDescription.trim()) {
          const extracted = jdKeywordExtractor.extractKeywords(contextData.jobDescription)
          if (extracted.length > 0) {
            const updated = { ...contextData, keywords: extracted }
            setTimeout(() => {
              if (isMountedRef.current) {
                setContextData(updated)
                saveMeetingContext(updated)
                if (latestActiveProfile.current) {
                  profileContextService.updateProfile(latestActiveProfile.current.id, {
                    keywords: extracted,
                  })
                }
              }
            }, 0)
          }
        }
      }
    } else {
      if (!contextData.discussionKeywords || contextData.discussionKeywords.length === 0) {
        if (contextData.discussionTopic && contextData.discussionTopic.trim()) {
          const extracted = jdKeywordExtractor.extractKeywords(contextData.discussionTopic)
          if (extracted.length > 0) {
            const updated = { ...contextData, discussionKeywords: extracted }
            setTimeout(() => {
              if (isMountedRef.current) {
                setContextData(updated)
                saveMeetingContext(updated)
              }
            }, 0)
          }
        }
      }
    }
  }, [mode, contextData, latestActiveProfile])

  const handleContextChange = useCallback(
    (nextData: MeetingContextData) => {
      let finalData = nextData
      if (
        (!finalData.keywords || finalData.keywords.length === 0) &&
        mode === 'interview' &&
        finalData.jobDescription &&
        finalData.jobDescription !== contextData.jobDescription
      ) {
        const extracted = jdKeywordExtractor.extractKeywords(finalData.jobDescription)
        finalData = { ...finalData, keywords: extracted }
      } else if (
        (!finalData.discussionKeywords || finalData.discussionKeywords.length === 0) &&
        mode === 'discussion' &&
        finalData.discussionTopic &&
        finalData.discussionTopic !== contextData.discussionTopic
      ) {
        const extracted = jdKeywordExtractor.extractKeywords(finalData.discussionTopic)
        finalData = { ...finalData, discussionKeywords: extracted }
      }

      setContextData(finalData)

      if (pendingSyncRef.current?.timerId) {
        clearTimeout(pendingSyncRef.current.timerId)
      }

      const targetProfileId = mode === 'interview' ? latestActiveProfile.current?.id : undefined
      const timerId = setTimeout(() => {
        if (!isMountedRef.current) return
        pendingSyncRef.current = null
        saveMeetingContext(finalData)
        if (targetProfileId) {
          profileContextService.updateProfile(targetProfileId, {
            jobDescription: finalData.jobDescription,
            resumeContext: finalData.cvSummary,
            keywords: finalData.keywords || [],
          })
        }
      }, 300)

      pendingSyncRef.current = {
        timerId,
        profileId: targetProfileId,
        data: finalData,
      }
    },
    [mode, contextData.jobDescription, contextData.discussionTopic, latestActiveProfile]
  )

  const handleSaveContext = useCallback(() => {
    flushPendingContextSync()
    saveMeetingContext(contextData)
    if (mode === 'interview' && activeProfile) {
      profileContextService.updateProfile(activeProfile.id, {
        jobDescription: contextData.jobDescription,
        resumeContext: contextData.cvSummary,
        keywords: contextData.keywords || [],
      })
    }
    setIsContextSaved(true)
    setTimeout(() => {
      if (isMountedRef.current) setIsContextSaved(false)
    }, 2000)
  }, [contextData, mode, activeProfile, flushPendingContextSync])

  const handleClearContext = useCallback(() => {
    flushPendingContextSync()
    if (mode === 'interview') {
      const updated = {
        ...contextData,
        jobDescription: '',
        cvSummary: '',
        keywords: [],
      }
      setContextData(updated)
      saveMeetingContext(updated)
      if (activeProfile) {
        profileContextService.updateProfile(activeProfile.id, {
          jobDescription: '',
          resumeContext: '',
          keywords: [],
        })
      }
    } else {
      const updated = {
        ...contextData,
        discussionTopic: '',
        discussionKeywords: [],
      }
      setContextData(updated)
      saveMeetingContext(updated)
    }
  }, [contextData, mode, activeProfile, flushPendingContextSync])

  const handleLoadSampleCV = useCallback(() => {
    const updated = { ...contextData, cvSummary: SAMPLE_CV }
    setContextData(updated)
    saveMeetingContext(updated)
    if (mode === 'interview' && activeProfile) {
      profileContextService.updateProfile(activeProfile.id, {
        resumeContext: SAMPLE_CV,
      })
    }
    setIsContextSaved(true)
    setTimeout(() => {
      if (isMountedRef.current) setIsContextSaved(false)
    }, 1500)
  }, [contextData, mode, activeProfile])

  const handleLoadSampleJD = useCallback(() => {
    const extractedKeywords = jdKeywordExtractor.extractKeywords(SAMPLE_JD)
    const updated = {
      ...contextData,
      jobDescription: SAMPLE_JD,
      keywords: extractedKeywords,
    }
    setContextData(updated)
    saveMeetingContext(updated)
    if (mode === 'interview' && activeProfile) {
      profileContextService.updateProfile(activeProfile.id, {
        jobDescription: SAMPLE_JD,
        keywords: extractedKeywords,
      })
    }
    setIsContextSaved(true)
    setTimeout(() => {
      if (isMountedRef.current) setIsContextSaved(false)
    }, 1500)
  }, [contextData, mode, activeProfile])

  const handleLoadSampleDiscussion = useCallback(() => {
    const extractedKeywords = jdKeywordExtractor.extractKeywords(SAMPLE_DISCUSSION_CONTEXT)
    const updated = {
      ...contextData,
      discussionTopic: SAMPLE_DISCUSSION_CONTEXT,
      discussionKeywords: extractedKeywords,
    }
    setContextData(updated)
    saveMeetingContext(updated)
    setIsContextSaved(true)
    setTimeout(() => {
      if (isMountedRef.current) setIsContextSaved(false)
    }, 1500)
  }, [contextData])

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setIsParsingDocument(true)
      setParsingError(null)

      try {
        const { parseDocumentFile } = await import('@/services/documentParser')
        const parsed = await parseDocumentFile(file)
        const content = parsed.text.length > 15000 ? parsed.text.slice(0, 15000) : parsed.text
        const fileBadge = `${file.name}${parsed.pageCount ? ` (${parsed.pageCount} trang)` : ''}`

        let updated: MeetingContextData
        if (mode === 'discussion') {
          const extracted = jdKeywordExtractor.extractKeywords(content)
          updated = {
            ...contextData,
            discussionTopic: content,
            uploadedFileName: fileBadge,
            discussionKeywords: extracted,
          }
        } else if (interviewTab === 'jd') {
          const extracted = jdKeywordExtractor.extractKeywords(content)
          updated = {
            ...contextData,
            jobDescription: content,
            keywords: extracted,
          }
          if (activeProfile) {
            profileContextService.updateProfile(activeProfile.id, {
              jobDescription: content,
              keywords: extracted,
            })
          }
        } else {
          updated = {
            ...contextData,
            cvSummary: content,
            uploadedFileName: fileBadge,
          }
          if (activeProfile) {
            profileContextService.updateProfile(activeProfile.id, {
              resumeContext: content,
            })
          }
        }

        if (isMountedRef.current) {
          setContextData(updated)
          saveMeetingContext(updated)
          setIsContextSaved(true)
          setTimeout(() => {
            if (isMountedRef.current) setIsContextSaved(false)
          }, 2000)
        }
      } catch (err: unknown) {
        console.error('[useProfileContext] Failed to parse document:', err)
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : String(err)
          setParsingError(msg || 'Không thể đọc nội dung file. Vui lòng kiểm tra lại định dạng.')
        }
      } finally {
        if (isMountedRef.current) {
          setIsParsingDocument(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
      }
    },
    [contextData, mode, interviewTab, activeProfile]
  )

  const { handleAddKeyword, handleRemoveKeyword, handleReExtractKeywords } = useContextKeywords({
    mode,
    contextData,
    activeProfile,
    setContextData,
  })

  const handleSelectProfile = useCallback(
    (id: string) => {
      flushPendingContextSync()
      const updated = selectPresetInService(id)
      if (updated) {
        setContextData((prev) => ({
          ...prev,
          jobDescription: updated.jobDescription,
          cvSummary: updated.resumeContext,
          keywords: updated.keywords,
          interviewTitle: updated.name,
        }))
      }
      return updated
    },
    [flushPendingContextSync, selectPresetInService]
  )

  return {
    ...presets,
    contextData,
    interviewTab,
    isContextSaved,
    isParsingDocument,
    parsingError,
    fileInputRef,
    setInterviewTab,
    setParsingError,
    handleContextChange,
    handleSaveContext,
    handleClearContext,
    handleLoadSampleCV,
    handleLoadSampleJD,
    handleLoadSampleDiscussion,
    handleFileUpload,
    handleAddKeyword,
    handleRemoveKeyword,
    handleReExtractKeywords,
    flushPendingContextSync,
    handleSelectProfile,
  }
}
