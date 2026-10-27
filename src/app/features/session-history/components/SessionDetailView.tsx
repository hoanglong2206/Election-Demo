import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Calendar,
  Clock,
  Cpu,
  MessageSquare,
  Sparkles,
  Columns,
  Copy,
  Check,
  Pencil,
  X,
  Camera,
  Coins,
  User,
  Code,
  Briefcase,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type {
  HistoryScreenshotQuestion,
  HistorySuggestion,
  HistoryTranscriptLine,
  MeetingSession,
} from '../../../services/sessionHistory'
import type { DetailTab } from '../types'

interface SessionDetailViewProps {
  currentSession: MeetingSession | null
  detailTab: DetailTab
  copiedId: number | null
  onDetailTabChange: (tab: DetailTab) => void
  onCopyText: (text: string, id: number) => void
  onRenameSession?: (id: string, newTitle: string) => void
  isEditingTitleExternal?: boolean
  onFinishRename?: () => void
}

/**
 * Parses timestamp string "MM:SS" or "HH:MM:SS" into numeric seconds for sorting.
 * Supports decimal sub-seconds (e.g. "00:04.25").
 */
function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0
  const parts = ts.trim().split(':').map((p) => parseFloat(p))
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  }
  return 0
}

interface TimelineItem {
  id: string | number
  sortSec: number
  timestamp: string
  kind: 'interviewer' | 'user' | 'ai_suggestion' | 'screenshot'
  transcript?: HistoryTranscriptLine
  suggestion?: HistorySuggestion
  screenshot?: HistoryScreenshotQuestion
}

