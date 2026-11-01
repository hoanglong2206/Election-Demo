import { useState, useRef, useEffect } from 'react'
import { FileText, Download, Printer, Trash2, Database, ChevronDown, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  exportSessionToMarkdown,
  exportSessionToJson,
  exportSessionToPDF,
  type MeetingSession,
} from '@/services/session-history'

export interface SessionHeaderProps {
  totalSessions: number
  currentSession: MeetingSession | null
  onClearAll?: () => void
  retentionDays?: number
  onRetentionDaysChange?: (days: number) => void
}

const RETENTION_OPTIONS = [
  { days: 0, label: 'Lưu vĩnh viễn (Không xóa)' },
  { days: 7, label: 'Lưu 7 ngày gần nhất' },
  { days: 30, label: 'Lưu 30 ngày (Khuyên dùng)' },
  { days: 90, label: 'Lưu 90 ngày (3 tháng)' },
]

export function SessionHeader({
  totalSessions,
  currentSession,
  onClearAll,
  retentionDays = 0,
  onRetentionDaysChange,
}: SessionHeaderProps) {
  const [isRetentionOpen, setIsRetentionOpen] = useState(false)
  const retentionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (retentionRef.current && !retentionRef.current.contains(e.target as Node)) {
        setIsRetentionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2 gap-2">
      <div className="flex items-center gap-2.5 flex-1">
        <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-violet-400" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-white/95">
              Lịch Sử Cuộc Họp & Phỏng Vấn (Session History)
            </h2>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 border-violet-500/30 bg-violet-500/10 text-violet-300"
            >
              {totalSessions} buổi họp
            </Badge>
          </div>
          <p className="text-[10px] text-white/40 hidden sm:block">
            Xem lại toàn bộ transcript timeline, câu trả lời gợi ý của AI, câu hỏi hình ảnh và xuất báo cáo
          </p>
        </div>
      </div>

      {/* Action, Retention & Export Buttons */}
      <div className="flex items-center gap-1.5 justify-end">
        {/* Retention Policy Dropdown */}
        {onRetentionDaysChange && (
          <div ref={retentionRef} className="relative">
            <button
              type="button"
              onClick={() => setIsRetentionOpen(!isRetentionOpen)}
              aria-haspopup="listbox"
              aria-expanded={isRetentionOpen}
              className={cn(
                'flex items-center gap-1.5 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-violet-500/40 text-white/90 px-2.5 py-1.5 rounded-xl text-[10.5px] transition-all duration-200 active:scale-[0.99] shadow-inner select-none cursor-pointer',
                isRetentionOpen && 'border-violet-500/60 ring-2 ring-violet-500/25'
              )}
              title="Cấu hình thời gian tự động dọn dẹp các phiên họp cũ (Local Retention)"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Retention: {retentionDays === 0 ? 'Vĩnh viễn' : `${retentionDays}d`}</span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
                  isRetentionOpen && 'rotate-180 text-violet-400'
                )}
              />
            </button>

            {isRetentionOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-[#0c101d]/95 border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ease-out text-[10.5px]"
              >
                <div className="px-2 py-1 text-[9.5px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/5">
                  Thời gian lưu trữ cục bộ
                </div>
                {RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => {
                      onRetentionDaysChange(opt.days)
                      setIsRetentionOpen(false)
                    }}
                    className={cn(
                      'w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition-all duration-150 select-none cursor-pointer text-xs',
                      retentionDays === opt.days
                        ? 'bg-violet-600/25 text-violet-200 border border-violet-500/35 font-medium shadow-sm'
                        : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                    )}
                  >
                    <span>{opt.label}</span>
                    {retentionDays === opt.days && (
                      <Check className="w-3 h-3 text-violet-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {totalSessions > 0 && onClearAll && (
          <Button
            id="btn-clear-all-sessions"
            size="sm"
            variant="outline"
            onClick={onClearAll}
            className="bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-[10.5px] h-7 px-2.5 gap-1.5 transition-colors"
            title="Xóa toàn bộ lịch sử cuộc họp"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span>Xóa tất cả</span>
          </Button>
        )}

        {currentSession && (
          <>
            <Button
              id="btn-export-markdown"
              size="sm"
              variant="outline"
              onClick={() => exportSessionToMarkdown(currentSession)}
              className="bg-white/[0.04] border-white/10 hover:bg-white/10 text-white text-[10.5px] h-7 px-2.5 gap-1.5"
              title="Tải về file Markdown chứa đầy đủ timeline và câu hỏi"
            >
              <Download className="w-3 h-3 text-violet-400" />
              <span>Export MD</span>
            </Button>

            <Button
              id="btn-export-json"
              size="sm"
              variant="outline"
              onClick={() => exportSessionToJson(currentSession)}
              className="bg-white/[0.04] border-white/10 hover:bg-white/10 text-white text-[10.5px] h-7 px-2.5 gap-1.5"
              title="Tải về file JSON định dạng chuẩn Schema v2.0"
            >
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Export JSON</span>
            </Button>

            <Button
              id="btn-export-pdf"
              size="sm"
              onClick={() => exportSessionToPDF(currentSession)}
              className="bg-violet-600 hover:bg-violet-500 text-white text-[10.5px] h-7 px-2.5 gap-1.5 shadow-sm font-medium"
              title="In hoặc lưu dạng PDF"
            >
              <Printer className="w-3 h-3" />
              <span>Export PDF</span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

