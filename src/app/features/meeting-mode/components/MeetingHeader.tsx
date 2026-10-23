import { useState, useRef, useEffect } from 'react'
import { UserCheck, Brain, Save, Check, Mic, Pencil, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { MeetingContextData } from '../../../services/meetingContext'
import type { STTQueueMetrics } from '../../../services/ai-model/stt'
import {
  type ResponseLanguage,
} from '../../../services/ai-model/aiModels'
import type { ScreenCaptureState } from '../../../services/screen-capture/types'

interface MeetingHeaderProps {
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
  isCapturing,
  isListening,
  isTranscribing,
  queueMetrics,
  onToggleListening,
  contextData,
  hasActiveContext,
  hasDiscussionContext,
  isAnalyzingBackground,
}: MeetingHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState(sessionTitle || '')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleSaveTitle = () => {
    const trimmed = tempTitle.trim()
    if (trimmed && trimmed !== sessionTitle) {
      onSessionTitleChange?.(trimmed)
    } else if (sessionTitle) {
      setTempTitle(sessionTitle)
    }
    setIsEditingTitle(false)
  }

  const handleCancelTitle = () => {
    if (sessionTitle) {
      setTempTitle(sessionTitle)
    }
    setIsEditingTitle(false)
  }

  return (
    <>
      {/* ── Local Header (Row 1: Mode & Meeting Session Controls) ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.07] bg-white/[0.01] shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border shrink-0',
              mode === 'interview'
                ? 'bg-violet-600/15 border-violet-500/30 text-violet-300'
                : 'bg-indigo-600/15 border-indigo-500/30 text-indigo-300'
            )}
          >
            {mode === 'interview' ? (
              <UserCheck className="w-3.5 h-3.5 text-violet-400" />
            ) : (
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>
              {mode === 'interview'
                ? 'Chế độ: Phỏng Vấn (Interview)'
                : 'Chế độ: Thảo Luận (Discussion)'}
            </span>
          </div>

          {sessionTitle && (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-white/20 text-xs shrink-0">|</span>
              {isEditingTitle ? (
                <div className="flex items-center gap-1 min-w-0 flex-1 max-w-sm">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
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
                    placeholder="Tên phiên họp (ví dụ: Phỏng vấn Senior Fullstack)..."
                    className="bg-black/60 border border-violet-500/60 rounded px-2.5 py-0.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-400 w-full min-w-[120px] max-w-xs"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSaveTitle()
                    }}
                    className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded shrink-0 transition-colors"
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
                    className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded shrink-0 transition-colors"
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
                    setTempTitle(sessionTitle)
                    setIsEditingTitle(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setTempTitle(sessionTitle)
                      setIsEditingTitle(true)
                    }
                  }}
                  className="group flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/[0.04] cursor-pointer transition-colors max-w-[260px] sm:max-w-xs md:max-w-md min-w-0"
                  title="Bấm vào tiêu đề để sửa tên phiên họp"
                >
                  <span className="text-[11px] font-medium text-white/80 group-hover:text-violet-300 truncate">
                    {sessionTitle}
                  </span>
                  <Pencil className="w-2.5 h-2.5 text-white/30 group-hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meeting Controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Save session button */}
          <Button
            id="btn-save-session-meeting"
            size="sm"
            variant="outline"
            onClick={onSaveToHistory}
            className={cn(
              'h-6 text-[10px] px-2 gap-1 border transition-all',
              isSavedToHistory
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            )}
            title="Lưu bản ghi cuộc họp này vào Session History"
          >
            {isSavedToHistory ? (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-400" />
                <span>Đã lưu!</span>
              </>
            ) : (
              <>
                <Save className="w-2.5 h-2.5 text-violet-400" />
                <span>Lưu buổi họp</span>
              </>
            )}
          </Button>

          {/* ── LIVE WAVEFORM LISTENING BADGE ── */}
          {isCapturing && isListening ? (
            <Badge
              className={cn(
                'text-[10px] px-2 py-0.5 h-6 border font-medium flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
                isTranscribing
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/35'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              )}
              variant="outline"
              title={
                isTranscribing
                  ? 'Đang chuyển đổi giọng nói thành văn bản qua Whisper...'
                  : 'Đang lắng nghe âm thanh cuộc gọi theo thời gian thực'
              }
            >
              <div className="flex items-center gap-0.5 h-3.5 px-0.5">
                <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-1" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-2" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-3" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-4" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-5" />
              </div>
              <span className="font-semibold text-[10.5px]">
                {isTranscribing ? 'Transcribing...' : 'Listening'}
              </span>
            </Badge>
          ) : (
            <Badge
              className="text-[10px] px-2 py-0.5 h-6 bg-white/5 text-white/40 border-white/10 font-medium flex items-center gap-1.5"
              variant="outline"
              title="Đã tạm dừng thu âm"
            >
              <div className="flex items-center gap-0.5 h-3.5 px-0.5">
                <span className="w-0.5 h-1 bg-white/30 rounded-full" />
                <span className="w-0.5 h-1 bg-white/30 rounded-full" />
                <span className="w-0.5 h-1 bg-white/30 rounded-full" />
                <span className="w-0.5 h-1 bg-white/30 rounded-full" />
                <span className="w-0.5 h-1 bg-white/30 rounded-full" />
              </div>
              <span className="text-[10.5px]">Paused</span>
            </Badge>
          )}

          {/* ── STT QUEUE TELEMETRY BADGE ── */}
          {queueMetrics && queueMetrics.queueDepth > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 h-6 bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono flex items-center gap-1.5 animate-pulse"
              title={`STT Job Queue: ${queueMetrics.queueDepth} job đang chờ xử lý | Workers: ${queueMetrics.processingJobs}/${queueMetrics.concurrency} | Chờ TB: ${queueMetrics.averageWaitTime}ms | Bỏ qua: ${queueMetrics.droppedJobs}`}
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>STT Queue: {queueMetrics.queueDepth} {queueMetrics.queueDepth === 1 ? 'job' : 'jobs'}</span>
            </Badge>
          )}

          <Button
            id="btn-mic"
            variant="ghost"
            size="icon"
            onClick={onToggleListening}
            className={cn(
              'w-6 h-6 rounded-md transition-colors',
              isCapturing && isListening
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            )}
            title={isCapturing && isListening ? 'Bấm để tạm dừng nghe' : 'Bấm để tiếp tục nghe'}
          >
            <Mic className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── SECONDARY ROW ── */}
      <div
        className={cn(
          'px-4 py-1.5 border-b flex items-center justify-between text-[11px] transition-colors shrink-0',
          mode === 'discussion'
            ? hasDiscussionContext
              ? 'bg-gradient-to-r from-indigo-950/50 via-violet-950/30 to-black/30 border-indigo-500/25'
              : 'bg-white/[0.02] border-white/[0.05]'
            : hasActiveContext
              ? 'bg-gradient-to-r from-violet-950/50 via-indigo-950/30 to-black/30 border-violet-500/25'
              : 'bg-white/[0.02] border-white/[0.05]'
        )}
      >
        {/* Left: Context / Topic */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
          <div
            className={cn(
              'w-5 h-5 rounded-md flex items-center justify-center shrink-0 border',
              mode === 'discussion'
                ? hasDiscussionContext
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-white/40'
                : hasActiveContext
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-white/5 border-white/10 text-white/40'
            )}
          >
            {mode === 'discussion' ? (
              <Brain className="w-3 h-3" />
            ) : (
              <UserCheck className="w-3 h-3" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider shrink-0',
                mode === 'discussion' ? 'text-indigo-300' : 'text-violet-300'
              )}
            >
              {mode === 'discussion' ? 'Chủ đề thảo luận:' : 'Hồ sơ phỏng vấn:'}
            </span>
            <span className="text-[11.5px] text-white/95 font-medium truncate">
              {mode === 'discussion'
                ? hasDiscussionContext
                  ? contextData.discussionTopic?.split('\n')[0].replace(/^Chủ đề:\s*/i, '') ||
                    'Bài toán thảo luận kỹ thuật'
                  : 'Chưa nạp chủ đề (AI đang hỗ trợ thảo luận kỹ thuật tổng quát)'
                : hasActiveContext
                ? contextData.interviewTitle ||
                  contextData.jobDescription?.split('\n')[0].replace(/^Vị trí:\s*/i, '').trim() ||
                  (contextData.uploadedFileName ? `CV: ${contextData.uploadedFileName}` : '') ||
                  'Đã nạp CV ứng viên & JD tuyển dụng'
                : 'Chưa nạp CV & JD (AI hỗ trợ phỏng vấn tổng quát)'}
            </span>
          </div>
        </div>

        {/* Right: Context status badge */}
        {mode === 'discussion' ? (
          hasDiscussionContext ? (
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 bg-indigo-500/20 text-indigo-300 border-indigo-500/35 font-mono"
              >
                {isAnalyzingBackground ? '⏳ Đang phân tích...' : '✨ Đã phân tích ngầm'}
              </Badge>
              <span className="text-[10px] text-indigo-200/60 hidden sm:inline">
                Đa giải pháp &bull; Phân tích Trade-off
              </span>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-white/5 text-white/40 border-white/10 shrink-0"
            >
              Mặc định
            </Badge>
          )
        ) : hasActiveContext ? (
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/35 font-mono"
            >
              {isAnalyzingBackground ? '⏳ Đang đọc CV...' : '✨ Đã phân tích ngầm CV'}
            </Badge>
            <span className="text-[10px] text-emerald-200/60 hidden sm:inline">
              Chuẩn STAR &bull; Bám sát hồ sơ
            </span>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 bg-white/5 text-white/40 border-white/10 shrink-0"
          >
            Mặc định
          </Badge>
        )}
      </div>
    </>
  )
}
