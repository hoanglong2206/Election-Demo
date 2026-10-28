import React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { MeetingContextData } from '@/services/meeting-context'
import type { ProfilePreset } from '@/services/profile-preset'
import { ContextEditorHeader } from './ContextEditorHeader'
import { ContextEditorTabsBar } from './ContextEditorTabsBar'
import { InterviewContextTab } from './InterviewContextTab'
import { DiscussionContextTab } from './DiscussionContextTab'

export interface ContextEditorCardProps {
  mode: AppMode
  onModeChange?: (mode: AppMode) => void
  contextData: MeetingContextData
  interviewTab: 'cv' | 'jd'
  isContextSaved: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  cvTokens: number
  jdTokens: number
  discussionTokens: number
  currentModeTokens: number
  hasModeContext: boolean
  hasCV: boolean
  hasJD: boolean
  isParsingDocument?: boolean
  parsingError?: string | null
  matchScore?: number
  onClearParsingError?: () => void
  onOpenMatchAnalysis?: () => void
  onInterviewTabChange: (tab: 'cv' | 'jd') => void
  onContextChange: (data: MeetingContextData) => void
  onSaveContext: () => void
  onClearContext: () => void
  onLoadSampleCV: () => void
  onLoadSampleJD: () => void
  onLoadSampleDiscussion: () => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAddKeyword?: (kw: string) => void
  onRemoveKeyword?: (kw: string) => void
  onReExtractKeywords?: () => void
  activeProfile?: ProfilePreset | null
  allProfiles?: ProfilePreset[]
  onSelectProfile?: (id: string) => void
  onCreateProfile?: () => void
  onEditProfile?: (preset: ProfilePreset) => void
  onDuplicateProfile?: (id: string) => void
  onDeleteProfile?: (preset: ProfilePreset) => void
  onOpenImportExport?: () => void
  className?: string
}

export function ContextEditorCard({
  className,
  mode,
  onModeChange,
  contextData,
  interviewTab,
  isContextSaved,
  fileInputRef,
  cvTokens,
  jdTokens,
  discussionTokens,
  currentModeTokens,
  hasModeContext,
  hasCV,
  hasJD,
  isParsingDocument = false,
  parsingError = null,
  matchScore,
  onClearParsingError,
  onOpenMatchAnalysis,
  onInterviewTabChange,
  onContextChange,
  onSaveContext,
  onClearContext,
  onLoadSampleCV,
  onLoadSampleJD,
  onLoadSampleDiscussion,
  onFileUpload,
  onAddKeyword,
  onRemoveKeyword,
  onReExtractKeywords,
  activeProfile,
  allProfiles,
  onSelectProfile,
  onCreateProfile,
  onEditProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onOpenImportExport,
}: ContextEditorCardProps) {
  const handleTriggerFileUpload = () => {
    void import('@/services/documentParser')
    fileInputRef.current?.click()
  }

  const handleRemoveUploadedFile = () => {
    onContextChange({
      ...contextData,
      uploadedFileName: undefined,
    })
  }

  return (
    <Card
      className={cn(
        'bg-zinc-950/40 border border-white/[0.08] backdrop-blur-sm rounded-xl p-2.5 flex flex-col justify-between min-w-0 overflow-hidden shadow-sm gap-1.5',
        className
      )}
    >
      {/* ── Top Header Section (Shrink-0) ── */}
      <ContextEditorHeader
        mode={mode}
        onModeChange={onModeChange}
        hasModeContext={hasModeContext}
        onClearContext={onClearContext}
        onSaveContext={onSaveContext}
        isContextSaved={isContextSaved}
        currentModeTokens={currentModeTokens}
        hasCV={hasCV}
        hasJD={hasJD}
        matchScore={matchScore}
        onOpenMatchAnalysis={onOpenMatchAnalysis}
        activeProfile={activeProfile}
        allProfiles={allProfiles}
        onSelectProfile={onSelectProfile}
        onCreateProfile={onCreateProfile}
        onEditProfile={onEditProfile}
        onDuplicateProfile={onDuplicateProfile}
        onDeleteProfile={onDeleteProfile}
        onOpenImportExport={onOpenImportExport}
        onLoadSampleDiscussion={onLoadSampleDiscussion}
        uploadedFileName={contextData.uploadedFileName}
        onRemoveUploadedFile={handleRemoveUploadedFile}
        fileInputRef={fileInputRef}
        onFileUpload={onFileUpload}
        parsingError={parsingError}
        onClearParsingError={onClearParsingError}
      />

      {/* Row 4: Tabs / Sub-actions */}
      <ContextEditorTabsBar
        mode={mode}
        interviewTab={interviewTab}
        hasCV={hasCV}
        hasJD={hasJD}
        cvTokens={cvTokens}
        jdTokens={jdTokens}
        keywordsCount={contextData.keywords?.length}
        discussionTokens={discussionTokens}
        isParsingDocument={isParsingDocument}
        onInterviewTabChange={onInterviewTabChange}
        onLoadSampleCV={onLoadSampleCV}
        onLoadSampleJD={onLoadSampleJD}
        onTriggerFileUpload={handleTriggerFileUpload}
      />

      {/* ── Middle Editor Area ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {mode === 'interview' ? (
          <InterviewContextTab
            interviewTab={interviewTab}
            contextData={contextData}
            cvTokens={cvTokens}
            jdTokens={jdTokens}
            hasCV={hasCV}
            hasJD={hasJD}
            isParsingDocument={isParsingDocument}
            onContextChange={onContextChange}
            onAddKeyword={onAddKeyword}
            onRemoveKeyword={onRemoveKeyword}
            onReExtractKeywords={onReExtractKeywords}
            onTriggerFileUpload={handleTriggerFileUpload}
            onLoadSampleCV={onLoadSampleCV}
            onLoadSampleJD={onLoadSampleJD}
          />
        ) : (
          <DiscussionContextTab
            contextData={contextData}
            discussionTokens={discussionTokens}
            onContextChange={onContextChange}
            onAddKeyword={onAddKeyword}
            onRemoveKeyword={onRemoveKeyword}
            onReExtractKeywords={onReExtractKeywords}
          />
        )}
      </div>

      {/* ── Footnote Area (Shrink-0) ── */}
      <div className="pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[9.5px] shrink-0">
        <span className="text-white/40 truncate flex-1 min-w-0 pr-2">
          {hasModeContext ? (
            <span className="text-emerald-400/90 flex items-center gap-1.5 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="truncate">
                {mode === 'interview'
                  ? 'AI đã sẵn sàng cá nhân hóa câu trả lời theo hồ sơ CV của bạn'
                  : 'AI đã nạp chủ đề thảo luận để đưa ra giải pháp sát bài toán'}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <span>Chưa nạp context (AI sẽ phản hồi ở mức tổng quát)</span>
            </span>
          )}
        </span>
        <span className="text-white/35 font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] shrink-0">
          {mode === 'interview' ? 'Chế độ: Phỏng vấn' : 'Chế độ: Thảo luận'}
        </span>
      </div>
    </Card>
  )
}
