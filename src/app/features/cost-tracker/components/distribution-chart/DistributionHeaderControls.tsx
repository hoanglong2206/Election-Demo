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
      <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px]">
        <button
          type="button"
          onClick={() => onCategoryChange('provider')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            category === 'provider'
              ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Nhà Cung Cấp
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange('model')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            category === 'model'
              ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Mô Hình
        </button>
        <button
          type="button"
          onClick={() => onCategoryChange('feature')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            category === 'feature'
              ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Tính Năng
        </button>
      </div>

      {/* Metric Selector */}
      <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10px]">
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

