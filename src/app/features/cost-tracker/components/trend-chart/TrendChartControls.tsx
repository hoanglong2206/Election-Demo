import type { ChartDaysRange, ChartMetricMode } from '../../types'
import { cn } from '@/lib/utils'

interface TrendChartControlsProps {
  metricMode: ChartMetricMode
  onMetricModeChange: (mode: ChartMetricMode) => void
  days: ChartDaysRange
  onDaysChange: (days: ChartDaysRange) => void
}

export function TrendChartControls({
  metricMode,
  onMetricModeChange,
  days,
  onDaysChange,
}: TrendChartControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
      {/* Metric Switcher */}
      <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px]">
        <button
          type="button"
          onClick={() => onMetricModeChange('cost')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            metricMode === 'cost'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Chi phí ($)
        </button>
        <button
          type="button"
          onClick={() => onMetricModeChange('tokens')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            metricMode === 'tokens'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Tokens
        </button>
        <button
          type="button"
          onClick={() => onMetricModeChange('requests')}
          className={cn(
            'px-2.5 py-1 rounded-md transition-colors font-medium border',
            metricMode === 'requests'
              ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm'
              : 'border-transparent text-white/50 hover:text-white'
          )}
        >
          Số Request
        </button>
      </div>

      {/* Time range selector */}
      <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px]">
        {([7, 14, 30] as ChartDaysRange[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDaysChange(d)}
            className={cn(
              'px-2.5 py-1 rounded-md transition-colors font-mono font-medium border',
              days === d
                ? 'bg-white/15 text-white border-white/20'
                : 'border-transparent text-white/40 hover:text-white'
            )}
          >
            {d}d
          </button>
        ))}
      </div>
    </div>
  )
}

