import { useState } from 'react'
import {
  Search,
  Clock,
  Calendar,
  Trash2,
  Pencil,
  CheckSquare,
  X,
  Filter,
  User,
  Briefcase,
  Layers,
  Coins,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import type { MeetingSession, SessionDateFilter } from '../../../services/sessionHistory'
import type { ModeFilter } from '../types'

interface SessionSidebarProps {
  sessions: MeetingSession[]
  filteredSessions: MeetingSession[]
  selectedSessionId: string
  searchTerm: string
  modeFilter: ModeFilter
  dateFilter: SessionDateFilter
  profileFilter: string
  availableProfiles: { id: string; name: string }[]
  onSelectSession: (id: string) => void
  onSearchChange: (term: string) => void
  onModeFilterChange: (filter: ModeFilter) => void
  onDateFilterChange: (filter: SessionDateFilter) => void
  onProfileFilterChange: (profileId: string) => void
  onDeleteSession: (id: string, e: React.MouseEvent) => void
  onStartRename?: (id: string) => void
  // Bulk selection props
  isSelectMode: boolean
  selectedSessionIds: Set<string>
  onToggleSelectMode: () => void
  onToggleSelectSession: (id: string) => void
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}

export function SessionSidebar({
  sessions,
  filteredSessions,
  selectedSessionId,
  searchTerm,
  modeFilter,
  dateFilter,
  profileFilter,
  availableProfiles,
  onSelectSession,
  onSearchChange,
  onModeFilterChange,
  onDateFilterChange,
  onProfileFilterChange,
  onDeleteSession,
  onStartRename,
  isSelectMode,
  selectedSessionIds,
  onToggleSelectMode,
  onToggleSelectSession,
  onToggleSelectAll,
  onDeleteSelected,
}: SessionSidebarProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const isAllSelected =
    filteredSessions.length > 0 && selectedSessionIds.size === filteredSessions.length

  const hasActiveAdvancedFilter = dateFilter !== 'all' || (profileFilter && profileFilter !== 'all')

  return (
    <div className="w-[316px] min-w-[316px] max-w-[316px] shrink-0 flex flex-col gap-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
      {/* Search bar with advanced filter toggle */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3 h-3 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm transcript, gợi ý, chủ đề..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={cn(
            'p-1.5 rounded-lg border text-[11px] transition-colors shrink-0',
            showAdvancedFilters || hasActiveAdvancedFilter
              ? 'bg-violet-600/25 border-violet-500/40 text-violet-300'
              : 'bg-black/30 border-white/[0.08] text-white/40 hover:text-white hover:bg-white/5'
          )}
          title="Bộ lọc nâng cao (Profile, Thời gian, Vị trí)"
        >
          <Filter className="w-3 h-3" />
        </button>
      </div>

      {/* Advanced Filters Panel (Collapsible) */}
      {showAdvancedFilters && (
        <div className="p-2 bg-black/50 border border-white/10 rounded-lg space-y-2 animate-fade-in text-[10px]">
          {/* Date Filter */}
          <div className="space-y-1">
            <span className="text-white/40 font-medium block">Khoảng thời gian:</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'today', label: 'Hôm nay' },
                { id: 'last_7_days', label: '7 ngày' },
                { id: 'last_30_days', label: '30 ngày' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDateFilterChange(d.id as SessionDateFilter)}
                  className={cn(
                    'py-1 rounded text-center transition-colors font-medium',
                    dateFilter === d.id
                      ? 'bg-violet-600/30 text-white border border-violet-500/40'
                      : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Filter */}
          {availableProfiles.length > 0 && (
            <div className="space-y-1">
              <span className="text-white/40 font-medium block">Lọc theo Profile:</span>
              <CustomSelect
                value={profileFilter}
                onChange={onProfileFilterChange}
                options={[
                  { value: 'all', label: `Tất cả Profile (${availableProfiles.length})` },
                  ...availableProfiles.map((p) => ({ value: p.id, label: p.name })),
                ]}
                themeColor="violet"
                triggerClassName="h-7 text-[10.5px] py-1"
              />
            </div>
          )}
        </div>
      )}

      {/* Mode Filter Pills */}
      <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/[0.05]">
        <button
          type="button"
          onClick={() => onModeFilterChange('all')}
          className={cn(
            'flex-1 py-0.5 text-[10px] rounded-md transition-colors text-center font-medium',
            modeFilter === 'all'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          Tất cả ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => onModeFilterChange('interview')}
          className={cn(
            'flex-1 py-0.5 text-[10px] rounded-md transition-colors text-center font-medium',
            modeFilter === 'interview'
              ? 'bg-violet-500/20 text-violet-300'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          Interview
        </button>
        <button
          type="button"
          onClick={() => onModeFilterChange('discussion')}
          className={cn(
            'flex-1 py-0.5 text-[10px] rounded-md transition-colors text-center font-medium',
            modeFilter === 'discussion'
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-white/40 hover:text-white/70'
          )}
        >
          Discussion
        </button>
      </div>

      {/* Bulk Select Control Bar */}
      {isSelectMode ? (
        <div className="flex items-center justify-between bg-violet-600/15 border border-violet-500/30 rounded-lg px-2 py-1 text-[10.5px] animate-fade-in shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={onToggleSelectAll}
              className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-violet-600 focus:ring-0 cursor-pointer accent-violet-600"
            />
            <span className="text-violet-200 font-semibold text-[10px]">
              {selectedSessionIds.size === 0
                ? 'Chọn tất cả'
                : `Đã chọn ${selectedSessionIds.size}/${filteredSessions.length}`}
            </span>
          </label>

          <div className="flex items-center gap-1">
            {selectedSessionIds.size > 0 && (
              <button
                type="button"
                onClick={onDeleteSelected}
                className="flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/35 px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors"
                title="Xóa các phiên đã chọn (Bulk Delete)"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>Xóa ({selectedSessionIds.size})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSelectMode}
              className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors"
              title="Thoát chế độ chọn"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        filteredSessions.length > 0 && (
          <div className="flex items-center justify-between text-[10px] text-white/45 px-1 pt-0.5 shrink-0">
            <span>{filteredSessions.length} phiên phù hợp</span>
            <button
              type="button"
              onClick={onToggleSelectMode}
              className="flex items-center gap-1 text-white/45 hover:text-violet-300 transition-colors font-medium"
              title="Bật chế độ chọn nhiều để xóa hàng loạt"
            >
              <CheckSquare className="w-3 h-3 text-violet-400" />
              <span>Chọn nhiều</span>
            </button>
          </div>
        )
      )}

      {/* Session Cards List */}
      <ScrollArea className="flex-1 min-h-0 pr-1 custom-scrollbar">
        <div className="space-y-1.5">
          {sessions.length === 0 ? (
            <div className="py-10 px-3 text-center text-white/35 text-[11px] leading-relaxed">
              <p className="font-medium text-white/50 mb-1">Chưa có cuộc họp nào</p>
              <p className="text-[10px] text-white/30">
                Hãy tiến hành cuộc họp và bấm <span className="text-violet-400 font-medium">"Lưu cuộc họp"</span> để lưu vào lịch sử.
              </p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-white/30 text-[11px]">
              Không tìm thấy buổi họp nào phù hợp với bộ lọc.
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isSelected = selectedSessionId === s.id
              const isBulkSelected = selectedSessionIds.has(s.id)

              // Profile name or snapshot
              const profileLabel = s.profileSnapshot?.name || s.candidateName?.split(' (')[0] || null
              const companyOrRole = s.companyName || s.profileSnapshot?.companyName || s.targetRole || null

              const totalInteractions =
                s.metrics?.totalInteractions ??
                ((s.transcripts || []).length + (s.suggestions || []).length + (s.screenshotQuestions?.length || 0))

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isSelectMode) {
                      onToggleSelectSession(s.id)
                    }
                    onSelectSession(s.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (isSelectMode) onToggleSelectSession(s.id)
                      onSelectSession(s.id)
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
                            onToggleSelectSession(s.id)
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
                              onSelectSession(s.id)
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
                          onClick={(e) => onDeleteSession(s.id, e)}
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
                      <span className="opacity-40">({(s.transcripts || []).length} thoại, {(s.suggestions || []).length} AI{s.screenshotQuestions?.length ? `, ${s.screenshotQuestions.length} ảnh` : ''})</span>
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
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
