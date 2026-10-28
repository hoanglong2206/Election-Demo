import { History, ArrowRight, Calendar, Download, Printer, ShieldCheck, MessageSquare } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { exportSessionToMarkdown, exportSessionToPDF, type MeetingSession } from '@/services/session-history'
import { cn } from '@/lib/utils'

export interface RecentSessionsCardProps {
  className?: string
  recentSessions: MeetingSession[]
  totalSessionsCount: number
  onViewAllHistory: () => void
}

export function RecentSessionsCard({
  className,
  recentSessions,
  totalSessionsCount,
  onViewAllHistory,
}: RecentSessionsCardProps) {
  return (
    <Card className={cn('bg-white/[0.03] border-white/[0.07] shadow-none p-2.5 sm:p-3 flex flex-col justify-between gap-2 min-w-0 overflow-hidden', className)}>
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.05] gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          <History className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[11.5px] font-semibold text-white/90 whitespace-nowrap">
            Lịch Sử Gần Đây
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[8.5px] px-1.5 py-0 border font-mono shrink-0 whitespace-nowrap ml-0.5',
              totalSessionsCount > 0
                ? 'bg-violet-500/10 text-violet-300 border-violet-500/25'
                : 'bg-white/5 text-white/40 border-white/10'
            )}
          >
            {totalSessionsCount} phiên
          </Badge>
        </div>

        <Button
          id="btn-view-all-history"
          variant="ghost"
          size="sm"
          onClick={onViewAllHistory}
          className="text-violet-300 hover:text-white text-[10px] h-6 px-1.5 hover:bg-violet-500/15 gap-1 font-medium whitespace-nowrap shrink-0 transition-colors"
        >
          <span>Xem tất cả</span>
          <ArrowRight className="w-2.5 h-2.5 shrink-0" />
        </Button>
      </div>

      {/* ── Sessions Content ── */}
      {recentSessions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-h-0">
          {recentSessions.slice(0, 2).map((s) => (
            <div
              key={s.id}
              className="p-2 sm:p-2.5 rounded-lg bg-black/30 border border-white/[0.06] hover:bg-white/[0.04] hover:border-violet-500/30 transition-all flex flex-col justify-between gap-1.5 border-l-2 border-l-violet-500 group min-w-0"
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between text-[8.5px] text-white/40 mb-1 gap-1">
                  <span className="flex items-center gap-1 font-mono text-white/50 truncate">
                    <Calendar className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                    <span>{s.date.split(' ')[0]}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[7.5px] px-1 py-0 border font-mono uppercase shrink-0 whitespace-nowrap',
                      s.mode === 'interview'
                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    )}
                  >
                    {s.mode === 'interview' ? 'Phỏng vấn' : 'Thảo luận'}
                  </Badge>
                </div>
                <h4
                  className="text-[11px] font-medium text-white/90 truncate leading-snug group-hover:text-violet-200 transition-colors"
                  title={s.title}
                >
                  {s.title}
                </h4>
              </div>

              {/* Quick Export actions */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[9px] shrink-0">
                <span className="text-white/40 font-mono text-[8.5px] flex items-center gap-1 truncate">
                  <MessageSquare className="w-2.5 h-2.5 text-white/30 shrink-0" />
                  <span>{s.transcripts?.length || 0} hội thoại</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportSessionToMarkdown(s)}
                    className="text-[9px] text-white/60 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-violet-500/20 border border-white/[0.08] hover:border-violet-500/30 whitespace-nowrap transition-all"
                    title="Xuất Markdown (.md)"
                  >
                    <Download className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                    <span>MD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportSessionToPDF(s)}
                    className="text-[9px] text-white/60 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-emerald-500/20 border border-white/[0.08] hover:border-emerald-500/30 whitespace-nowrap transition-all"
                    title="Xuất PDF"
                  >
                    <Printer className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-lg bg-black/20 border border-white/[0.04] text-center gap-1 min-h-[95px]">
          <div className="w-6 h-6 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-0.5">
            <History className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-medium text-white/80">Chưa có phiên lưu trữ</span>
          <p className="text-[9.5px] text-white/40 max-w-[280px] leading-tight">
            Hội thoại & tư vấn AI sẽ tự động lưu lại tại đây sau mỗi phiên họp.
          </p>
          <div className="flex items-center gap-1 text-[8px] text-emerald-400/80 font-mono mt-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span>Bảo mật 100% trên máy (Local Storage)</span>
          </div>
        </div>
      )}

      {/* ── Footnote (when sessions exist) ── */}
      {recentSessions.length > 0 && (
        <div className="flex items-center justify-between text-[8.5px] text-white/35 px-0.5 shrink-0 pt-0.5 border-t border-white/[0.03]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400/70 shrink-0" />
            <span>Lưu cục bộ an toàn</span>
          </span>
          <span className="font-mono text-emerald-400/70">Auto-Saved</span>
        </div>
      )}
    </Card>
  )
}
