import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DistributionCategory, DistributionMetric } from '../../types'
import { FEATURE_NAMES } from '../../types'
import type { BreakdownListItem } from '../../utils/donutChartMath'

interface BreakdownItemListProps {
  breakdownItems: BreakdownListItem[]
  totalMetricValue: number
  rawItemsCount: number
  metric: DistributionMetric
  category: DistributionCategory
  hoveredSlice: string | null
  onHoverSlice: (name: string | null) => void
  onMetricChange: (metric: DistributionMetric) => void
  formatMetricValue: (val: number) => string
}

export function BreakdownItemList({
  breakdownItems,
  totalMetricValue,
  rawItemsCount,
  metric,
  category,
  hoveredSlice,
  onHoverSlice,
  onMetricChange,
  formatMetricValue,
}: BreakdownItemListProps) {
  return (
    <div className="lg:col-span-7 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
      {totalMetricValue <= 0 && rawItemsCount > 0 && metric === 'cost' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
          <span>
            💡 Cả <strong>{rawItemsCount} mục</strong> đều là $0.0000 (Free Tier hoặc STT Offline).
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onMetricChange('tokens')}
              className="px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-medium text-[10px] border border-cyan-500/30 transition-colors"
            >
              Xem theo Tokens
            </button>
            <button
              type="button"
              onClick={() => onMetricChange('requests')}
              className="px-2 py-0.5 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 font-medium text-[10px] border border-violet-500/30 transition-colors"
            >
              Xem theo Requests
            </button>
          </div>
        </div>
      )}

      {breakdownItems.map((slice) => {
        const isHovered = hoveredSlice === slice.name
        const displayName =
          category === 'feature'
            ? (FEATURE_NAMES as any)[slice.name] || slice.name
            : slice.name

        return (
          <div
            key={slice.name}
            onMouseEnter={() => onHoverSlice(slice.name)}
            onMouseLeave={() => onHoverSlice(null)}
            className={cn(
              'p-2.5 rounded-xl border transition-all cursor-pointer',
              isHovered
                ? 'bg-white/[0.06] border-white/20 shadow-lg'
                : 'bg-black/25 border-white/[0.05] hover:border-white/10'
            )}
          >
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-semibold text-white/90 truncate">
                  {displayName}
                </span>
                <span className="text-[10px] text-white/40 font-mono shrink-0">
                  ({slice.item.requests} reqs)
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                {metric !== 'cost' && (
                  <span className="text-white/40 text-[10px]">
                    ${slice.item.estimatedCostUsd.toFixed(4)}
                  </span>
                )}
                <span className="font-bold text-white">
                  {formatMetricValue(slice.value)}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 border font-mono bg-white/5 border-white/10 text-white/70"
                >
                  {slice.percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(2, slice.percentage)}%`,
                  backgroundColor: slice.color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

