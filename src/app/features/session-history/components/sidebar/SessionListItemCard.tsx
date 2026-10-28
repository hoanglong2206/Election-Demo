import { Clock, Calendar, Trash2, Pencil, User, Briefcase, Layers, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MeetingSession } from '@/services/session-history'

export interface SessionListItemCardProps {
  session: MeetingSession
  isSelected: boolean
  isBulkSelected: boolean
  isSelectMode: boolean
  onSelect: (id: string) => void
  onToggleSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onStartRename?: (id: string) => void
}

export function SessionListItemCard({
  session: s,
  isSelected,
  isBulkSelected,
  isSelectMode,
  onSelect,
  onToggleSelect,
  onDelete,
  onStartRename,
}: SessionListItemCardProps) {
  // Profile name or snapshot
  const profileLabel = s.profileSnapshot?.name || s.candidateName?.split(' (')[0] || null
  const companyOrRole = s.companyName || s.profileSnapshot?.companyName || s.targetRole || null

  const totalInteractions =
    s.metrics?.totalInteractions ??
    ((s.transcripts || []).length + (s.suggestions || []).length + (s.screenshotQuestions?.length || 0))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isSelectMode) {
          onToggleSelect(s.id)
        }
        onSelect(s.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (isSelectMode) onToggleSelect(s.id)
          onSelect(s.id)
        }
      }}
      className={cn(
        'group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5',
        isBulkSelected
          ? 'bg-violet-600/25 border-violet-500/60 shadow-sm ring-1 ring-violet-500/30'
          : isSelected
          ? 'bg-violet-600/20 border-violet-500/50 shadow-sm'
          : 'bg-white/[0.015] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      )}
    >
      {/* Title & Actions */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isSelectMode && (
            <input
              type="checkbox"
              checked={isBulkSelected}
              onChange={(e) => {
                e.stopPropagation()
                onToggleSelect(s.id)
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-violet-600 focus:ring-0 cursor-pointer accent-violet-600 shrink-0"
            />
          )}
          <span
            className={cn(
              'text-[12px] font-semibold leading-snug line-clamp-1 transition-colors',
              isSelected || isBulkSelected ? 'text-white' : 'text-white/85'
            )}
          >
            {s.title}
          </span>
        </div>

        {!isSelectMode && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
            {onStartRename && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(s.id)
                  onStartRename(s.id)
                }}
                title="Đổi tên buổi họp này"
                className="p-1 hover:bg-violet-500/20 text-white/40 hover:text-violet-300 rounded transition-all"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => onDelete(s.id, e)}
              title="Xóa buổi họp này"
              className="p-1 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Profile and Company info */}
      {(profileLabel || companyOrRole) && (
        <div className="flex items-center gap-1.5 text-[9.5px] text-white/60 truncate">
          {profileLabel && (
            <span className="flex items-center gap-1 text-violet-300 font-medium truncate">
              <User className="w-2.5 h-2.5 text-violet-400 shrink-0" />
              <span className="truncate">{profileLabel}</span>
            </span>
          )}
          {profileLabel && companyOrRole && <span>&bull;</span>}
          {companyOrRole && (
            <span className="flex items-center gap-1 text-white/50 truncate">
              <Briefcase className="w-2.5 h-2.5 text-white/40 shrink-0" />
              <span className="truncate">{companyOrRole}</span>
            </span>
          )}
        </div>
      )}

      {/* Mode, Duration & Date */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[9.5px]">
        <Badge
          variant="outline"
          className={cn(
            'text-[8px] px-1 py-0 border font-medium',
            s.mode === 'interview'
              ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          )}
        >
          {s.mode === 'interview' ? 'Interview' : 'Discussion'}
        </Badge>

        <span className="text-white/40 flex items-center gap-0.5">
          <Clock className="w-2 h-2" />
          {s.durationMinutes}m
        </span>

        <span className="text-white/40 flex items-center gap-0.5 ml-auto">
          <Calendar className="w-2 h-2" />
          {s.date.split(' ')[0]}
        </span>
      </div>

      {/* Interaction Count Metrics Bar */}
      <div className="flex items-center justify-between text-[9px] text-white/40 pt-1 border-t border-white/[0.04]">
        <span className="flex items-center gap-1">
          <Layers className="w-2.5 h-2.5 text-white/30" />
          <span>{totalInteractions} tương tác</span>
          <span className="opacity-40">
            ({(s.transcripts || []).length} thoại, {(s.suggestions || []).length} AI
            {s.screenshotQuestions?.length ? `, ${s.screenshotQuestions.length} ảnh` : ''})
          </span>
        </span>

        <div className="flex items-center gap-1.5 ml-auto font-mono text-[8.5px]">
          {s.metrics?.totalTokens && s.metrics.totalTokens > 0 ? (
            <span className="flex items-center gap-0.5 text-cyan-400">
              <Coins className="w-2 h-2" />
              <span>{(s.metrics.totalTokens / 1000).toFixed(1)}k</span>
            </span>
          ) : null}
          {s.metrics?.costStatus === 'free' ? (
            <span className="text-emerald-400 bg-emerald-500/15 px-1 py-0.2 rounded border border-emerald-500/20 font-sans font-medium text-[8px]">
              Free
            </span>
          ) : s.metrics?.costStatus === 'unknown' ? (
            <span className="text-amber-400 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/20 font-sans font-medium text-[8px]">
              Unknown
            </span>
          ) : s.metrics?.estimatedCostUsd !== undefined && s.metrics.estimatedCostUsd > 0 ? (
            <span className="text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20 font-medium">
              ${s.metrics.estimatedCostUsd < 0.01 ? s.metrics.estimatedCostUsd.toFixed(4) : s.metrics.estimatedCostUsd.toFixed(3)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

