import type { ChartMetricMode, ChartDaysRange } from '../types'
import type { DailyUsageItem } from '@/services/usage-tracker'

export interface SvgPoint {
  x: number
  y: number
  data: DailyUsageItem
  value: number
  index: number
}

export interface MetricTheme {
  stroke: string
  fillGradientId: string
  fromColor: string
  toColor: string
  dotColor: string
  badgeColor: string
  unitPrefix: string
  unitSuffix: string
  format: (v: number) => string
}

export interface TrendSummaryStats {
  total: number
  activeDays: number
  peak: number
  avg: number
}

export function getMetricTheme(metricMode: ChartMetricMode): MetricTheme {
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
}

export function extractMetricValues(history: DailyUsageItem[], metricMode: ChartMetricMode): number[] {
  return history.map((d) => {
    if (metricMode === 'cost') return d.estimatedCostUsd
    if (metricMode === 'tokens') return d.tokens
    return d.requests
  })
}

export function calculateMaxMetricValue(values: number[], metricMode: ChartMetricMode): number {
  const max = Math.max(...values, 0)
  if (metricMode === 'cost') return max > 0 ? max * 1.15 : 0.05
  if (metricMode === 'tokens') return max > 0 ? max * 1.15 : 1000
  return max > 0 ? Math.ceil(max * 1.2) : 5
}

export function calculateChartPoints(
  history: DailyUsageItem[],
  values: number[],
  maxValue: number,
  dimensions: { chartWidth: number; chartHeight: number; paddingLeft: number; paddingTop: number }
): SvgPoint[] {
  if (history.length === 0) return []
  const { chartWidth, chartHeight, paddingLeft, paddingTop } = dimensions
  const stepX = chartWidth / (history.length - 1 || 1)
  const safeMax = maxValue > 0 ? maxValue : 1

  return history.map((d, index) => {
    const val = values[index] ?? 0
    const x = paddingLeft + index * stepX
    const y = paddingTop + chartHeight - (val / safeMax) * chartHeight
    return { x, y, data: d, value: val, index }
  })
}

export function generateAreaPath(
  points: SvgPoint[],
  paddingTop: number,
  chartHeight: number
): string {
  if (points.length < 2) return ''
  const lineParts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const zeroY = (paddingTop + chartHeight).toFixed(1)
  return `${lineParts.join(' ')} L ${lastPoint.x.toFixed(1)} ${zeroY} L ${firstPoint.x.toFixed(1)} ${zeroY} Z`
}

export function generateLinePath(points: SvgPoint[]): string {
  if (points.length < 2) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

export function computeTrendSummaryStats(values: number[], days: ChartDaysRange): TrendSummaryStats {
  const total = values.reduce((sum, v) => sum + v, 0)
  const activeDays = values.filter((v) => v > 0).length
  const peak = Math.max(...values, 0)
  const avg = days > 0 ? total / days : 0
  return { total, activeDays, peak, avg }
}