export function SessionDetailView({
  currentSession,
  detailTab,
  copiedId,
  onDetailTabChange,
  onCopyText,
  onRenameSession,
  isEditingTitleExternal,
  onFinishRename,
}: SessionDetailViewProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focused / Highlighted item when user clicks a timestamp
  const [highlightedId, setHighlightedId] = useState<string | number | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pagination for long meetings
  const [visibleCount, setVisibleCount] = useState(40)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleCount(40)
      setHighlightedId(null)
    }, 0)
    return () => clearTimeout(timer)
  }, [currentSession?.id, detailTab])

  useEffect(() => {
    if (currentSession) {
      const timer = setTimeout(() => {
        setEditTitle(currentSession.title)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [currentSession])

  useEffect(() => {
    if (isEditingTitleExternal) {
      const timer = setTimeout(() => {
        setIsEditingTitle(true)
        if (currentSession) {
          setEditTitle(currentSession.title)
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isEditingTitleExternal, currentSession])

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingTitle])

  const handleSaveTitle = () => {
    if (!currentSession) return
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
    if (currentSession) {
      setEditTitle(currentSession.title)
    }
    setIsEditingTitle(false)
    onFinishRename?.()
  }

  // ── Construct Unified Chronological Timeline ──────────────────────────────────
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!currentSession) return []
    const items: TimelineItem[] = []

    // 1. Transcripts
    for (const t of currentSession.transcripts || []) {
      const isInterviewer =
        t.speaker === 'Interviewer' ||
        t.speaker === 'Team Lead' ||
        t.speaker === 'Cuộc họp' ||
        t.isQuestion
      const sortSec =
        typeof t.timestampMs === 'number'
          ? t.timestampMs / 1000
          : parseTimestampToSeconds(t.timestamp)
      items.push({
        id: `t_${t.id}`,
        sortSec,
        timestamp: t.timestamp || '00:00',
        kind: isInterviewer ? 'interviewer' : 'user',
        transcript: t,
      })
    }

    // 2. AI Suggestions
    for (const s of currentSession.suggestions || []) {
      const ts = s.timestamp || '00:00'
      const sortSec =
        typeof s.timestampMs === 'number'
          ? s.timestampMs / 1000 + 0.1
          : parseTimestampToSeconds(ts) + 0.1
      items.push({
        id: `s_${s.id}`,
        sortSec,
        timestamp: ts,
        kind: 'ai_suggestion',
        suggestion: s,
      })
    }

    // 3. Screenshot Questions
    for (const sq of currentSession.screenshotQuestions || []) {
      const sortSec =
        typeof sq.timestampMs === 'number'
          ? sq.timestampMs / 1000 + 0.05
          : parseTimestampToSeconds(sq.timestamp) + 0.05
      items.push({
        id: `sq_${sq.id}`,
        sortSec,
        timestamp: sq.timestamp || '00:00',
        kind: 'screenshot',
        screenshot: sq,
      })
    }

    // Sort chronologically
    items.sort((a, b) => a.sortSec - b.sortSec)
    return items
  }, [currentSession])

  // Click timestamp to correlate context
  const handleTimestampClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const targetId = e.currentTarget.dataset.targetId
    if (!targetId) return
    setHighlightedId(targetId)
    const el = document.getElementById(`timeline-item-${targetId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    // Auto reset highlight after 3 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId((prev) => (String(prev) === String(targetId) ? null : prev))
    }, 3000)
  }

  const sortedTranscripts = useMemo(() => {
    const list = currentSession?.transcripts || []
    return [...list].sort((a, b) => {
      const secA = typeof a.timestampMs === 'number' ? a.timestampMs / 1000 : parseTimestampToSeconds(a.timestamp)
      const secB = typeof b.timestampMs === 'number' ? b.timestampMs / 1000 : parseTimestampToSeconds(b.timestamp)
      return secA - secB
    })
  }, [currentSession?.transcripts])

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/35 text-[11.5px] bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center gap-2">
        <MessageSquare className="w-8 h-8 text-white/15" />
        <div className="font-medium text-white/60">Chưa có phiên họp nào được chọn</div>
        <p className="text-[10.5px] text-white/30 max-w-sm leading-relaxed">
          Khi bạn lưu lại cuộc họp từ chế độ Cuộc họp (Meeting Mode), toàn bộ transcript timeline song ngữ, câu trả lời gợi ý của AI và câu hỏi hình ảnh sẽ xuất hiện tại đây.
        </p>
      </div>
    )
  }

  const visibleTimeline = timelineItems.slice(0, visibleCount)
  const hasMoreTimeline = timelineItems.length > visibleCount

  const visibleTranscripts = sortedTranscripts.slice(0, visibleCount)
  const hasMoreTranscripts = sortedTranscripts.length > visibleCount

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden shadow-sm">
      {/* ── Top Header: Title, Renaming & Meta Badges ── */}
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
              Tương tác: <strong className="text-white/80">{timelineItems.length}</strong>
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

      {/* ── Detail Navigation Tabs ── */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-white/[0.06] shrink-0 gap-2">
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onDetailTabChange('timeline')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
              detailTab === 'timeline'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white/80'
            )}
            title="Dòng thời gian hội thoại tích hợp"
          >
            <Clock className="w-3 h-3" />
            <span>1. Dòng Thời Gian</span>
          </button>

          <button
            type="button"
            onClick={() => onDetailTabChange('transcript')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
              detailTab === 'transcript'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white/80'
            )}
          >
            <MessageSquare className="w-3 h-3" />
            <span>2. Lời Thoại</span>
          </button>

          <button
            type="button"
            onClick={() => onDetailTabChange('suggestions')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
              detailTab === 'suggestions'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white/80'
            )}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>3. Gợi Ý AI</span>
          </button>

          {currentSession.screenshotQuestions && currentSession.screenshotQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => onDetailTabChange('screenshots')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
                detailTab === 'screenshots'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-white/45 hover:text-white/80'
              )}
            >
              <Camera className="w-3 h-3 text-cyan-300" />
              <span>4. Ảnh Màn Hình ({currentSession.screenshotQuestions.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDetailTabChange('split')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
              detailTab === 'split'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white/80'
            )}
          >
            <Columns className="w-3 h-3" />
            <span>5. Chia Đôi (50:50)</span>
          </button>
        </div>
      </div>

      {/* ── Main Tab Content ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* ── TAB: TIMELINE (Unified Chronological Sequence) ── */}
        {detailTab === 'timeline' && (
          <ScrollArea className="h-full p-4 custom-scrollbar">
            <div className="space-y-3 max-w-3xl mx-auto">
              {timelineItems.length === 0 ? (
                <div className="py-16 text-center text-white/35 text-xs">
                  <Clock className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="font-medium text-white/50">Chưa có dòng thời gian</p>
                  <p className="text-[10.5px] text-white/30 mt-1">Buổi họp này chưa có đoạn hội thoại hoặc tương tác AI nào được lưu.</p>
                </div>
              ) : (
                visibleTimeline.map((item) => {
                const isHighlighted = highlightedId === item.id

                // 1. Interviewer Question / Utterance
                if (item.kind === 'interviewer' && item.transcript) {
                  return (
                    <div
                      key={item.id}
                      id={`timeline-item-${item.id}`}
                      className={cn(
                        'p-3 rounded-xl border transition-all text-xs space-y-1.5',
                        isHighlighted
                          ? 'bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/40 shadow-lg'
                          : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="font-bold text-amber-300 uppercase tracking-wider">
                            {item.transcript.speaker}
                          </span>
                          {item.transcript.isQuestion && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] py-0 px-1">
                              Câu hỏi
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          data-target-id={item.id}
                          onClick={handleTimestampClick}
                          className="font-mono text-white/40 hover:text-amber-300 transition-colors flex items-center gap-1"
                          title="Bấm để định vị ngữ cảnh"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </button>
                      </div>

                      <div className="text-white/90 font-medium leading-relaxed">
                        {item.transcript.original}
                      </div>

                      {item.transcript.translated && (
                        <div className="text-[11px] text-white/50 italic border-t border-white/5 pt-1">
                          {item.transcript.translated}
                        </div>
                      )}
                    </div>
                  )
                }

                // 2. User Utterance
                if (item.kind === 'user' && item.transcript) {
                  return (
                    <div
                      key={item.id}
                      id={`timeline-item-${item.id}`}
                      className={cn(
                        'p-3 rounded-xl border transition-all text-xs space-y-1.5 ml-6',
                        isHighlighted
                          ? 'bg-violet-600/25 border-violet-500/60 ring-2 ring-violet-500/40 shadow-lg'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-violet-400" />
                          <span className="font-semibold text-violet-300">
                            Bạn (Ứng viên / Lời nói của bạn)
                          </span>
                        </div>
                        <button
                          type="button"
                          data-target-id={item.id}
                          onClick={handleTimestampClick}
                          className="font-mono text-white/40 hover:text-violet-300 transition-colors flex items-center gap-1"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </button>
                      </div>

                      <div className="text-white/80 leading-relaxed">
                        {item.transcript.original}
                      </div>

                      {item.transcript.translated && (
                        <div className="text-[11px] text-white/40 italic border-t border-white/5 pt-1">
                          {item.transcript.translated}
                        </div>
                      )}
                    </div>
                  )
                }

                // 3. AI Suggestion
                if (item.kind === 'ai_suggestion' && item.suggestion) {
                  const s = item.suggestion
                  return (
                    <div
                      key={item.id}
                      id={`timeline-item-${item.id}`}
                      className={cn(
                        'p-3.5 rounded-xl border transition-all text-xs space-y-2 shadow-sm',
                        isHighlighted
                          ? 'bg-violet-950/40 border-violet-400 ring-2 ring-violet-400 shadow-xl'
                          : 'bg-gradient-to-r from-violet-950/20 via-purple-950/10 to-transparent border-violet-500/30 hover:border-violet-500/50'
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span className="font-semibold text-violet-300">
                            {s.type === 'answer' ? 'AI STAR Phản Hồi Gợi Ý' : s.label || 'Tùy Chọn Thảo Luận'}
                          </span>
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-1 rounded font-mono">
                            {s.confidence ?? 95}% Tự tin
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-target-id={item.id}
                            onClick={handleTimestampClick}
                            className="font-mono text-white/40 hover:text-violet-300 transition-colors flex items-center gap-1"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{item.timestamp}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onCopyText(s.content, Number(s.id))}
                            className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors"
                            title="Copy câu trả lời"
                          >
                            {copiedId === Number(s.id) ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="text-white/95 leading-relaxed font-sans pl-1 border-l-2 border-violet-500/50">
                        {s.content}
                      </div>

                      {s.tokenUsage && (
                        <div className="text-[9.5px] text-white/35 font-mono pt-1 border-t border-white/5 flex items-center gap-2">
                          <span>Tokens: {s.tokenUsage.totalTokens}</span>
                          <span>&bull;</span>
                          <span>
                            {s.tokenUsage.costStatus === 'unknown'
                              ? 'Chi phí chưa xác định'
                              : s.tokenUsage.costStatus === 'free'
                              ? 'Miễn phí'
                              : s.tokenUsage.estimatedCostUsd !== undefined
                              ? `Chi phí: ~$${s.tokenUsage.estimatedCostUsd.toFixed(4)}`
                              : 'Chi phí chưa xác định'}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                }

                // 4. Screenshot Question
                if (item.kind === 'screenshot' && item.screenshot) {
                  const sq = item.screenshot
                  return (
                    <div
                      key={item.id}
                      id={`timeline-item-${item.id}`}
                      className={cn(
                        'p-3.5 rounded-xl border transition-all text-xs space-y-2.5',
                        isHighlighted
                          ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400 shadow-xl'
                          : 'bg-cyan-950/15 border-cyan-500/30 hover:border-cyan-500/50'
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Câu Hỏi Từ Màn Hình ({sq.contentType || 'Coding Question'})</span>
                        </div>
                        <span className="font-mono text-white/40 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </span>
                      </div>

                      {sq.analysisResult?.questionSummary && (
                        <div className="font-medium text-white/90">
                          {sq.analysisResult.questionSummary}
                        </div>
                      )}

                      {(sq.thumbnailUrl || sq.imageUrl) && (
                        <div className="relative group/thumb rounded-lg overflow-hidden border border-cyan-500/25 bg-black/50 max-w-sm inline-block">
                          <img
                            src={sq.thumbnailUrl || sq.imageUrl}
                            alt="Screenshot"
                            loading="lazy"
                            onClick={() => setPreviewImageUrl(sq.imageUrl || sq.thumbnailUrl || null)}
                            className="max-h-36 w-auto object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] text-cyan-300 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                            Phóng to
                          </div>
                        </div>
                      )}

                      {sq.ocrText && (
                        <div className="p-2 rounded bg-black/50 border border-white/5 font-mono text-[10.5px] text-white/70 max-h-24 overflow-y-auto">
                          {sq.ocrText}
                        </div>
                      )}

                      {sq.analysisResult?.codeSnippet && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-cyan-300/80 font-medium flex items-center gap-1">
                            <Code className="w-3 h-3" />
                            Mã nguồn gợi ý:
                          </span>
                          <pre className="p-2 rounded bg-black/60 border border-cyan-500/20 font-mono text-[10.5px] text-emerald-300 overflow-x-auto">
                            <code>{sq.analysisResult.codeSnippet}</code>
                          </pre>
                        </div>
                      )}

                      {sq.analysisResult?.suggestedAnswer && (
                        <div className="text-white/80 leading-relaxed text-[11px] bg-white/[0.02] p-2 rounded border border-white/5">
                          <strong className="text-cyan-300">Giải pháp AI: </strong>
                          {sq.analysisResult.suggestedAnswer}
                        </div>
                      )}
                    </div>
                  )
                }

                return null
              }))}

              {/* Progressive Load More Button */}
              {hasMoreTimeline && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 40)}
                    className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-[11px] font-medium transition-colors border border-white/10"
                  >
                    Tải thêm 40 mục tiếp theo ({visibleTimeline.length}/{timelineItems.length})
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* ── TAB: TRANSCRIPT (Standard Dual-Language List) ── */}
        {detailTab === 'transcript' && (
          <ScrollArea className="h-full p-4 custom-scrollbar">
            <div className="space-y-2.5 max-w-3xl mx-auto">
              {sortedTranscripts.length === 0 ? (
                <div className="py-16 text-center text-white/35 text-xs">
                  <MessageSquare className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="font-medium text-white/50">Chưa có đoạn hội thoại nào</p>
                  <p className="text-[10.5px] text-white/30 mt-1">Không ghi nhận được lời thoại transcript trong buổi họp này.</p>
                </div>
              ) : (
                visibleTranscripts.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-colors space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'font-bold uppercase tracking-wider',
                            t.speaker === 'Interviewer' || t.speaker === 'Team Lead'
                              ? 'text-amber-400/90'
                              : 'text-violet-400/95'
                          )}
                        >
                          {t.speaker}
                        </span>
                        {t.isQuestion && (
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[8.5px] py-0 px-1">
                            Câu hỏi
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-white/30">{t.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => onCopyText(t.original, Number(t.id))}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all text-white/40 hover:text-white"
                          title="Copy câu nói gốc"
                        >
                          {copiedId === Number(t.id) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-[12px] text-white/90 leading-relaxed">{t.original}</div>

                    {t.translated && (
                      <div className="text-[11px] text-white/50 italic border-t border-white/[0.04] pt-1">
                        {t.translated}
                      </div>
                    )}
                  </div>
                ))
              )}

              {hasMoreTranscripts && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 50)}
                    className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-[11px] font-medium transition-colors border border-white/10"
                  >
                    Tải thêm 50 đoạn hội thoại ({visibleTranscripts.length}/{sortedTranscripts.length})
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* ── TAB: SUGGESTIONS (AI Responses) ── */}
        {detailTab === 'suggestions' && (
          <ScrollArea className="h-full p-4 custom-scrollbar">
            <div className="space-y-3 max-w-3xl mx-auto">
              {(currentSession.suggestions || []).length === 0 ? (
                <div className="py-16 text-center text-white/35 text-xs">
                  <Sparkles className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="font-medium text-white/50">Chưa có gợi ý AI nào</p>
                  <p className="text-[10.5px] text-white/30 mt-1">Chưa có câu trả lời gợi ý nào được sinh ra trong buổi họp này.</p>
                </div>
              ) : (
                (currentSession.suggestions || []).map((s, idx) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      {s.type === 'answer' ? `Gợi ý câu trả lời #${idx + 1}` : s.label || `Phương án #${idx + 1}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded">
                        {s.confidence ?? 95}% Tự tin
                      </span>
                      <button
                        type="button"
                        onClick={() => onCopyText(s.content, Number(s.id))}
                        className="p-1 hover:bg-white/10 text-white/50 hover:text-white rounded transition-colors"
                        title="Copy nội dung"
                      >
                        {copiedId === Number(s.id) ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-white/90 leading-relaxed whitespace-pre-line">
                    {s.content}
                  </p>

                  {s.tokenUsage && (
                    <div className="text-[9.5px] text-white/40 font-mono pt-1.5 border-t border-white/5 flex items-center gap-2">
                      <span>Tokens: {s.tokenUsage.totalTokens}</span>
                      <span>&bull;</span>
                      <span>
                        {s.tokenUsage.costStatus === 'unknown'
                          ? 'Chi phí chưa xác định'
                          : s.tokenUsage.costStatus === 'free'
                          ? 'Miễn phí'
                          : s.tokenUsage.estimatedCostUsd !== undefined
                          ? `Ước tính chi phí: ~$${s.tokenUsage.estimatedCostUsd.toFixed(4)}`
                          : 'Chi phí chưa xác định'}
                      </span>
                    </div>
                  )}
                </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {/* ── TAB: SCREENSHOTS (Visual Coding Questions) ── */}
        {detailTab === 'screenshots' && (
          <ScrollArea className="h-full p-4 custom-scrollbar">
            <div className="space-y-4 max-w-3xl mx-auto">
              {(!currentSession.screenshotQuestions || currentSession.screenshotQuestions.length === 0) ? (
                <div className="py-16 text-center text-white/35 text-xs">
                  <Camera className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="font-medium text-white/50">Chưa có câu hỏi ảnh chụp màn hình</p>
                  <p className="text-[10.5px] text-white/30 mt-1">Chưa có phân tích screenshot nào được thực hiện trong buổi họp này.</p>
                </div>
              ) : (
                currentSession.screenshotQuestions.map((sq, idx) => (
                  <div
                    key={sq.id}
                    className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-cyan-300 flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Câu hỏi hình ảnh #{idx + 1}
                        <span className="text-[10px] text-cyan-400/60 font-mono">[{sq.timestamp}]</span>
                      </span>
                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-[10px]">
                        {sq.contentType || 'visual_question'}
                      </Badge>
                    </div>

                    {sq.analysisResult?.questionSummary && (
                      <div className="text-xs font-medium text-white/95">
                        {sq.analysisResult.questionSummary}
                      </div>
                    )}

                    {(sq.imageUrl || sq.thumbnailUrl) && (
                      <div className="relative group/screenshot rounded-lg overflow-hidden border border-cyan-500/25 bg-black/50 flex justify-center">
                        <img
                          src={sq.thumbnailUrl || sq.imageUrl}
                          alt={`Screenshot ${idx + 1}`}
                          loading="lazy"
                          onClick={() => setPreviewImageUrl(sq.imageUrl || sq.thumbnailUrl || null)}
                          className="max-h-64 w-auto object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                        />
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] text-cyan-300 pointer-events-none opacity-0 group-hover/screenshot:opacity-100 transition-opacity">
                          Bấm để xem kích thước đầy đủ
                        </div>
                      </div>
                    )}

                    {sq.ocrText && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 font-medium">OCR Text:</span>
                        <pre className="p-2.5 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-white/70 overflow-x-auto whitespace-pre-wrap">
                          {sq.ocrText}
                        </pre>
                      </div>
                    )}

                    {sq.analysisResult?.codeSnippet && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-cyan-300 font-medium">Code giải pháp:</span>
                        <pre className="p-3 rounded-lg bg-black/70 border border-cyan-500/25 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                          <code>{sq.analysisResult.codeSnippet}</code>
                        </pre>
                      </div>
                    )}

                    {sq.analysisResult?.suggestedAnswer && (
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/90 leading-relaxed">
                        <strong className="text-cyan-300 block mb-1">Gợi ý trả lời phỏng vấn:</strong>
                        {sq.analysisResult.suggestedAnswer}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {/* ── TAB: SPLIT (50:50 Side-by-Side) ── */}
        {detailTab === 'split' && (
          <div className="grid grid-cols-2 h-full divide-x divide-white/[0.06] overflow-hidden">
            {/* Left: Transcript */}
            <ScrollArea className="h-full p-3.5 custom-scrollbar">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-white/60 mb-2">
                  Lời Thoại ({sortedTranscripts.length})
                </div>
                {sortedTranscripts.length === 0 ? (
                  <div className="py-8 text-center text-white/35 text-xs">
                    Không có lời thoại nào
                  </div>
                ) : (
                  visibleTranscripts.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[11px] space-y-1"
                    >
                      <div className="flex justify-between text-[9.5px]">
                        <span className="font-bold text-amber-300/90">{t.speaker}</span>
                        <span className="text-white/30 font-mono">{t.timestamp}</span>
                      </div>
                      <div className="text-white/85">{t.original}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Right: AI Suggestions */}
            <ScrollArea className="h-full p-3.5 custom-scrollbar">
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold text-violet-300/80 mb-2">
                  Gợi Ý AI Copilot ({(currentSession.suggestions || []).length})
                </div>
                {(currentSession.suggestions || []).length === 0 ? (
                  <div className="py-8 text-center text-white/35 text-xs">
                    Chưa có gợi ý AI nào
                  </div>
                ) : (
                  (currentSession.suggestions || []).map((s, idx) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg bg-violet-950/20 border border-violet-500/25 text-[11px] space-y-1.5"
                    >
                      <div className="flex justify-between text-[9.5px] font-medium text-violet-300">
                        <span>{s.label || `Gợi ý #${idx + 1}`}</span>
                        <span className="text-emerald-300 font-mono">{s.confidence ?? 95}%</span>
                      </div>
                      <div className="text-white/90 leading-relaxed">{s.content}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* ── Screenshot Full Size Modal / Lightbox ── */}
      {previewImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImageUrl}
              alt="Screenshot full preview"
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="mt-3 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <X className="w-3 h-3" />
              <span>Đóng xem ảnh (ESC / Bấm ra ngoài)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
