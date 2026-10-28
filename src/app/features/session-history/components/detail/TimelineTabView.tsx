import { Clock, Sparkles, Camera, Copy, Check, Code } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TimelineItem } from '../../utils/sessionFormatters'

export interface TimelineTabViewProps {
  timelineItems: TimelineItem[]
  visibleCount: number
  highlightedId: string | number | null
  copiedId: number | null
  onTimestampClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onCopyText: (text: string, id: number) => void
  onPreviewImage: (url: string) => void
  onLoadMore: () => void
}

export function TimelineTabView({
  timelineItems,
  visibleCount,
  highlightedId,
  copiedId,
  onTimestampClick,
  onCopyText,
  onPreviewImage,
  onLoadMore,
}: TimelineTabViewProps) {
  const visibleTimeline = timelineItems.slice(0, visibleCount)
  const hasMoreTimeline = timelineItems.length > visibleCount

  return (
    <ScrollArea className="h-full p-4 custom-scrollbar">
      <div className="space-y-3 max-w-3xl mx-auto">
        {timelineItems.length === 0 ? (
          <div className="py-16 text-center text-white/35 text-xs">
            <Clock className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="font-medium text-white/50">Chưa có dòng thời gian</p>
            <p className="text-[10.5px] text-white/30 mt-1">
              Buổi họp này chưa có đoạn hội thoại hoặc tương tác AI nào được lưu.
            </p>
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
                      onClick={onTimestampClick}
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
                      onClick={onTimestampClick}
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
                        onClick={onTimestampClick}
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
                        onClick={() => onPreviewImage(sq.imageUrl || sq.thumbnailUrl || '')}
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
          })
        )}

        {/* Progressive Load More Button */}
        {hasMoreTimeline && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white text-[11px] font-medium transition-colors border border-white/10"
            >
              Tải thêm 40 mục tiếp theo ({visibleTimeline.length}/{timelineItems.length})
            </button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

