import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Volume2,
  Mic,
  ArrowDown,
  Layers,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useVietnameseTranslation } from '@/hooks/useVietnameseTranslation'
import type { TranscriptLine } from '../../types'
import { TranscriptLineItem } from './TranscriptLineItem'
import { TranscriptSearchBar } from './TranscriptSearchBar'
import { TranscriptSubToolbar } from './TranscriptSubToolbar'
import { LatestExchangeCard } from './LatestExchangeCard'
import { TranscriptSummarySection } from './TranscriptSummarySection'
import type { LiveTranscriptPaneProps } from './types'

export type { LiveTranscriptPaneProps }

export function LiveTranscriptPane({
  sourceType: _sourceType,
  onSwitchSource: _onSwitchSource,
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

  // ── Transcript Keyword Search ──────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  const matchedLineIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return validLines
      .filter((line) => {
        return (
          line.original?.toLowerCase().includes(q) ||
          line.translated?.toLowerCase().includes(q) ||
          line.speaker?.toLowerCase().includes(q) ||
          line.timestamp?.toLowerCase().includes(q)
        )
      })
      .map((l) => l.id)
  }, [validLines, searchQuery])

  const scrollToMatch = useCallback(
    (index: number) => {
      if (matchedLineIds.length === 0) return
      const targetId = matchedLineIds[index]
      if (targetId === undefined) return

      if (isVirtualizing) {
        const lineIndex = validLines.findIndex((l) => l.id === targetId)
        if (lineIndex !== -1 && lineIndex < startIndex) {
          const neededWindow = totalLinesCount - lineIndex + 10
          setWindowSize((prev) => Math.max(prev, neededWindow))
        }
      }

      setTimeout(() => {
        const el = document.getElementById(`transcript-line-${targetId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 60)
    },
    [matchedLineIds, isVirtualizing, validLines, startIndex, totalLinesCount]
  )

  const handleNextMatch = useCallback(() => {
    if (matchedLineIds.length === 0) return
    const next = (currentMatchIndex + 1) % matchedLineIds.length
    setCurrentMatchIndex(next)
    scrollToMatch(next)
  }, [matchedLineIds.length, currentMatchIndex, scrollToMatch])

  const handlePrevMatch = useCallback(() => {
    if (matchedLineIds.length === 0) return
    const prev = (currentMatchIndex - 1 + matchedLineIds.length) % matchedLineIds.length
    setCurrentMatchIndex(prev)
    scrollToMatch(prev)
  }, [matchedLineIds.length, currentMatchIndex, scrollToMatch])

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

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setIsAtBottom(true)
      setUnreadCount(0)
    }
  }, [scrollRef])

  const handleCopyLine = useCallback((line: TranscriptLine) => {
    const text = `${line.speaker} (${line.timestamp}):\n${line.original}\n${line.translated || ''}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedLineId(line.id)
    setTimeout(() => setCopiedLineId(null), 1500)
  }, [])

  return (
    <section className="flex flex-col flex-1 min-w-0 min-h-0 border-r border-white/[0.07] overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-white/[0.04] gap-1.5 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[11px] text-white/50 font-semibold uppercase tracking-wider">
            Live Transcript
          </span>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((prev) => !prev)
              if (isSearchOpen) setSearchQuery('')
            }}
            className={cn(
              'p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors ml-1',
              isSearchOpen && 'text-violet-300 bg-violet-500/20'
            )}
            title="Tìm kiếm từ khóa trong transcript"
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center bg-black/50 px-2.5 py-1 rounded-xl border border-white/[0.08] shadow-inner backdrop-blur-md text-[9.5px] select-none text-emerald-300 gap-1.5 font-medium"
            title="Nguồn thu: Âm thanh cuộc gọi / hệ thống (Google Meet, Zoom, Teams, YouTube)"
          >
            <Volume2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>Hệ thống</span>
          </div>
          {/* STT Input Language Switcher */}
          <div
            className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] shadow-inner backdrop-blur-md text-[9px] select-none"
            title="Ngôn ngữ giọng nói đầu vào (Chọn VI để chống nhảy sang tiếng Thái/Hàn/Trung khi dùng Whisper)"
          >
            <button
              type="button"
              onClick={() => onSttLangChange?.('vi')}
              className={cn(
                'px-2 py-0.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sttLang === 'vi'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
              )}
              title="Khóa nhận diện Tiếng Việt (Whisper -l vi, chuẩn xác không bị lẫn tiếng nước ngoài)"
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => onSttLangChange?.('en')}
              className={cn(
                'px-2 py-0.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sttLang === 'en'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
              )}
              title="Khóa nhận diện Tiếng Anh (Whisper -l en)"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onSttLangChange?.('auto')}
              className={cn(
                'px-2 py-0.5 rounded-lg font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                sttLang === 'auto'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
              )}
              title="Tự động nhận diện ngôn ngữ (Whisper -l auto)"
            >
              Auto
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <TranscriptSearchBar
        isOpen={isSearchOpen}
        query={searchQuery}
        onQueryChange={(q) => {
          setSearchQuery(q)
          setCurrentMatchIndex(0)
        }}
        matchCount={matchedLineIds.length}
        currentIndex={currentMatchIndex}
        onNext={handleNextMatch}
        onPrev={handlePrevMatch}
        onClose={() => {
          setIsSearchOpen(false)
          setSearchQuery('')
        }}
      />

      {/* Sub Toolbar: STT Engine Badge, Native Telemetry & Clear */}
      <TranscriptSubToolbar
        sttEngineLabel={sttEngineLabel}
        queueMetrics={queueMetrics}
        hasLines={validLines.length > 0}
        onClearTranscript={onClearTranscript}
      />

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
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="Tải thêm 50 câu thoại trước đó vào danh sách"
                  >
                    + 50 câu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAllExpanded(true)}
                    className="px-2 py-0.5 rounded bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 transition-colors cursor-pointer"
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
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white transition-colors cursor-pointer"
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
                    Nhấn nút bên dưới để bắt đầu thu âm cuộc gọi (Hệ thống). AI sẽ tự động nhận diện và dịch song ngữ thời gian thực.
                  </p>
                </div>
                <Button
                  onClick={onToggleListening}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] h-7 px-3 font-medium gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
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
                    Đang lắng nghe âm thanh từ cuộc gọi/YouTube. Văn bản và bản dịch tiếng Việt sẽ tự động xuất hiện tại đây.
                  </p>
                </div>
              </div>
            )}

            {/* Strongly memoized virtual transcript line items */}
            {visibleLines.map((line, idx) => (
              <TranscriptLineItem
                key={line.id}
                line={line}
                isLatest={idx === visibleLines.length - 1}
                isMatched={matchedLineIds[currentMatchIndex] === line.id}
                isCopied={copiedLineId === line.id}
                searchQuery={searchQuery}
                onCopy={handleCopyLine}
              />
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
            className="absolute bottom-2 right-4 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600/90 hover:bg-violet-600 text-white shadow-lg shadow-violet-950/60 border border-violet-400/30 text-[10.5px] font-medium backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
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
          isSummaryExpanded ? 'max-h-[85%]' : 'max-h-[50%]'
        )}
      >
        <LatestExchangeCard
          latestExchange={latestExchange}
          latestLine={latestLine}
          mode={mode}
          isScanningExchange={isScanningExchange}
        />

        <TranscriptSummarySection
          meetingSummary={meetingSummary}
          isSummarizing={isSummarizing}
          summaryError={summaryError}
          copiedSummary={copiedSummary}
          onCopySummary={onCopySummary}
          onGenerateSummary={onGenerateSummary}
          validLines={validLines}
          showTranslate={showTranslate}
          isSummaryExpanded={isSummaryExpanded}
          onToggleExpanded={() => setIsSummaryExpanded((prev) => !prev)}
          summaryDisplay={summaryDisplay}
          summaryTr={summaryTr}
          summaryShowingVi={summaryShowingVi}
          onToggleTranslation={() => {
            if (meetingSummary) {
              void toggleTranslation('summary', meetingSummary)
            }
          }}
        />
      </div>
    </section>
  )
}
