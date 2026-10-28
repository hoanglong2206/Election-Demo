import { ScrollArea } from '@/components/ui/scroll-area'
import type { HistorySuggestion, HistoryTranscriptLine } from '@/services/session-history'

export interface SplitTabViewProps {
  sortedTranscripts: HistoryTranscriptLine[]
  suggestions: HistorySuggestion[] | undefined
}

export function SplitTabView({
  sortedTranscripts,
  suggestions = [],
}: SplitTabViewProps) {
  return (
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
            sortedTranscripts.map((t) => (
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
            Gợi Ý AI Copilot ({suggestions.length})
          </div>
          {suggestions.length === 0 ? (
            <div className="py-8 text-center text-white/35 text-xs">
              Chưa có gợi ý AI nào
            </div>
          ) : (
            suggestions.map((s, idx) => (
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
  )
}

