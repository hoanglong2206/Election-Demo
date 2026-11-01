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
      <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] text-[10.5px] shadow-inner backdrop-blur-md gap-1 shrink-0 select-none">
        <button
          type="button"
          onClick={() => onMetricModeChange('cost')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            metricMode === 'cost'
              ? 'bg-emerald-500/25 text-emerald-100 border-emerald-500/40 shadow-sm shadow-emerald-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Chi phí ($)
        </button>
        <button
          type="button"
          onClick={() => onMetricModeChange('tokens')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            metricMode === 'tokens'
              ? 'bg-cyan-500/25 text-cyan-100 border-cyan-500/40 shadow-sm shadow-cyan-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Tokens
        </button>
        <button
          type="button"
          onClick={() => onMetricModeChange('requests')}
          className={cn(
            'px-2.5 py-1 rounded-lg transition-all duration-200 font-medium border select-none cursor-pointer active:scale-[0.98]',
            metricMode === 'requests'
              ? 'bg-violet-600/30 text-violet-100 border-violet-500/40 shadow-sm shadow-violet-500/20 font-semibold'
              : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06]'
          )}
        >
          Số Request
        </button>
      </div>

      {/* Time range selector */}
      <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] text-[10.5px] shadow-inner backdrop-blur-md gap-1 shrink-0 select-none">
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

