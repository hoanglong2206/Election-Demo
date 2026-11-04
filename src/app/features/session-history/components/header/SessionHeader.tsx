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
  const [isExportOpen, setIsExportOpen] = useState(false)
  const retentionRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (retentionRef.current && !retentionRef.current.contains(target)) {
        setIsRetentionOpen(false)
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setIsExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2 gap-2 shrink-0">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-violet-400" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[13px] font-semibold text-white/95 truncate whitespace-nowrap">
              Lịch Sử Cuộc Họp & Phỏng Vấn (Session History)
            </h2>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 border-violet-500/30 bg-violet-500/10 text-violet-300 shrink-0 whitespace-nowrap"
            >
              {totalSessions} buổi họp
            </Badge>
          </div>
          <p className="text-[10px] text-white/40 hidden sm:block truncate">
            Xem lại toàn bộ transcript timeline, câu trả lời gợi ý của AI, câu hỏi hình ảnh và xuất báo cáo
          </p>
        </div>
      </div>

      {/* Action, Retention & Export Dropdown */}
      <div className="flex items-center gap-1.5 justify-end shrink-0 whitespace-nowrap">
        {/* Retention Policy Dropdown */}
        {onRetentionDaysChange && (
          <div ref={retentionRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsRetentionOpen(!isRetentionOpen)}
              aria-haspopup="listbox"
              aria-expanded={isRetentionOpen}
              className={cn(
                'flex items-center gap-1.5 bg-black/50 hover:bg-black/70 border border-white/10 hover:border-violet-500/40 text-white/90 px-2.5 py-1.5 rounded-xl text-[10.5px] transition-all duration-200 active:scale-[0.99] shadow-inner select-none cursor-pointer whitespace-nowrap shrink-0',
                isRetentionOpen && 'border-violet-500/60 ring-2 ring-violet-500/25'
              )}
              title="Cấu hình thời gian tự động dọn dẹp các phiên họp cũ (Local Retention)"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="whitespace-nowrap">Retention: {retentionDays === 0 ? 'Vĩnh viễn' : `${retentionDays}d`}</span>
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

        {/* Clear All Sessions Button */}
        {totalSessions > 0 && onClearAll && (
          <Button
            id="btn-clear-all-sessions"
            size="sm"
            variant="outline"
            onClick={onClearAll}
            className="bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-[10.5px] h-7 px-2.5 gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Xóa toàn bộ lịch sử cuộc họp"
          >
            <Trash2 className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="whitespace-nowrap">Xóa tất cả</span>
          </Button>
        )}

        {/* Consolidated Export Dropdown */}
        {currentSession && (
          <div ref={exportRef} className="relative shrink-0">
            <button
              id="btn-export-dropdown"
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              aria-haspopup="menu"
              aria-expanded={isExportOpen}
              className={cn(
                'flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-1.5 rounded-xl text-[10.5px] font-medium transition-all duration-200 active:scale-[0.99] shadow-sm select-none cursor-pointer whitespace-nowrap shrink-0',
                isExportOpen && 'ring-2 ring-violet-400/40 bg-violet-500'
              )}
              title="Xuất báo cáo cuộc họp (PDF, Markdown, JSON)"
            >
              <Download className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="whitespace-nowrap">Xuất báo cáo</span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-white/70 shrink-0 transition-transform duration-200 ease-out',
                  isExportOpen && 'rotate-180 text-white'
                )}
              />
            </button>

            {isExportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-[#0c101d]/95 border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 ease-out text-[11px]"
              >
                <div className="px-2 py-1 text-[9.5px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 flex items-center justify-between">
                  <span>Định dạng xuất file</span>
                  <span className="text-[9px] text-violet-400 font-mono">3 định dạng</span>
                </div>

                {/* PDF */}
                <button
                  id="btn-export-pdf"
                  type="button"
                  onClick={() => {
                    exportSessionToPDF(currentSession)
                    setIsExportOpen(false)
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left flex items-center gap-2.5 hover:bg-white/[0.08] text-white/90 hover:text-white transition-all duration-150 select-none cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 group-hover:bg-violet-500/30 transition-colors">
                    <Printer className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white/95 text-[11px]">Xuất file PDF</span>
                      <span className="text-[8.5px] font-mono px-1 py-0 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">.pdf</span>
                    </div>
                    <p className="text-[9.5px] text-white/45 truncate">In hoặc lưu PDF hoàn chỉnh</p>
                  </div>
                </button>

                {/* Markdown */}
                <button
                  id="btn-export-markdown"
                  type="button"
                  onClick={() => {
                    exportSessionToMarkdown(currentSession)
                    setIsExportOpen(false)
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left flex items-center gap-2.5 hover:bg-white/[0.08] text-white/90 hover:text-white transition-all duration-150 select-none cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white/95 text-[11px]">Xuất Markdown</span>
                      <span className="text-[8.5px] font-mono px-1 py-0 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">.md</span>
                    </div>
                    <p className="text-[9.5px] text-white/45 truncate">Timeline, lời thoại & câu hỏi</p>
                  </div>
                </button>

                {/* JSON */}
                <button
                  id="btn-export-json"
                  type="button"
                  onClick={() => {
                    exportSessionToJson(currentSession)
                    setIsExportOpen(false)
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-left flex items-center gap-2.5 hover:bg-white/[0.08] text-white/90 hover:text-white transition-all duration-150 select-none cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/30 transition-colors">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white/95 text-[11px]">Xuất JSON</span>
                      <span className="text-[8.5px] font-mono px-1 py-0 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">.json</span>
                    </div>
                    <p className="text-[9.5px] text-white/45 truncate">Schema v2.0 đầy đủ dữ liệu gốc</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
