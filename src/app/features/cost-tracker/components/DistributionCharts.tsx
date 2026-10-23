import { useState, useMemo } from 'react'
import {
  PieChart as PieIcon,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  DistributionCategory,
  DistributionMetric,
} from '../types'
import { FEATURE_NAMES } from '../types'
import type { MonthlyUsageSummary, UsageBreakdownItem } from '@/services/usage-tracker'

interface DistributionChartsProps {
  summary: MonthlyUsageSummary
}

// Curated vibrant color palette for slices
const SLICE_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
]

export function DistributionCharts({ summary }: DistributionChartsProps) {
  const [category, setCategory] = useState<DistributionCategory>('provider')
  const [metric, setMetric] = useState<DistributionMetric>('cost')
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)

  // Select items based on active category
  const rawItems: UsageBreakdownItem[] = useMemo(() => {
    if (category === 'provider') return summary.byProvider
    if (category === 'model') return summary.byModel
    return summary.byFeature
  }, [category, summary])

  // Get item value based on selected metric
  const getItemValue = (item: UsageBreakdownItem) => {
    if (metric === 'cost') return item.estimatedCostUsd
    if (metric === 'tokens') return item.inputTokens + item.outputTokens
    return item.requests
  }

  // Format value for display
  const formatMetricValue = (val: number) => {
    if (metric === 'cost') return `$${val.toFixed(4)}`
    if (metric === 'tokens') {
      return val >= 1_000_000
        ? `${(val / 1_000_000).toFixed(2)}M`
        : `${(val / 1000).toFixed(1)}k`
    }
    return `${Math.round(val)} reqs`
  }

  // Calculate slice data
  const totalMetricValue = useMemo(() => {
    return rawItems.reduce((sum, item) => sum + getItemValue(item), 0)
  }, [rawItems, metric])

  const slices = useMemo(() => {
    if (totalMetricValue <= 0 || rawItems.length === 0) return []

    // Filter to items that have a positive value for this metric
    const activeItems = rawItems.filter((item) => getItemValue(item) > 0)
    if (activeItems.length === 0) return []

    let accumulatedAngle = 0
    return activeItems.map((item) => {
      const val = getItemValue(item)
      const percentage = (val / totalMetricValue) * 100
      const angle = (val / totalMetricValue) * 360
      const startAngle = accumulatedAngle
      const endAngle = accumulatedAngle + angle
      accumulatedAngle += angle

      const originalIdx = rawItems.indexOf(item)
      const color = SLICE_COLORS[(originalIdx >= 0 ? originalIdx : 0) % SLICE_COLORS.length]

      return {
        item,
        name: item.name,
        value: val,
        percentage,
        startAngle,
        endAngle,
        color,
      }
    })
  }, [rawItems, totalMetricValue, metric])

  // Full breakdown list items (always available even when totalMetricValue is 0)
  const breakdownItems = useMemo(() => {
    return rawItems.map((item, idx) => {
      const val = getItemValue(item)
      const percentage = totalMetricValue > 0 ? (val / totalMetricValue) * 100 : 0
      const color = SLICE_COLORS[idx % SLICE_COLORS.length]
      return {
        item,
        name: item.name,
        value: val,
        percentage,
        color,
      }
    })
  }, [rawItems, totalMetricValue, metric])

  // Helper to convert polar coordinates to Cartesian (0 deg is 12 o'clock, clockwise)
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  // Generate SVG path for a donut segment (clockwise)
  const describeDonutArc = (
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number
  ): string => {
    // If arc is full circle (>= 359.9 deg) or 100%, draw as two 180-deg halves to prevent SVG coincident-point omission bug
    if (endAngle - startAngle >= 359.9) {
      const midAngle = startAngle + 180
      const p1 = describeDonutArc(x, y, innerRadius, outerRadius, startAngle, midAngle)
      const p2 = describeDonutArc(x, y, innerRadius, outerRadius, midAngle, endAngle)
      return `${p1} ${p2}`
    }

    const startOuter = polarToCartesian(x, y, outerRadius, startAngle)
    const endOuter = polarToCartesian(x, y, outerRadius, endAngle)
    const startInner = polarToCartesian(x, y, innerRadius, startAngle)
    const endInner = polarToCartesian(x, y, innerRadius, endAngle)

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

    return [
      'M',
      startOuter.x,
      startOuter.y,
      'A',
      outerRadius,
      outerRadius,
      0,
      largeArcFlag,
      1,
      endOuter.x,
      endOuter.y,
      'L',
      endInner.x,
      endInner.y,
      'A',
      innerRadius,
      innerRadius,
      0,
      largeArcFlag,
      0,
      startInner.x,
      startInner.y,
      'Z',
    ].join(' ')
  }

  // Active hover info
  const activeHoveredItem = useMemo(() => {
    if (!hoveredSlice) return null
    return slices.find((s) => s.name === hoveredSlice)
  }, [hoveredSlice, slices])

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0">
            <PieIcon className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-[13px] text-white/90 font-semibold flex items-center gap-2">
              <span>Phân Bổ Tỷ Trọng (Distribution Donut Chart)</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border font-mono bg-violet-500/10 text-violet-300 border-violet-500/30">
                {category === 'provider' ? 'Nhà cung cấp' : category === 'model' ? 'Mô hình' : 'Tính năng'}
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-white/40 mt-0.5">
              Tỷ lệ phân chia tài nguyên và chi phí AI trong tháng
            </p>
          </div>
        </div>

        {/* Switchers */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* Category Tabs */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px]">
            <button
              type="button"
              onClick={() => {
                setCategory('provider')
                setHoveredSlice(null)
              }}
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
              onClick={() => {
                setCategory('model')
                setHoveredSlice(null)
              }}
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
              onClick={() => {
                setCategory('feature')
                setHoveredSlice(null)
              }}
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
              onClick={() => setMetric('cost')}
              className={cn(
                'px-2 py-1 rounded-md transition-colors font-medium border',
                metric === 'cost' ? 'bg-white/15 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white'
              )}
            >
              Chi phí
            </button>
            <button
              type="button"
              onClick={() => setMetric('tokens')}
              className={cn(
                'px-2 py-1 rounded-md transition-colors font-medium border',
                metric === 'tokens' ? 'bg-white/15 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white'
              )}
            >
              Tokens
            </button>
            <button
              type="button"
              onClick={() => setMetric('requests')}
              className={cn(
                'px-2 py-1 rounded-md transition-colors font-medium border',
                metric === 'requests' ? 'bg-white/15 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white'
              )}
            >
              Requests
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-4">
        {rawItems.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-white/40 bg-black/20 rounded-xl border border-white/[0.04]">
            Chưa có dữ liệu API usage trong tháng này để hiển thị phân bổ.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Interactive Donut Chart */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full block">
                  {slices.length === 0 ? (
                    <circle
                      cx="100"
                      cy="100"
                      r="68"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="14"
                      strokeDasharray="6 4"
                    />
                  ) : (
                    slices.map((slice) => {
                      const isHovered = hoveredSlice === slice.name
                      const innerR = isHovered ? 52 : 55
                      const outerR = isHovered ? 88 : 82

                      return (
                        <path
                          key={slice.name}
                          d={describeDonutArc(100, 100, innerR, outerR, slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          opacity={hoveredSlice && !isHovered ? 0.35 : 0.9}
                          stroke="#0c101d"
                          strokeWidth="2.5"
                          className="cursor-pointer transition-all duration-200 hover:opacity-100"
                          onMouseEnter={() => setHoveredSlice(slice.name)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        />
                      )
                    })
                  )}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  {activeHoveredItem ? (
                    <div className="animate-fade-in space-y-0.5">
                      <span className="text-[10px] text-white/50 block truncate max-w-[110px]">
                        {category === 'feature'
                          ? (FEATURE_NAMES as any)[activeHoveredItem.name] || activeHoveredItem.name
                          : activeHoveredItem.name}
                      </span>
                      <span className="text-sm font-bold font-mono text-white block">
                        {formatMetricValue(activeHoveredItem.value)}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold block">
                        {activeHoveredItem.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] uppercase tracking-wider text-white/40 block">
                        Tổng cộng
                      </span>
                      <span className="text-sm font-bold font-mono text-white block">
                        {formatMetricValue(totalMetricValue)}
                      </span>
                      <span className="text-[9.5px] text-white/40 font-mono block">
                        {rawItems.length} mục
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Detailed Breakdown List with Progress Bars */}
            <div className="lg:col-span-7 flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {totalMetricValue <= 0 && rawItems.length > 0 && metric === 'cost' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                  <span>💡 Cả <strong>{rawItems.length} mục</strong> đều là $0.0000 (Free Tier hoặc STT Offline).</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMetric('tokens')}
                      className="px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-medium text-[10px] border border-cyan-500/30 transition-colors"
                    >
                      Xem theo Tokens
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetric('requests')}
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
                    onMouseEnter={() => setHoveredSlice(slice.name)}
                    onMouseLeave={() => setHoveredSlice(null)}
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
