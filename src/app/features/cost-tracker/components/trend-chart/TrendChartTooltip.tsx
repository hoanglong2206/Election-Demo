import { Calendar } from 'lucide-react'
import type { SvgPoint } from '../../utils/trendChartMath'

interface TrendChartTooltipProps {
  hoveredPoint: SvgPoint | null
  svgWidth: number
}

export function TrendChartTooltip({ hoveredPoint, svgWidth }: TrendChartTooltipProps) {
  if (!hoveredPoint) return null

  const leftPercent = Math.min(
    80,
    Math.max(10, (hoveredPoint.x / svgWidth) * 100)
  )

  return (
    <div
      className="absolute z-20 pointer-events-none bg-[#0c101d]/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-[11px] min-w-[170px] space-y-1.5 transition-all duration-75"
      style={{
        left: `${leftPercent}%`,
        top: '15px',
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <span className="font-semibold text-white/90 flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-cyan-400" />
          {hoveredPoint.data.date}
        </span>
        <span className="text-[10px] text-white/40">
          {hoveredPoint.data.requests} reqs
        </span>
      </div>

      <div className="space-y-1 font-mono text-[10.5px]">
        <div className="flex justify-between items-center">
          <span className="text-white/50 font-sans">Chi phí:</span>
          <span className="font-bold text-emerald-400">
            ${hoveredPoint.data.estimatedCostUsd.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/50 font-sans">Tổng token:</span>
          <span className="font-semibold text-cyan-300">
            {hoveredPoint.data.tokens.toLocaleString()}
          </span>
        </div>
        {hoveredPoint.data.inputTokens !== undefined && (
          <div className="flex justify-between items-center text-[9.5px] text-white/40 pl-2">
            <span>Input / Output:</span>
            <span>
              {hoveredPoint.data.inputTokens?.toLocaleString()} /{' '}
              {hoveredPoint.data.outputTokens?.toLocaleString()}
            </span>
          </div>
        )}
        {hoveredPoint.data.cachedTokens ? (
          <div className="flex justify-between items-center text-[9.5px] text-violet-300 pl-2">
            <span>Cached prompt:</span>
            <span>+{hoveredPoint.data.cachedTokens.toLocaleString()}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

