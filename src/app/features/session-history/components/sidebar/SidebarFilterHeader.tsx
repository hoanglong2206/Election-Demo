import { useState } from 'react'
import { Search, X, Filter } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import type { SessionDateFilter } from '@/services/session-history'
import type { ProfileFilterOption } from '../../hooks/useSessionFilter'

export interface SidebarFilterHeaderProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  dateFilter: SessionDateFilter
  onDateFilterChange: (filter: SessionDateFilter) => void
  profileFilter: string
  onProfileFilterChange: (profileId: string) => void
  availableProfiles: ProfileFilterOption[]
}

const DATE_FILTER_OPTIONS: { id: SessionDateFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'last_7_days', label: '7 ngày' },
  { id: 'last_30_days', label: '30 ngày' },
]

export function SidebarFilterHeader({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  profileFilter,
  onProfileFilterChange,
  availableProfiles,
}: SidebarFilterHeaderProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const hasActiveAdvancedFilter = dateFilter !== 'all' || (profileFilter && profileFilter !== 'all')

  return (
    <>
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

      {showAdvancedFilters && (
        <div className="p-2 bg-black/50 border border-white/10 rounded-lg space-y-2 animate-fade-in text-[10px]">
          <div className="space-y-1">
            <span className="text-white/40 font-medium block">Khoảng thời gian:</span>
            <div className="grid grid-cols-4 gap-1">
              {DATE_FILTER_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDateFilterChange(d.id)}
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
    </>
  )
}

