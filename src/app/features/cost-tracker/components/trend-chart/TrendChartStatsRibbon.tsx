import type { ChartDaysRange } from '../../types'
import type { TrendSummaryStats } from '../../utils/trendChartMath'

interface TrendChartStatsRibbonProps {
  summaryStats: TrendSummaryStats
  days: ChartDaysRange
  format: (v: number) => string
}

export function TrendChartStatsRibbon({
  summaryStats,
  days,
  format,
}: TrendChartStatsRibbonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.05]">
      <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
        <span className="text-[9.5px] text-white/40">Tổng trong {days} ngày</span>
        <span className="text-[12px] font-mono font-bold text-white/90 mt-0.5">
          {format(summaryStats.total)}
        </span>
      </div>

      <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
        <span className="text-[9.5px] text-white/40">Cao nhất (Peak Day)</span>
        <span className="text-[12px] font-mono font-bold text-emerald-400 mt-0.5">
          {format(summaryStats.peak)}
        </span>
      </div>

      <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
        <span className="text-[9.5px] text-white/40">Trung bình ngày</span>
        <span className="text-[12px] font-mono font-bold text-cyan-300 mt-0.5">
          {format(summaryStats.avg)}
        </span>
      </div>

      <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
        <span className="text-[9.5px] text-white/40">Số ngày có hoạt động</span>
        <span className="text-[12px] font-mono font-bold text-violet-300 mt-0.5">
          {summaryStats.activeDays} / {days} ngày
        </span>
      </div>
    </div>
  )
}

