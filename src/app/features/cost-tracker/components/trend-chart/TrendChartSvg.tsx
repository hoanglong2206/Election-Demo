import type { ChartMetricMode, ChartDaysRange } from '../../types'
import type { SvgPoint, MetricTheme } from '../../utils/trendChartMath'
import { cn } from '@/lib/utils'

interface TrendChartSvgProps {
  svgWidth: number
  svgHeight: number
  padding: { top: number; right: number; bottom: number; left: number }
  chartWidth: number
  chartHeight: number
  theme: MetricTheme
  maxValue: number
  metricMode: ChartMetricMode
  areaPath: string
  linePath: string
  points: SvgPoint[]
  days: ChartDaysRange
  hoveredIndex: number | null
  onHoverIndex: (index: number | null) => void
  hoveredPoint: SvgPoint | null
}

export function TrendChartSvg({
  svgWidth,
  svgHeight,
  padding,
  chartWidth,
  chartHeight,
  theme,
  maxValue,
  metricMode,
  areaPath,
  linePath,
  points,
  days,
  hoveredIndex,
  onHoverIndex,
  hoveredPoint,
}: TrendChartSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full h-auto overflow-visible block"
      onMouseLeave={() => onHoverIndex(null)}
    >
      <defs>
        <linearGradient id={theme.fillGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.fromColor} />
          <stop offset="100%" stopColor={theme.toColor} />
        </linearGradient>
      </defs>

      {/* Horizontal Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight * (1 - ratio)
        const val = maxValue * ratio
        let label = ''
        if (metricMode === 'cost') label = `$${val.toFixed(3)}`
        else if (metricMode === 'tokens')
          label = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${Math.round(val)}`
        else label = `${Math.round(val)}`

        return (
          <g key={ratio}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartWidth}
              y2={y}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={y + 3}
              textAnchor="end"
              className="text-[9px] fill-white/30 font-mono"
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* Area Fill */}
      {areaPath && <path d={areaPath} fill={`url(#${theme.fillGradientId})`} />}

      {/* Main Trend Line */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke={theme.stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data Points & Interactive Columns */}
      {points.map((p) => {
        const isHovered = hoveredIndex === p.index
        const hasActivity = p.value > 0

        return (
          <g key={p.index}>
            {/* Subtle bar background */}
            <rect
              x={p.x - (chartWidth / points.length) * 0.4}
              y={p.y}
              width={(chartWidth / points.length) * 0.8}
              height={padding.top + chartHeight - p.y}
              fill={theme.stroke}
              opacity={isHovered ? 0.35 : hasActivity ? 0.12 : 0.03}
              rx="3"
              className="transition-all duration-150"
            />

            {/* Interactive Dot */}
            {hasActivity && (
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5.5 : 3.5}
                fill={isHovered ? '#ffffff' : theme.dotColor}
                stroke={theme.stroke}
                strokeWidth={isHovered ? 2.5 : 1.5}
                className="transition-all duration-150"
              />
            )}

            {/* X-Axis Date Labels */}
            {(days <= 14 || p.index % 2 === 0 || p.index === points.length - 1) && (
              <text
                x={p.x}
                y={padding.top + chartHeight + 18}
                textAnchor="middle"
                className={cn(
                  'text-[9px] font-mono transition-colors',
                  isHovered ? 'fill-white font-semibold' : 'fill-white/35'
                )}
              >
                {p.data.date.slice(5)}
              </text>
            )}

            {/* Mouse event transparent target box */}
            <rect
              x={p.x - chartWidth / points.length / 2}
              y={padding.top}
              width={chartWidth / points.length}
              height={chartHeight + padding.bottom}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => onHoverIndex(p.index)}
            />
          </g>
        )
      })}

      {/* Hover Vertical Guide Line */}
      {hoveredPoint && (
        <line
          x1={hoveredPoint.x}
          y1={padding.top}
          x2={hoveredPoint.x}
          y2={padding.top + chartHeight}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeDasharray="2 2"
          strokeWidth="1.2"
        />
      )}
    </svg>
  )
}

