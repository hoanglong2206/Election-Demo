import { ScrollArea } from '@/components/ui/scroll-area'
import type { MeetingSession, SessionDateFilter } from '@/services/session-history'
import type { ModeFilter } from '../../types'
import type { ProfileFilterOption } from '../../hooks/useSessionFilter'
import { SidebarFilterHeader } from './SidebarFilterHeader'
import { SidebarModePills } from './SidebarModePills'
import { SidebarBulkActionsBar } from './SidebarBulkActionsBar'
import { SessionListItemCard } from './SessionListItemCard'

export interface SessionSidebarProps {
  sessions: MeetingSession[]
  filteredSessions: MeetingSession[]
  selectedSessionId: string
  searchTerm: string
  modeFilter: ModeFilter
  dateFilter: SessionDateFilter
  profileFilter: string
  availableProfiles: ProfileFilterOption[]
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
  const isAllSelected =
    filteredSessions.length > 0 && selectedSessionIds.size === filteredSessions.length

  return (
    <div className="w-[316px] min-w-[316px] max-w-[316px] shrink-0 flex flex-col gap-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
      {/* Search and Advanced Filters */}
      <SidebarFilterHeader
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        dateFilter={dateFilter}
        onDateFilterChange={onDateFilterChange}
        profileFilter={profileFilter}
        onProfileFilterChange={onProfileFilterChange}
        availableProfiles={availableProfiles}
      />

      {/* Mode Filter Pills */}
      <SidebarModePills
        modeFilter={modeFilter}
        onModeFilterChange={onModeFilterChange}
        totalCount={sessions.length}
      />

      {/* Bulk Select Control Bar */}
      <SidebarBulkActionsBar
        isSelectMode={isSelectMode}
        isAllSelected={isAllSelected}
        selectedCount={selectedSessionIds.size}
        totalFilteredCount={filteredSessions.length}
        onToggleSelectMode={onToggleSelectMode}
        onToggleSelectAll={onToggleSelectAll}
        onDeleteSelected={onDeleteSelected}
      />

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
            filteredSessions.map((s) => (
              <SessionListItemCard
                key={s.id}
                session={s}
                isSelected={selectedSessionId === s.id}
                isBulkSelected={selectedSessionIds.has(s.id)}
                isSelectMode={isSelectMode}
                onSelect={onSelectSession}
                onToggleSelect={onToggleSelectSession}
                onDelete={onDeleteSession}
                onStartRename={onStartRename}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

