import { cn } from '@/lib/utils'
import type { ModeFilter } from '../../types'

export interface SidebarModePillsProps {
  modeFilter: ModeFilter
  onModeFilterChange: (filter: ModeFilter) => void
  totalCount: number
}

export function SidebarModePills({
  modeFilter,
  onModeFilterChange,
  totalCount,
}: SidebarModePillsProps) {
  return (
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
        Tất cả ({totalCount})
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
  )
}

