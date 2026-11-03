import React from 'react'
import {
  Sparkles,
  RotateCcw,
  Minimize2,
  Maximize2,
  AlertCircle,
  Languages,
  Loader2,
  Check,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TranscriptLine } from '../../types'

export interface TranscriptSummarySectionProps {
  meetingSummary: string | null
  isSummarizing: boolean
  summaryError?: string | null
  copiedSummary: boolean
  onCopySummary: () => void
  onGenerateSummary: (lines: TranscriptLine[]) => void
  validLines: TranscriptLine[]
  showTranslate?: boolean
  isSummaryExpanded: boolean
  onToggleExpanded: () => void
  summaryDisplay: string | null
  summaryTr?: { busy?: boolean; error?: string }
  summaryShowingVi: boolean
  onToggleTranslation: () => void
}

export const TranscriptSummarySection = React.memo(
  function TranscriptSummarySection({
    meetingSummary,
    isSummarizing,
    summaryError,
    copiedSummary,
    onCopySummary,
    onGenerateSummary,
    validLines,
    showTranslate = false,
    isSummaryExpanded,
    onToggleExpanded,
    summaryDisplay,
    summaryTr,
    summaryShowingVi,
    onToggleTranslation,
  }: TranscriptSummarySectionProps) {
    return (
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
              <RotateCcw
                className={cn('w-2.5 h-2.5 text-amber-400', isSummarizing && 'animate-spin')}
              />
              <span>{isSummarizing ? 'Đang tóm tắt...' : 'Tóm tắt lại'}</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleExpanded}
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
        <div className="min-h-[64px] flex flex-col justify-center">
          {isSummarizing ? (
            <div className="py-2 px-1 space-y-1.5 animate-pulse">
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300/80 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>AI đang phân tích các câu thoại và tổng hợp nội dung cốt lõi...</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded w-3/4" />
              <div className="h-1.5 bg-white/10 rounded w-5/6" />
            </div>
          ) : meetingSummary ? (
            <div className="space-y-1.5">
              {summaryError && (
                <div className="text-rose-200/80 text-[10px] leading-relaxed py-0.5 flex items-start gap-1 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                  <AlertCircle className="w-3 h-3 text-rose-400 shrink-0 mt-px" />
                  <span className="min-w-0">{summaryError}</span>
                </div>
              )}
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
            </div>
          ) : summaryError ? (
            <div className="text-rose-200/80 text-[10.5px] leading-relaxed py-1 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0 mt-px" />
              <span className="min-w-0">{summaryError}</span>
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
        </div>

        <div className="flex items-center justify-end gap-2 mt-2.5">
          {meetingSummary && showTranslate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleTranslation}
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
    )
  }
)
