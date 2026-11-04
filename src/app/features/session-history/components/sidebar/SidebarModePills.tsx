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
    <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.08] shadow-inner backdrop-blur-md select-none">
      <button
        type="button"
        onClick={() => onModeFilterChange('all')}
        className={cn(
          'flex-1 py-1 px-2 text-[10px] rounded-lg transition-all duration-200 text-center font-medium border cursor-pointer select-none active:scale-[0.98] whitespace-nowrap',
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
          'flex-1 py-1 px-2 text-[10px] rounded-lg transition-all duration-200 text-center font-medium border cursor-pointer select-none active:scale-[0.98] whitespace-nowrap',
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
          'flex-1 py-1 px-2 text-[10px] rounded-lg transition-all duration-200 text-center font-medium border cursor-pointer select-none active:scale-[0.98] whitespace-nowrap',
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
