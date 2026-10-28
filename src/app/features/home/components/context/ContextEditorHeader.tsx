import React from 'react'
import {
  UserCheck,
  Brain,
  Trash2,
  Check,
  FileCheck,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { ProfilePreset } from '@/services/profile-preset'
import { ProfilePresetBar } from './ProfilePresetBar'

export interface ContextEditorHeaderProps {
  mode: AppMode
  onModeChange?: (mode: AppMode) => void
  hasModeContext: boolean
  onClearContext: () => void
  onSaveContext: () => void
  isContextSaved: boolean
  currentModeTokens: number
  hasCV: boolean
  hasJD: boolean
  matchScore?: number
  onOpenMatchAnalysis?: () => void
  activeProfile?: ProfilePreset | null
  allProfiles?: ProfilePreset[]
  onSelectProfile?: (id: string) => void
  onCreateProfile?: () => void
  onEditProfile?: (preset: ProfilePreset) => void
  onDuplicateProfile?: (id: string) => void
  onDeleteProfile?: (preset: ProfilePreset) => void
  onOpenImportExport?: () => void
  onLoadSampleDiscussion: () => void
  uploadedFileName?: string
  onRemoveUploadedFile?: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  parsingError?: string | null
  onClearParsingError?: () => void
}

export function ContextEditorHeader({
  mode,
  onModeChange,
  hasModeContext,
  onClearContext,
  onSaveContext,
  isContextSaved,
  currentModeTokens,
  hasCV,
  hasJD,
  matchScore,
  onOpenMatchAnalysis,
  activeProfile,
  allProfiles,
  onSelectProfile,
  onCreateProfile,
  onEditProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onOpenImportExport,
  onLoadSampleDiscussion,
  uploadedFileName,
  onRemoveUploadedFile,
  fileInputRef,
  onFileUpload,
  parsingError,
  onClearParsingError,
}: ContextEditorHeaderProps) {
  return (
    <div className="shrink-0 space-y-1">
      {/* Row 1: Title + Centered Mode Switcher + Clear & Save buttons */}
      <div className="pb-1 border-b border-white/[0.05] grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-h-[30px]">
        {/* Left: Card Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              'w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors duration-200',
              mode === 'interview'
                ? 'bg-violet-600/20 border-violet-500/30 text-violet-400'
                : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
            )}
          >
            {mode === 'interview' ? <UserCheck className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
          </div>
          <span
            className="text-[11.5px] text-white/90 font-semibold leading-tight truncate transition-colors duration-200"
            title={mode === 'interview' ? 'Hồ Sơ & CV' : 'Chủ Đề Thảo Luận'}
          >
            {mode === 'interview' ? 'Hồ Sơ & CV' : 'Chủ Đề Thảo Luận'}
          </span>
        </div>

        {/* Center: Mode Switcher */}
        {onModeChange ? (
          <div className="flex items-center justify-center">
            <div className="h-7 flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 shadow-inner shrink-0">
              <button
                type="button"
                id="btn-mode-tab-interview"
                onClick={() => onModeChange('interview')}
                className={cn(
                  'h-full w-[84px] flex items-center justify-center gap-1.5 rounded-md text-[10px] font-medium transition-all duration-200 select-none whitespace-nowrap',
                  mode === 'interview'
                    ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.35)] font-semibold'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                )}
                title="Chế độ Phỏng vấn: Nạp CV & JD để AI đóng vai ứng viên"
              >
                <UserCheck className="w-2.5 h-2.5 shrink-0" />
                <span>Phỏng vấn</span>
              </button>
              <button
                type="button"
                id="btn-mode-tab-discussion"
                onClick={() => onModeChange('discussion')}
                className={cn(
                  'h-full w-[84px] flex items-center justify-center gap-1.5 rounded-md text-[10px] font-medium transition-all duration-200 select-none whitespace-nowrap',
                  mode === 'discussion'
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] font-semibold'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                )}
                title="Chế độ Thảo luận: Điền chủ đề, bài toán kiến trúc cuộc họp"
              >
                <Brain className="w-2.5 h-2.5 shrink-0" />
                <span>Thảo luận</span>
              </button>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-1 min-w-0">
          {hasModeContext && (
            <button
              type="button"
              onClick={onClearContext}
              className="text-[9.5px] text-red-400/70 hover:text-red-300 flex items-center gap-0.5 px-1 py-0.5 whitespace-nowrap transition-colors shrink-0"
              title="Xóa toàn bộ nội dung ngữ cảnh hiện tại"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Xóa</span>
            </button>
          )}
          <Button
            id="btn-save-context"
            size="sm"
            onClick={onSaveContext}
            className={cn(
              'text-[10px] h-6 px-2 font-medium transition-all whitespace-nowrap shadow-sm shrink-0',
              isContextSaved
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            )}
          >
            {isContextSaved ? (
              <>
                <Check className="w-2.5 h-2.5 mr-1" />
                Đã lưu
              </>
            ) : (
              'Lưu context'
            )}
          </Button>
        </div>
      </div>

      {/* Row 2: Subtitle text + Badges & Match analysis */}
      <div className="flex items-center justify-between h-5 gap-1.5 text-[10px]">
        <p
          className="text-white/40 leading-none truncate flex-1 min-w-0"
          title={
            mode === 'interview'
              ? 'Nạp CV & JD để AI phỏng vấn sát với thực tế.'
              : 'Điền chủ đề & tài liệu để AI hỗ trợ thảo luận.'
          }
        >
          {mode === 'interview'
            ? 'Nạp CV & JD để AI phỏng vấn sát với thực tế.'
            : 'Điền chủ đề & tài liệu để AI hỗ trợ thảo luận.'}
        </p>

        <div className="flex items-center gap-1 shrink-0">
          {mode === 'discussion' &&
            (hasModeContext ? (
              <Badge
                variant="outline"
                className="text-[8.5px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 h-4.5 font-mono whitespace-nowrap"
              >
                {currentModeTokens} tokens
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 whitespace-nowrap"
              >
                Chưa có
              </Badge>
            ))}

          {mode === 'interview' && (
            <div className="flex items-center gap-1 text-[8.5px] font-mono whitespace-nowrap">
              {currentModeTokens > 0 ? (
                <Badge
                  variant="outline"
                  className="text-[8.5px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-1.5 py-0.5 h-4.5 font-mono"
                >
                  {currentModeTokens} tokens
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 whitespace-nowrap"
                >
                  Chưa có
                </Badge>
              )}

              {hasCV && hasJD && onOpenMatchAnalysis && (
                <button
                  type="button"
                  id="btn-match-analysis"
                  onClick={onOpenMatchAnalysis}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[8.5px] font-semibold flex items-center gap-1 border shadow-sm transition-all',
                    matchScore !== undefined && matchScore >= 75
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                      : matchScore !== undefined && matchScore >= 50
                      ? 'bg-violet-500/20 text-violet-200 border-violet-500/35 hover:bg-violet-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
                  )}
                  title="Xem chi tiết độ tương thích giữa CV và JD"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  <span>
                    Độ khớp: {matchScore !== undefined ? `${matchScore}%` : 'Kiểm tra'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Preset Toolbar */}
      <div className="shrink-0">
        {mode === 'interview' ? (
          allProfiles &&
          onSelectProfile &&
          onCreateProfile &&
          onEditProfile &&
          onDuplicateProfile &&
          onDeleteProfile &&
          onOpenImportExport ? (
            <ProfilePresetBar
              activeProfile={activeProfile}
              allProfiles={allProfiles}
              onSelectProfile={onSelectProfile}
              onCreateProfile={onCreateProfile}
              onEditProfile={onEditProfile}
              onDuplicateProfile={onDuplicateProfile}
              onDeleteProfile={onDeleteProfile}
              onOpenImportExport={onOpenImportExport}
            />
          ) : null
        ) : (
          <div className="w-full h-8 flex items-center justify-between px-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[10px]">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-white/40">Chủ đề mẫu:</span>
              <button
                type="button"
                onClick={onLoadSampleDiscussion}
                className="text-indigo-300 hover:text-white underline underline-offset-2 transition-colors whitespace-nowrap"
              >
                + Caching & Redis Cluster
              </button>
            </div>
            {uploadedFileName && onRemoveUploadedFile && (
              <div className="flex items-center gap-1 text-[9.5px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded shrink-0">
                <FileCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[120px]">{uploadedFileName}</span>
                <button
                  type="button"
                  onClick={onRemoveUploadedFile}
                  className="text-white/40 hover:text-white/80 ml-0.5"
                  title="Xóa đính kèm"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
        onChange={onFileUpload}
      />

      {/* Parsing error alert */}
      {parsingError && (
        <div className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 flex items-center justify-between text-[9.5px] text-rose-300 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">{parsingError}</span>
          </div>
          {onClearParsingError && (
            <button
              type="button"
              onClick={onClearParsingError}
              className="text-rose-400 hover:text-rose-200 ml-2 shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
