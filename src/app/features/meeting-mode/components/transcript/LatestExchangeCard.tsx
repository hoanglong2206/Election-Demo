import React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine, ScannedExchangeResult } from '../../types'

export interface LatestExchangeCardProps {
  latestExchange?: ScannedExchangeResult | null
  latestLine: TranscriptLine | null
  mode: AppMode
  isScanningExchange?: boolean
}

export const LatestExchangeCard = React.memo(function LatestExchangeCard({
  latestExchange,
  latestLine,
  mode,
  isScanningExchange = false,
}: LatestExchangeCardProps) {
  const currentSpeaker =
    latestExchange?.speaker ||
    latestLine?.speaker ||
    (mode === 'interview' ? 'Người phỏng vấn' : 'Cuộc họp')
  const currentTimestamp = latestExchange?.timestamp || latestLine?.timestamp || ''
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
})
