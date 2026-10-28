import { useState, useRef, useEffect } from 'react'
import {
  Calendar,
  Clock,
  Cpu,
  Pencil,
  Check,
  X,
  Camera,
  Coins,
  User,
  Briefcase,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MeetingSession } from '@/services/sessionHistory'

export interface DetailHeaderMetaProps {
  currentSession: MeetingSession
  totalTimelineCount: number
  isEditingTitleExternal?: boolean
  onRenameSession?: (id: string, newTitle: string) => void
  onFinishRename?: () => void
}

export function DetailHeaderMeta({
  currentSession,
  totalTimelineCount,
  isEditingTitleExternal,
  onRenameSession,
  onFinishRename,
}: DetailHeaderMetaProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(currentSession.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditTitle(currentSession.title)
  }, [currentSession.title])

  useEffect(() => {
    if (isEditingTitleExternal) {
      setIsEditingTitle(true)
      setEditTitle(currentSession.title)
    }
  }, [isEditingTitleExternal, currentSession.title])

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== currentSession.title) {
      onRenameSession?.(currentSession.id, trimmed)
    } else {
      setEditTitle(currentSession.title)
    }
    setIsEditingTitle(false)
    onFinishRename?.()
  }

  const handleCancelTitle = () => {
    setEditTitle(currentSession.title)
    setIsEditingTitle(false)
    onFinishRename?.()
  }

  return (
    <div className="p-3.5 border-b border-white/[0.06] bg-white/[0.015] space-y-2.5 shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5 max-w-md">
              <input
                ref={inputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveTitle()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelTitle()
                  }
                }}
                onBlur={handleSaveTitle}
                placeholder="Nhập tên phiên họp..."
                className="flex-1 bg-black/60 border border-violet-500/60 rounded px-2 py-0.5 text-[13px] font-semibold text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSaveTitle()
                }}
                className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors shrink-0"
                title="Lưu tên (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleCancelTitle()
                }}
                className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors shrink-0"
                title="Hủy (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setEditTitle(currentSession.title)
                setIsEditingTitle(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditTitle(currentSession.title)
                  setIsEditingTitle(true)
                }
              }}
              title="Bấm vào tiêu đề để sửa tên phiên họp"
              className="group inline-flex items-center gap-1.5 cursor-pointer max-w-full rounded px-1.5 -mx-1.5 py-0.5 hover:bg-white/[0.04] transition-colors"
            >
              <h3 className="text-[14px] font-semibold text-white/95 leading-tight truncate group-hover:text-violet-300 transition-colors">
                {currentSession.title}
              </h3>
              <Pencil className="w-3 h-3 text-white/30 group-hover:text-violet-400 transition-all opacity-0 group-hover:opacity-100 shrink-0" />
            </div>
          )}

          {/* Date, Duration, and AI Model line */}
          <div className="flex items-center gap-2 mt-1 text-[10.5px] text-white/45 truncate">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-2.5 h-2.5 text-white/30" />
              {currentSession.date}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-2.5 h-2.5 text-white/30" />
              {currentSession.durationMinutes} phút
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-violet-300/80 truncate">
              <Cpu className="w-2.5 h-2.5 text-violet-400 shrink-0" />
              {currentSession.aiModel}
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn(
            'text-[9.5px] px-2 py-0.5 border font-medium shrink-0',
            currentSession.mode === 'interview'
              ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          )}
        >
          {currentSession.mode === 'interview' ? 'Chế độ Phỏng Vấn' : 'Chế độ Thảo Luận'}
        </Badge>
      </div>

      {/* Profile Snapshot Strip */}
      {currentSession.profileSnapshot && (
        <div className="p-2 rounded-lg bg-violet-950/20 border border-violet-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-violet-300 font-semibold">
              <User className="w-3 h-3 text-violet-400" />
              Hồ sơ: {currentSession.profileSnapshot.role} ({currentSession.profileSnapshot.name})
            </span>
            {currentSession.profileSnapshot.companyName && (
              <span className="flex items-center gap-1 text-white/60">
                <Briefcase className="w-2.5 h-2.5 text-white/40" />
                {currentSession.profileSnapshot.companyName}
              </span>
            )}
          </div>

          {currentSession.profileSnapshot.keywords && (
            <div className="flex items-center gap-1 flex-wrap">
              {currentSession.profileSnapshot.keywords.slice(0, 4).map((kw) => (
                <span
                  key={kw}
                  className="bg-violet-500/10 text-violet-200 border border-violet-500/20 px-1.5 py-0.2 rounded text-[9px] font-mono"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metrics Strip: Interactions, Questions, Tokens & Cost */}
      <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span>
            Tương tác: <strong className="text-white/80">{totalTimelineCount}</strong>
          </span>
          <span>
            Thoại: <strong className="text-white/80">{(currentSession.transcripts || []).length}</strong>
          </span>
          <span>
            Gợi ý AI: <strong className="text-violet-300">{(currentSession.suggestions || []).length}</strong>
          </span>
          {currentSession.screenshotQuestions && currentSession.screenshotQuestions.length > 0 && (
            <span className="text-cyan-300 flex items-center gap-1">
              <Camera className="w-2.5 h-2.5" />
              {currentSession.screenshotQuestions.length} ảnh
            </span>
          )}
        </div>

        {((currentSession.metrics?.totalTokens && currentSession.metrics.totalTokens > 0) ||
          (currentSession.metrics?.audioDurationSeconds && currentSession.metrics.audioDurationSeconds > 0) ||
          currentSession.metrics?.estimatedCostUsd !== undefined) && (
          <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
            <Coins className="w-3 h-3 text-cyan-400" />
            {currentSession.metrics?.totalTokens && currentSession.metrics.totalTokens > 0 ? (
              <span className="text-cyan-400">{currentSession.metrics.totalTokens.toLocaleString()} tokens</span>
            ) : null}
            {currentSession.metrics?.audioDurationSeconds && currentSession.metrics.audioDurationSeconds > 0 ? (
              <span className="text-white/40">({currentSession.metrics.audioDurationSeconds}s audio)</span>
            ) : null}
            <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
              {currentSession.metrics?.costStatus === 'free'
                ? 'Miễn phí ($0)'
                : currentSession.metrics?.costStatus === 'unknown'
                ? 'Chi phí: Unknown'
                : `~$${(currentSession.metrics?.estimatedCostUsd ?? 0).toFixed(4)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

