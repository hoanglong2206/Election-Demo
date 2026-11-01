import type { DistributionCategory, DistributionMetric } from '../../types'
import { cn } from '@/lib/utils'

interface DistributionHeaderControlsProps {
  category: DistributionCategory
  onCategoryChange: (cat: DistributionCategory) => void
  metric: DistributionMetric
  onMetricChange: (metric: DistributionMetric) => void
}

export function DistributionHeaderControls({
  category,
  onCategoryChange,
  metric,
  onMetricChange,
}: DistributionHeaderControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
      {/* Category Tabs */}
      <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] text-[10.5px] shadow-inner backdrop-blur-md gap-1 shrink-0 select-none">
        <button
          type="button"
          onClick={() => onCategoryChange('provider')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            category === 'provider'
              ? 'bg-violet-600/30 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Nhà Cung Cấp
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange('model')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            category === 'model'
              ? 'bg-violet-600/30 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Mô Hình
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange('feature')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            category === 'feature'
              ? 'bg-violet-600/30 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Tính Năng
        </button>
      </div>

      {/* Metric Selector */}
      <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] text-[10px] shadow-inner backdrop-blur-md gap-1 shrink-0 select-none">
        <button
          type="button"
          onClick={() => onMetricChange('cost')}
          className={cn(
            'px-2 py-1 rounded-md transition-colors font-medium border',
            metric === 'cost'
              ? 'bg-white/15 text-white border-white/20'
              : 'border-transparent text-white/40 hover:text-white'
          )}
        >
          Chi phí
        </button>
        <button
          type="button"
          onClick={() => onMetricChange('tokens')}
          className={cn(
            'px-2 py-1 rounded-md transition-colors font-medium border',
            metric === 'tokens'
              ? 'bg-white/15 text-white border-white/20'
              : 'border-transparent text-white/40 hover:text-white'
          )}
        >
          Tokens
        </button>
        <button
          type="button"
          onClick={() => onMetricChange('requests')}
          className={cn(
            'px-2 py-1 rounded-md transition-colors font-medium border',
            metric === 'requests'
              ? 'bg-white/15 text-white border-white/20'
              : 'border-transparent text-white/40 hover:text-white'
          )}
        >
          Requests
        </button>
      </div>
    </div>
  )
}

