import { MessageSquare, Copy, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { HistoryTranscriptLine } from '@/services/session-history'

export interface TranscriptTabViewProps {
  sortedTranscripts: HistoryTranscriptLine[]
  visibleCount: number
  copiedId: number | null
  onCopyText: (text: string, id: number) => void
  onLoadMore: () => void
}

export function TranscriptTabView({
  sortedTranscripts,
  visibleCount,
  copiedId,
  onCopyText,
  onLoadMore,
}: TranscriptTabViewProps) {
  const visibleTranscripts = sortedTranscripts.slice(0, visibleCount)
  const hasMoreTranscripts = sortedTranscripts.length > visibleCount

  return (
    <ScrollArea className="h-full p-4 custom-scrollbar">
      <div className="space-y-2.5 max-w-3xl mx-auto">
        {sortedTranscripts.length === 0 ? (
          <div className="py-16 text-center text-white/35 text-xs">
            <MessageSquare className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="font-medium text-white/50">Chưa có đoạn hội thoại nào</p>
            <p className="text-[10.5px] text-white/30 mt-1">
              Không ghi nhận được lời thoại transcript trong buổi họp này.
            </p>
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

              {t.translated && t.translated !== t.original && (
                <div className="text-[11.5px] text-emerald-300/90 leading-relaxed border-t border-white/[0.04] pt-1.5 flex items-start gap-1.5">
                  <span className="text-[8.5px] uppercase font-mono tracking-wider text-emerald-400/90 font-semibold select-none shrink-0 mt-0.5 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                    Tiếng Việt
                  </span>
                  <span>{t.translated}</span>
                </div>
              )}
            </div>
          ))
        )}

        {hasMoreTranscripts && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-[11px] font-medium transition-colors border border-white/10"
            >
              Tải thêm 50 đoạn hội thoại ({visibleTranscripts.length}/{sortedTranscripts.length})
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

