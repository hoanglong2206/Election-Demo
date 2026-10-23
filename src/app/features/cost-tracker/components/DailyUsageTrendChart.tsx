import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChartDaysRange, ChartMetricMode } from '../types'
import { usageTrackerService } from '@/services/usage-tracker'

interface DailyUsageTrendChartProps {
  days: ChartDaysRange
  onDaysChange: (d: ChartDaysRange) => void
}

export function DailyUsageTrendChart({ days, onDaysChange }: DailyUsageTrendChartProps) {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('cost')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const history = useMemo(() => {
    return usageTrackerService.getDailyHistory(days)
  }, [days])

  // Chart dimensions
  const svgWidth = 800
  const svgHeight = 220
  const padding = { top: 20, right: 30, bottom: 35, left: 55 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  // Extract values based on metric mode
  const values = useMemo(() => {
    return history.map((d) => {
      if (metricMode === 'cost') return d.estimatedCostUsd
      if (metricMode === 'tokens') return d.tokens
      return d.requests
    })
  }, [history, metricMode])

  const maxValue = useMemo(() => {
    const max = Math.max(...values, 0)
    if (metricMode === 'cost') return max > 0 ? max * 1.15 : 0.05
    if (metricMode === 'tokens') return max > 0 ? max * 1.15 : 1000
    return max > 0 ? Math.ceil(max * 1.2) : 5
  }, [values, metricMode])

  // Points calculation
  const points = useMemo(() => {
    if (history.length === 0) return []
    const stepX = chartWidth / (history.length - 1 || 1)
    return history.map((d, index) => {
      const val = values[index]
      const x = padding.left + index * stepX
      const y = padding.top + chartHeight - (val / (maxValue || 1)) * chartHeight
      return { x, y, data: d, value: val, index }
    })
  }, [history, values, maxValue, chartWidth, chartHeight, padding.left, padding.top])

  // SVG Area Path
  const areaPath = useMemo(() => {
    if (points.length < 2) return ''
    const lineParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    const firstPoint = points[0]
    const lastPoint = points[points.length - 1]
    const zeroY = padding.top + chartHeight
    return `${lineParts.join(' ')} L ${lastPoint.x} ${zeroY} L ${firstPoint.x} ${zeroY} Z`
  }, [points, padding.top, chartHeight])

  // SVG Line Path
  const linePath = useMemo(() => {
    if (points.length < 2) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }, [points])

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const total = values.reduce((sum, v) => sum + v, 0)
    const activeDays = values.filter((v) => v > 0).length
    const peak = Math.max(...values, 0)
    const avg = days > 0 ? total / days : 0
    return { total, activeDays, peak, avg }
  }, [values, days])

  // Color config based on metric
  const theme = useMemo(() => {
    if (metricMode === 'cost') {
      return {
        stroke: '#10b981',
        fillGradientId: 'costGradient',
        fromColor: 'rgba(16, 185, 129, 0.4)',
        toColor: 'rgba(16, 185, 129, 0.0)',
        dotColor: '#34d399',
        badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        unitPrefix: '$',
        unitSuffix: '',
        format: (v: number) => `$${v.toFixed(4)}`,
      }
    }
    if (metricMode === 'tokens') {
      return {
        stroke: '#06b6d4',
        fillGradientId: 'tokensGradient',
        fromColor: 'rgba(6, 182, 212, 0.4)',
        toColor: 'rgba(6, 182, 212, 0.0)',
        dotColor: '#22d3ee',
        badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        unitPrefix: '',
        unitSuffix: ' tokens',
        format: (v: number) =>
          v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : `${(v / 1000).toFixed(1)}k`,
      }
    }
    return {
      stroke: '#8b5cf6',
      fillGradientId: 'reqGradient',
      fromColor: 'rgba(139, 92, 246, 0.4)',
      toColor: 'rgba(139, 92, 246, 0.0)',
      dotColor: '#a78bfa',
      badgeColor: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      unitPrefix: '',
      unitSuffix: ' reqs',
      format: (v: number) => `${Math.round(v)} reqs`,
    }
  }, [metricMode])

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
        {/* Left: Title & Metric Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-[13px] text-white/90 font-semibold flex items-center gap-2">
              <span>Biểu Đồ Xu Hướng Sử Dụng Theo Ngày</span>
              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border font-mono', theme.badgeColor)}>
                {metricMode === 'cost' ? 'Chi phí ($ USD)' : metricMode === 'tokens' ? 'Token Usage' : 'Số Request'}
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-white/40 mt-0.5">
              Di chuyển chuột trên biểu đồ để xem chi tiết từng ngày
            </p>
          </div>
        </div>

        {/* Right: Controls (Metric Switcher & Days Range) */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* Metric Switcher */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px]">
            <button
              type="button"
              onClick={() => setMetricMode('cost')}
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
              onClick={() => setMetricMode('tokens')}
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
              onClick={() => setMetricMode('requests')}
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
      </CardHeader>

      <CardContent className="p-0 pt-3 flex flex-col gap-3">
        {/* SVG Interactive Chart Canvas */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible block"
            onMouseLeave={() => setHoveredIndex(null)}
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
                    x={p.x - (chartWidth / points.length) / 2}
                    y={padding.top}
                    width={chartWidth / points.length}
                    height={chartHeight + padding.bottom}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(p.index)}
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

          {/* Floating Glassmorphic Tooltip Card */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-[#0c101d]/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl text-[11px] min-w-[170px] space-y-1.5 transition-all duration-75"
              style={{
                left: `${Math.min(
                  80,
                  Math.max(10, (hoveredPoint.x / svgWidth) * 100)
                )}%`,
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
          )}
        </div>

        {/* Bottom Statistics Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.05]">
          <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
            <span className="text-[9.5px] text-white/40">Tổng trong {days} ngày</span>
            <span className="text-[12px] font-mono font-bold text-white/90 mt-0.5">
              {theme.format(summaryStats.total)}
            </span>
          </div>

          <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
            <span className="text-[9.5px] text-white/40">Cao nhất (Peak Day)</span>
            <span className="text-[12px] font-mono font-bold text-emerald-400 mt-0.5">
              {theme.format(summaryStats.peak)}
            </span>
          </div>

          <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
            <span className="text-[9.5px] text-white/40">Trung bình ngày</span>
            <span className="text-[12px] font-mono font-bold text-cyan-300 mt-0.5">
              {theme.format(summaryStats.avg)}
            </span>
          </div>

          <div className="bg-black/25 border border-white/[0.04] rounded-lg p-2 flex flex-col">
            <span className="text-[9.5px] text-white/40">Số ngày có hoạt động</span>
            <span className="text-[12px] font-mono font-bold text-violet-300 mt-0.5">
              {summaryStats.activeDays} / {days} ngày
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
