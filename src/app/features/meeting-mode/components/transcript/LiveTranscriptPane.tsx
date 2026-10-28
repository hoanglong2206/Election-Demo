import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import {
  MessageSquare,
  Volume2,
  Mic,
  Trash2,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Languages,
  Loader2,
  Maximize2,
  Minimize2,
  ArrowDown,
  Layers,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import { useVietnameseTranslation } from '@/hooks/useVietnameseTranslation'
import type { TranscriptLine } from '../../types'
import type { ScannedExchangeResult, STTQueueMetrics } from '@/services'

interface LiveTranscriptPaneProps {
  sourceType: 'system' | 'mic'
  onSwitchSource: (type: 'system' | 'mic') => void
  validLines: TranscriptLine[]
  latestLine: TranscriptLine | null
  /** Dùng chung type với service quét exchange để tránh lệch định nghĩa. */
  latestExchange?: ScannedExchangeResult | null
  isScanningExchange?: boolean
  isCapturing: boolean
  isListening: boolean
  isTranscribing: boolean
  queueMetrics?: STTQueueMetrics
  onClearTranscript: () => void
  onToggleListening: () => void
  scrollRef: RefObject<HTMLDivElement | null>
  sttEngineLabel: string
  mode: AppMode
  meetingSummary: string | null
  isSummarizing: boolean
  /** Lỗi khi gọi LLM tóm tắt (thiếu API key / lỗi mạng...). */
  summaryError?: string | null
  copiedSummary: boolean
  onCopySummary: () => void
  onGenerateSummary: (lines: TranscriptLine[]) => void
  /** Chế độ Song ngữ: hiện nút "Dịch" cho tóm tắt. */
  showTranslate?: boolean
  sttLang?: 'auto' | 'vi' | 'en'
  onSttLangChange?: (lang: 'auto' | 'vi' | 'en') => void
}

export function LiveTranscriptPane({
  sourceType,
  onSwitchSource,
  validLines,
  latestLine,
  latestExchange,
  isScanningExchange = false,
  isCapturing,
  isListening,
  isTranscribing,
  queueMetrics,
  onClearTranscript,
  onToggleListening,
  scrollRef,
  sttEngineLabel,
  mode,
  meetingSummary,
  isSummarizing,
  summaryError,
  copiedSummary,
  onCopySummary,
  onGenerateSummary,
  showTranslate = false,
  sttLang = 'vi',
  onSttLangChange,
}: LiveTranscriptPaneProps) {
  // ── Bilingual mode: bản dịch tiếng Việt cho phần tóm tắt ──────────────────
  const { entries: translations, toggle: toggleTranslation, reset: resetTranslations } =
    useVietnameseTranslation()

  useEffect(() => {
    resetTranslations()
  }, [meetingSummary, resetTranslations])

  const summaryTr = translations['summary']
  const summaryShowingVi = Boolean(summaryTr?.text && summaryTr.showing)
  const summaryDisplay = summaryShowingVi ? summaryTr!.text! : meetingSummary

  // Mở rộng tóm tắt: đẩy vùng transcript lên để hiện đủ nội dung.
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)

  // ── Transcript Virtualization & Sliding Window (50 câu mới nhất) ────────────
  const DEFAULT_WINDOW_SIZE = 50
  const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW_SIZE)
  const [isAllExpanded, setIsAllExpanded] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [copiedLineId, setCopiedLineId] = useState<number | null>(null)

  const totalLinesCount = validLines.length
  const isVirtualizing = !isAllExpanded && totalLinesCount > DEFAULT_WINDOW_SIZE
  const startIndex = isVirtualizing ? Math.max(0, totalLinesCount - windowSize) : 0
  const visibleLines = isVirtualizing ? validLines.slice(startIndex) : validLines
  const hiddenCount = startIndex

  // Intelligent auto-scroll listener
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      const atBottom = distance < 60
      setIsAtBottom(atBottom)
      if (atBottom) {
        setUnreadCount(0)
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollRef])

  // Auto-scroll when new lines arrive (only if user is pinned to bottom)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isAtBottom) {
      el.scrollTop = el.scrollHeight
    } else {
      const timer = setTimeout(() => {
        setUnreadCount((prev) => prev + 1)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [validLines.length, isAtBottom, scrollRef])

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setIsAtBottom(true)
      setUnreadCount(0)
    }
  }

  const handleCopyLine = (line: TranscriptLine) => {
    const text = `${line.speaker} (${line.timestamp}):\n${line.original}\n${line.translated}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedLineId(line.id)
    setTimeout(() => setCopiedLineId(null), 1500)
  }

  return (
    <section className="flex flex-col flex-1 min-w-0 min-h-0 border-r border-white/[0.07] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[11px] text-white/50 font-semibold uppercase tracking-wider">
            Live Transcript
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[9.5px]">
          <button
            type="button"
            onClick={() => onSwitchSource('system')}
            className={cn(
              'px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-all',
              sourceType === 'system'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white'
            )}
            title="Thu âm thanh cuộc gọi / hệ thống (Google Meet, Zoom, Teams, YouTube)"
          >
            <Volume2 className="w-2.5 h-2.5" />
            <span>Hệ thống</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchSource('mic')}
            className={cn(
              'px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-all',
              sourceType === 'mic'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white'
            )}
            title="Thu âm thanh từ Microphone của bạn"
          >
            <Mic className="w-2.5 h-2.5" />
            <span>Micro</span>
          </button>
        </div>
          {/* STT Input Language Switcher */}
          <div
            className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[9px]"
            title="Ngôn ngữ giọng nói đầu vào (Chọn VI để chống nhảy sang tiếng Thái/Hàn/Trung khi dùng Whisper)"
          >
            <button
              type="button"
              onClick={() => onSttLangChange?.('vi')}
              className={cn(
                'px-1.5 py-0.5 rounded font-semibold transition-all',
                sttLang === 'vi'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white'
              )}
              title="Khóa nhận diện Tiếng Việt (Whisper -l vi, chuẩn xác không bị lẫn tiếng nước ngoài)"
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => onSttLangChange?.('en')}
              className={cn(
                'px-1.5 py-0.5 rounded font-semibold transition-all',
                sttLang === 'en'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white'
              )}
              title="Khóa nhận diện Tiếng Anh (Whisper -l en)"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onSttLangChange?.('auto')}
              className={cn(
                'px-1.5 py-0.5 rounded font-semibold transition-all',
                sttLang === 'auto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-white/40 hover:text-white'
              )}
              title="Tự động nhận diện ngôn ngữ (Whisper -l auto)"
            >
              Auto
            </button>
          </div>
        </div>
      </div>

      {/* Sub Toolbar: Source Switcher & STT Badge */}
      <div className="flex items-center justify-between gap-1.5 px-3.5 py-1 shrink-0 border-b border-white/[0.02]">
       

        <div className="flex items-center justify-between flex-1 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[9.5px] px-1.5 py-0 h-5 bg-violet-500/10 text-violet-300 border-violet-500/20 font-mono flex items-center gap-1"
            >
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              <span>STT: {sttEngineLabel}</span>
            </Badge>

            {/* Native Worker Abstract State Indicator */}
            {queueMetrics?.provider === 'Local' && queueMetrics.workerState && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[9.5px] px-1.5 py-0 h-5 font-mono flex items-center gap-1 transition-all',
                  queueMetrics.workerState === 'RESTARTING' &&
                    'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
                  queueMetrics.workerState === 'FAILED' &&
                    'bg-rose-500/20 text-rose-300 border-rose-500/40',
                  queueMetrics.workerState === 'BUSY' &&
                    'bg-blue-500/20 text-blue-300 border-blue-500/40',
                  (queueMetrics.workerState === 'READY' || queueMetrics.workerState === 'STARTING') &&
                    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                )}
                title={
                  queueMetrics.nativeTelemetry
                    ? `Whisper Worker [${queueMetrics.workerState}] | Restarts: ${queueMetrics.nativeTelemetry.restartCount} | Timeouts: ${queueMetrics.nativeTelemetry.timeoutCount} | Crashes: ${queueMetrics.nativeTelemetry.crashCount} | Avg Latency: ${queueMetrics.nativeTelemetry.processLatency}ms`
                    : `Whisper Worker: ${queueMetrics.workerState}`
                }
              >
                {queueMetrics.workerState === 'RESTARTING' && (
                  <>
                    <RotateCcw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                    <span>STT Restarting...</span>
                  </>
                )}
                {queueMetrics.workerState === 'FAILED' && (
                  <>
                    <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                    <span>STT Failed</span>
                  </>
                )}
                {queueMetrics.workerState === 'BUSY' && (
                  <>
                    <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                    <span>STT Busy</span>
                  </>
                )}
                {queueMetrics.workerState === 'READY' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>STT Ready</span>
                  </>
                )}
                {queueMetrics.workerState === 'STARTING' && (
                  <>
                    <Loader2 className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
                    <span>STT Starting</span>
                  </>
                )}
              </Badge>
            )}

            {queueMetrics && queueMetrics.queueDepth > 0 && (
              <Badge
                variant="outline"
                className="text-[9.5px] px-1.5 py-0 h-5 bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono flex items-center gap-1 animate-pulse"
                title={`Đang chờ xử lý trong hàng đợi STT | Giới hạn concurrency: ${queueMetrics.concurrency} | Chờ TB: ${queueMetrics.averageWaitTime}ms | Bỏ qua: ${queueMetrics.droppedJobs}`}
              >
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                <span>STT Queue: {queueMetrics.queueDepth} {queueMetrics.queueDepth === 1 ? 'job' : 'jobs'}</span>
              </Badge>
            )}

            {queueMetrics && queueMetrics.provider !== 'Local' && queueMetrics.processingJobs > 0 && (
              <Badge
                variant="outline"
                className="text-[9.5px] px-1.5 py-0 h-5 bg-blue-500/15 text-blue-300 border-blue-500/30 font-mono flex items-center gap-1"
                title={`Worker đang chạy song song trên ${queueMetrics.provider} Whisper (${queueMetrics.processingJobs}/${queueMetrics.concurrency})`}
              >
                <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                <span>Worker: {queueMetrics.processingJobs}/{queueMetrics.concurrency}</span>
              </Badge>
            )}
          </div>

          {validLines.length > 0 && (
            <button
              type="button"
              onClick={onClearTranscript}
              className="text-[10px] text-white/35 hover:text-rose-300 transition-colors flex items-center gap-1 px-1 py-0.5 rounded shrink-0"
              title="Xóa toàn bộ transcript đã nhận diện"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Xóa</span>
            </button>
          )}
        </div>
      </div>

      {/* Transcript Scroll Area Wrapper with Sliding Window Virtualization */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea
          viewportRef={scrollRef}
          className="flex-1 min-h-0 px-3.5 py-2 custom-scrollbar"
        >
          <div className="space-y-3">
            {/* Virtualization Control Banner at top */}
            {hiddenCount > 0 && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[10.5px] text-white/60 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="truncate">
                    Hiển thị <strong>{visibleLines.length}</strong> câu gần nhất (đã ẩn <strong>{hiddenCount}</strong> câu cũ để giữ 60 FPS)
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setWindowSize((prev) => Math.min(totalLinesCount, prev + 50))}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                    title="Tải thêm 50 câu thoại trước đó vào danh sách"
                  >
                    + 50 câu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAllExpanded(true)}
                    className="px-2 py-0.5 rounded bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-colors"
                    title="Hiển thị toàn bộ lịch sử transcript trong buổi họp"
                  >
                    Tất cả ({totalLinesCount})
                  </button>
                </div>
              </div>
            )}

            {isAllExpanded && totalLinesCount > DEFAULT_WINDOW_SIZE && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/20 text-[10.5px] text-amber-200/80 mb-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đang hiển thị toàn bộ <strong>{totalLinesCount}</strong> câu thoại.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAllExpanded(false)
                    setWindowSize(DEFAULT_WINDOW_SIZE)
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white transition-colors"
                  title="Giới hạn hiển thị 50 câu gần nhất để giải phóng bộ nhớ DOM"
                >
                  Bật tối ưu (50 câu)
                </button>
              </div>
            )}

            {/* Empty state when not capturing */}
            {validLines.length === 0 && !isCapturing && (
              <div className="flex flex-col items-center justify-center py-4 text-center space-y-2 animate-fade-in select-none">
                <div className="w-9 h-9 rounded-xl bg-violet-600/15 border border-violet-500/25 flex items-center justify-center text-violet-400 shadow-md shadow-violet-600/10">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 max-w-xs">
                  <h3 className="text-[12px] font-semibold text-white/95">
                    Chưa bắt đầu thu âm cuộc họp
                  </h3>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    Nhấn nút bên dưới để cấp quyền thu âm cuộc gọi (Hệ thống) hoặc Microphone. AI sẽ tự động nhận diện và dịch song ngữ thời gian thực.
                  </p>
                </div>
                <Button
                  onClick={onToggleListening}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] h-7 px-3 font-medium gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  <Mic className="w-3 h-3" />
                  <span>Bắt đầu thu âm cuộc họp</span>
                </Button>
              </div>
            )}

            {/* Empty state when capturing */}
            {validLines.length === 0 && isCapturing && (
              <div className="flex flex-col items-center justify-center py-4 text-center space-y-2 animate-fade-in select-none">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
                  <div className="flex items-center gap-0.5 h-4">
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-1 h-full" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-2 h-full" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-3 h-full" />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-wave-4 h-full" />
                  </div>
                </div>
                <div className="space-y-0.5 max-w-xs">
                  <h3 className="text-[12px] font-semibold text-white/95">
                    Đang lắng nghe âm thanh cuộc họp...
                  </h3>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    {sourceType === 'system'
                      ? 'Đang lắng nghe âm thanh từ cuộc gọi/YouTube. Văn bản và bản dịch tiếng Việt sẽ tự động xuất hiện tại đây.'
                      : 'Đang lắng nghe qua Microphone. Hãy nói câu hỏi hoặc nội dung cuộc họp để AI chuyển thành văn bản.'}
                  </p>
                </div>
              </div>
            )}

            {/* Render visible transcript lines (max 50 by default in DOM) */}
            {visibleLines.map((line, idx) => (
              <div
                key={line.id}
                className={cn(
                  'group animate-fade-in transition-opacity',
                  idx === visibleLines.length - 1 ? 'opacity-100' : 'opacity-85 hover:opacity-100'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider',
                        line.speaker === 'You'
                          ? 'text-violet-400/95'
                          : line.speaker === 'Interviewer'
                          ? 'text-amber-400/90'
                          : 'text-indigo-400/95'
                      )}
                    >
                      {line.speaker}
                    </span>
                    <span className="text-white/20">&bull;</span>
                    <span className="text-[10px] text-white/35 font-mono">{line.timestamp}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyLine(line)}
                    className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded text-white/40 hover:text-white transition-opacity"
                    title="Sao chép câu thoại"
                  >
                    {copiedLineId === line.id ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                </div>

                <p className="text-[11.5px] leading-relaxed text-white/60 font-normal mb-1">
                  {line.original}
                </p>

                <p className="text-[12.5px] leading-relaxed text-white font-medium tracking-normal">
                  {line.translated}
                </p>
              </div>
            ))}

            {/* Live typing cursor */}
            {isListening && isCapturing && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="inline-block w-1.5 h-3.5 bg-violet-400 rounded-sm animate-pulse" />
                <span className="text-[10px] text-white/25 italic">
                  {isTranscribing ? 'Đang giải mã giọng nói...' : 'Đang thu âm lời nói...'}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Quick Scroll to Bottom Button */}
        {!isAtBottom && validLines.length > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-2 right-4 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600/90 hover:bg-violet-600 text-white shadow-lg shadow-violet-950/60 border border-violet-400/30 text-[10.5px] font-medium backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title="Cuộn xuống vị trí mới nhất"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Mới nhất</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                +{unreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Bottom Panel: Latest Exchange & AI Meeting Summary */}
      <div
        className={cn(
          'shrink-0 border-t border-white/[0.08] bg-black/50 backdrop-blur-md p-2.5 flex flex-col gap-2 overflow-y-auto custom-scrollbar transition-all',
          // Mở rộng -> nới trần chiều cao để đẩy vùng transcript lên và hiện đủ tóm tắt.
          isSummaryExpanded ? 'max-h-[85%]' : 'max-h-[50%]'
        )}
      >
        {/* Latest Exchange */}
        {(() => {
          const currentSpeaker =
            latestExchange?.speaker ||
            latestLine?.speaker ||
            (mode === 'interview' ? 'Người phỏng vấn' : 'Cuộc họp')
          const currentTimestamp = latestExchange?.timestamp || latestLine?.timestamp || ''
          // Nguyên văn transcript gốc (không dịch) — đúng 1 câu mới nhất.
          const displayExchangeText = (
            latestExchange?.original ||
            latestLine?.original ||
            latestLine?.translated ||
            ''
          ).trim()

          return (
            <div
              className={cn(
                'px-2.5 py-1.5 rounded-lg border text-[11px] transition-all shrink-0',
                mode === 'interview'
                  ? 'bg-violet-950/25 border-violet-500/25 shadow-[0_0_15px_rgba(139,92,246,0.05)]'
                  : 'bg-indigo-950/25 border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.05)]'
              )}
            >
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider mb-0.5">
                <span
                  className={cn(
                    'whitespace-nowrap flex items-center gap-1.5',
                    mode === 'interview' ? 'text-violet-400' : 'text-indigo-400'
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {mode === 'interview'
                    ? `Câu hỏi gần nhất (${currentSpeaker}):`
                    : `Trao đổi gần nhất (${currentSpeaker}):`}
                </span>
                <div className="flex items-center gap-1.5">
                  {isScanningExchange && (
                    <span className="text-[8.5px] text-amber-300/85 font-normal flex items-center gap-0.5 animate-pulse font-sans">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      <span>AI đang quét...</span>
                    </span>
                  )}
                  {currentTimestamp && (
                    <span className="font-mono text-white/40 text-[9px] shrink-0">
                      {currentTimestamp}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-white/95 font-medium line-clamp-3 leading-relaxed text-[11px]">
                {displayExchangeText ? (
                  displayExchangeText
                ) : (
                  <span className="text-white/40 italic font-normal text-[10px]">
                    {mode === 'interview'
                      ? 'Đang chờ câu hỏi từ người phỏng vấn...'
                      : 'Chưa có trao đổi mới (AI đang lắng nghe âm thanh cuộc gọi theo thời gian thực)'}
                  </span>
                )}
              </div>
            </div>
          )
        })()}

        {/* AI Meeting Summary */}
        <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] text-[11px] relative flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                Tóm tắt nội dung (AI Summary)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onGenerateSummary(validLines)}
                disabled={isSummarizing || validLines.length === 0}
                className="h-4.5 text-[8.5px] px-1.5 gap-1 text-white/70 hover:text-white hover:bg-white/10"
                title="Yêu cầu AI tổng hợp lại tóm tắt từ transcript hiện có"
              >
                <RotateCcw className={cn('w-2.5 h-2.5 text-amber-400', isSummarizing && 'animate-spin')} />
                <span>{isSummarizing ? 'Đang tóm tắt...' : 'Tóm tắt lại'}</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsSummaryExpanded((prev) => !prev)}
                disabled={!meetingSummary}
                className={cn(
                  'h-4.5 text-[8.5px] px-1.5 gap-1 hover:bg-white/10 disabled:opacity-40',
                  isSummaryExpanded ? 'text-amber-200' : 'text-white/70 hover:text-white'
                )}
                title={
                  isSummaryExpanded
                    ? 'Thu gọn tóm tắt'
                    : 'Mở rộng tóm tắt để xem đầy đủ nội dung'
                }
              >
                {isSummaryExpanded ? (
                  <Minimize2 className="w-2.5 h-2.5 text-amber-400" />
                ) : (
                  <Maximize2 className="w-2.5 h-2.5 text-amber-400" />
                )}
                <span>{isSummaryExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
              </Button>
            </div>
          </div>

          {/* Summary Content Body */}
          {isSummarizing ? (
            <div className="py-2 px-1 space-y-1.5 animate-pulse">
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300/80 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>AI đang phân tích các câu thoại và tổng hợp nội dung cốt lõi...</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded w-3/4" />
              <div className="h-1.5 bg-white/10 rounded w-5/6" />
            </div>
          ) : summaryError ? (
            <div className="text-rose-200/80 text-[10.5px] leading-relaxed py-1 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0 mt-px" />
              <span className="min-w-0">{summaryError}</span>
            </div>
          ) : meetingSummary ? (
            <div
              className={cn(
                'text-white/90 text-[10.5px] leading-relaxed whitespace-pre-line pr-1 custom-scrollbar',
                isSummaryExpanded ? 'max-h-none' : 'max-h-16 overflow-y-auto'
              )}
            >
              {summaryDisplay}
              {showTranslate && summaryTr?.error && (
                <span className="flex items-center gap-1 mt-1 text-rose-300/85">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                  <span>{summaryTr.error}</span>
                </span>
              )}
            </div>
          ) : (
            <div className="text-white/50 italic text-[10px] py-1 flex items-center justify-between">
              <span>
                {validLines.length === 0
                  ? 'Sau khi bấm dừng thu âm, AI sẽ tự động đọc transcript và tóm tắt tại đây.'
                  : 'Bấm nút Dừng (Mic/Paused) ở thanh điều khiển để AI tự động tổng hợp nội dung.'}
              </span>
              {validLines.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onGenerateSummary(validLines)}
                  className="h-5 text-[8.5px] px-2 bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 shrink-0 ml-2"
                >
                  Tổng hợp ngay
                </Button>
              )}
            </div>
          )}

          <div className='flex items-center justify-end gap-2 mt-2.5'>
            {meetingSummary && showTranslate && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleTranslation('summary', meetingSummary)}
                  disabled={summaryTr?.busy}
                  className={cn(
                    'h-4.5 text-[8.5px] px-1.5 gap-1 hover:bg-white/10 disabled:opacity-60',
                    summaryShowingVi ? 'text-sky-200' : 'text-white/70 hover:text-white'
                  )}
                  title="Dịch tóm tắt sang tiếng Việt"
                >
                  {summaryTr?.busy ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-300" />
                  ) : (
                    <Languages className="w-2.5 h-2.5 text-sky-300" />
                  )}
                  <span>
                    {summaryTr?.busy ? 'Đang dịch' : summaryShowingVi ? 'Bản gốc' : 'Dịch'}
                  </span>
                </Button>
              )}

              {meetingSummary && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCopySummary}
                  className="h-4.5 text-[8.5px] px-1.5 gap-1 text-white/70 hover:text-white hover:bg-white/10"
                  title="Sao chép tóm tắt nội dung"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-300">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-amber-400/80" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              )}
          </div>
        </div>
      </div>
    </section>
  )
}
