import React, { useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { detectLanguage } from '@/services/ai-model/translation'
import type { TranscriptLine } from '../../types'
import { HighlightText } from './HighlightText'

export interface TranscriptLineItemProps {
  line: TranscriptLine
  isLatest: boolean
  isMatched: boolean
  isCopied: boolean
  searchQuery: string
  onCopy: (line: TranscriptLine) => void
}

export const TranscriptLineItem = React.memo(
  function TranscriptLineItem({
    line,
    isLatest,
    isMatched,
    isCopied,
    searchQuery,
    onCopy,
  }: TranscriptLineItemProps) {
    const shouldTranslate = useMemo(() => {
      if (line.translated) return false
      return detectLanguage(line.original).shouldTranslateToVi
    }, [line.translated, line.original])

    return (
      <div
        id={`transcript-line-${line.id}`}
        className={cn(
          'group animate-fade-in transition-opacity',
          isLatest ? 'opacity-100' : 'opacity-85 hover:opacity-100',
          isMatched && 'ring-1 ring-amber-400/50 bg-amber-500/[0.06] rounded-lg p-1.5'
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
              <HighlightText text={line.speaker} query={searchQuery} />
            </span>
            <span className="text-white/20">&bull;</span>
            <span className="text-[10px] text-white/35 font-mono">
              <HighlightText text={line.timestamp} query={searchQuery} />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onCopy(line)}
            className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded text-white/40 hover:text-white transition-opacity"
            title="Sao chép câu thoại"
          >
            {isCopied ? (
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            ) : (
              <Copy className="w-2.5 h-2.5" />
            )}
          </button>
        </div>

        {line.translated && line.translated !== line.original ? (
          <div className="space-y-1">
            <p className="text-[12.5px] leading-relaxed text-white font-medium">
              <HighlightText text={line.original} query={searchQuery} />
            </p>
            <div className="text-[12px] leading-relaxed text-emerald-300 font-normal border-t border-white/[0.06] pt-1 flex items-start gap-1.5">
              <span>
                <HighlightText text={line.translated} query={searchQuery} />
              </span>
            </div>
          </div>
        ) : shouldTranslate ? (
          <div className="space-y-1">
            <p className="text-[12.5px] leading-relaxed text-white font-medium">
              <HighlightText text={line.original} query={searchQuery} />
            </p>
            <div className="text-[11px] text-white/40 italic flex items-center gap-1.5 pt-0.5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
              <span>Đang dịch...</span>
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-white font-medium tracking-normal">
            <HighlightText text={line.original} query={searchQuery} />
          </p>
        )}
      </div>
    )
  },
  (prev, next) => {
    return (
      prev.line.id === next.line.id &&
      prev.line.original === next.line.original &&
      prev.line.translated === next.line.translated &&
      prev.line.speaker === next.line.speaker &&
      prev.line.timestamp === next.line.timestamp &&
      prev.isLatest === next.isLatest &&
      prev.isMatched === next.isMatched &&
      prev.isCopied === next.isCopied &&
      prev.searchQuery === next.searchQuery
    )
  }
)
