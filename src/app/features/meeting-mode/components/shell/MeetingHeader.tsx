import { useState, useRef, useEffect } from 'react'
import { UserCheck, Brain, Save, Check, Mic, Pencil, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { MeetingContextData } from '@/services/meetingContext'
import type { STTQueueMetrics } from '@/services/ai-model/stt'
import type { ResponseLanguage } from '@/services/ai-model/aiModels'
import type { ScreenCaptureState } from '@/services/screen-capture/types'

export interface MeetingHeaderProps {
  mode: AppMode
  sessionTitle?: string
  onSessionTitleChange?: (newTitle: string) => void
  isSavedToHistory: boolean
  onSaveToHistory: () => void
  isCapturing: boolean
  isListening: boolean
  isTranscribing: boolean
  queueMetrics?: STTQueueMetrics
  onToggleListening: () => void
  contextData: MeetingContextData
  hasActiveContext: boolean
  hasDiscussionContext: boolean
  isAnalyzingBackground: boolean
  responseLang: ResponseLanguage
  onResponseLangChange: (lang: ResponseLanguage) => void
  onTriggerScreenCapture?: () => void
  screenCaptureState?: ScreenCaptureState
}

export function MeetingHeader({
  mode,
  sessionTitle,
  onSessionTitleChange,
  isSavedToHistory,
  onSaveToHistory,
  isCapturing: _isCapturing,
  isListening,
  isTranscribing,
  queueMetrics,
  onToggleListening,
  contextData,
  hasActiveContext,
  hasDiscussionContext: _hasDiscussionContext,
  isAnalyzingBackground,
}: MeetingHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(sessionTitle || '')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditedTitle(sessionTitle || '')
  }, [sessionTitle])

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }
  }, [isEditingTitle])

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim()
    if (trimmed && onSessionTitleChange) {
      onSessionTitleChange(trimmed)
    } else {
      setEditedTitle(sessionTitle || '')
    }
    setIsEditingTitle(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      setEditedTitle(sessionTitle || '')
      setIsEditingTitle(false)
    }
  }

  return (
    <header className="flex flex-col border-b border-white/[0.08] bg-black/40 backdrop-blur-md shrink-0">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2">
        {/* Left: Mode Badge & Editable Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge
            variant="outline"
            className={cn(
              'px-2 py-0.5 text-[10px] font-semibold border flex items-center gap-1 shrink-0 rounded-md shadow-sm',
              mode === 'interview'
                ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            )}
          >
            {mode === 'interview' ? <UserCheck className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
            <span>{mode === 'interview' ? 'Phỏng vấn' : 'Thảo luận'}</span>
          </Badge>

          {isEditingTitle ? (
            <div className="flex items-center gap-1 min-w-0 flex-1 max-w-sm">
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveTitle}
                className="w-full bg-white/5 border border-violet-500/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-medium"
                maxLength={60}
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                title="Lưu tiêu đề"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditedTitle(sessionTitle || '')
                  setIsEditingTitle(false)
                }}
                className="text-white/40 hover:text-white/70 p-0.5"
                title="Hủy"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 min-w-0 group cursor-pointer"
              onClick={() => setIsEditingTitle(true)}
              title="Bấm để đổi tên phiên họp"
            >
              <span className="text-xs font-semibold text-white/90 truncate max-w-xs sm:max-w-md">
                {sessionTitle || (mode === 'interview' ? 'Phiên Phỏng Vấn' : 'Phiên Thảo Luận')}
              </span>
              <Pencil className="w-2.5 h-2.5 text-white/30 group-hover:text-white/70 transition-colors shrink-0" />
            </div>
          )}
        </div>

        {/* Right: Actions (Listening Toggle, Save Session) */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            id="btn-toggle-listening"
            size="sm"
            onClick={onToggleListening}
            className={cn(
              'h-7 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all',
              isListening
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            )}
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>{isListening ? 'Dừng nghe' : 'Bắt đầu nghe'}</span>
          </Button>

          <Button
            id="btn-save-session"
            size="sm"
            variant="outline"
            onClick={onSaveToHistory}
            className={cn(
              'h-7 px-2.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5',
              isSavedToHistory
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
            )}
            title="Lưu phiên họp vào Lịch sử"
          >
            {isSavedToHistory ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Đã lưu</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span className="hidden sm:inline">Lưu phiên</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Context & Telemetry Sub-bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-black/20 border-t border-white/[0.04] text-[10px] text-white/40 min-h-[24px]">
        <div className="flex items-center gap-2 truncate">
          {hasActiveContext ? (
            <span className="flex items-center gap-1 text-emerald-400/90 font-medium truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">
                {mode === 'interview'
                  ? 'Ngữ cảnh: CV & JD đã sẵn sàng'
                  : `Ngữ cảnh: ${contextData.discussionTopic || 'Chủ đề thảo luận'}`}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400/80 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>Chưa có ngữ cảnh (AI sẽ phản hồi tổng quát)</span>
            </span>
          )}

          {isAnalyzingBackground && (
            <span className="flex items-center gap-1 text-violet-300 text-[9.5px]">
              <Clock className="w-2.5 h-2.5 animate-spin" />
              <span>Đang phân tích nền...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-[9.5px]">
          {isTranscribing && (
            <span className="flex items-center gap-1 text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              <span>Đang nhận diện...</span>
            </span>
          )}
          {queueMetrics && queueMetrics.queueDepth > 0 && (
            <span className="bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
              Hàng đợi: {queueMetrics.queueDepth}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
