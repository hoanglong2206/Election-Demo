import { Sparkles, Copy, Check } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { HistorySuggestion } from '@/services/sessionHistory'

export interface SuggestionsTabViewProps {
  suggestions: HistorySuggestion[] | undefined
  copiedId: number | null
  onCopyText: (text: string, id: number) => void
}

export function SuggestionsTabView({
  suggestions = [],
  copiedId,
  onCopyText,
}: SuggestionsTabViewProps) {
  return (
    <ScrollArea className="h-full p-4 custom-scrollbar">
      <div className="space-y-3 max-w-3xl mx-auto">
        {suggestions.length === 0 ? (
          <div className="py-16 text-center text-white/35 text-xs">
            <Sparkles className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="font-medium text-white/50">Chưa có gợi ý AI nào</p>
            <p className="text-[10.5px] text-white/30 mt-1">
              Chưa có câu trả lời gợi ý nào được sinh ra trong buổi họp này.
            </p>
          </div>
        ) : (
          suggestions.map((s, idx) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {s.type === 'answer'
                    ? `Gợi ý câu trả lời #${idx + 1}`
                    : s.label || `Phương án #${idx + 1}`}
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
  )
}

