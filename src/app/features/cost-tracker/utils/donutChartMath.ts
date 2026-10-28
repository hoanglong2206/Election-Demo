import type { DistributionMetric } from '../types'
import type { UsageBreakdownItem } from '@/services/usage-tracker'

export const SLICE_COLORS = [
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

export interface DonutSlice {
  item: UsageBreakdownItem
  name: string
  value: number
  percentage: number
  startAngle: number
  endAngle: number
  color: string
}

export interface BreakdownListItem {
  item: UsageBreakdownItem
  name: string
  value: number
  percentage: number
  color: string
}

export function getBreakdownItemValue(item: UsageBreakdownItem, metric: DistributionMetric): number {
  if (metric === 'cost') return item.estimatedCostUsd
  if (metric === 'tokens') return item.inputTokens + item.outputTokens
  return item.requests
}

export function formatDonutMetricValue(val: number, metric: DistributionMetric): string {
  if (metric === 'cost') return `$${val.toFixed(4)}`
  if (metric === 'tokens') {
    return val >= 1_000_000
      ? `${(val / 1_000_000).toFixed(2)}M`
      : `${(val / 1000).toFixed(1)}k`
  }
  return `${Math.round(val)} reqs`
}

export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

export function describeDonutArc(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
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
    startOuter.x.toFixed(2),
    startOuter.y.toFixed(2),
    'A',
    outerRadius.toFixed(2),
    outerRadius.toFixed(2),
    0,
    largeArcFlag,
    1,
    endOuter.x.toFixed(2),
    endOuter.y.toFixed(2),
    'L',
    endInner.x.toFixed(2),
    endInner.y.toFixed(2),
    'A',
    innerRadius.toFixed(2),
    innerRadius.toFixed(2),
    0,
    largeArcFlag,
    0,
    startInner.x.toFixed(2),
    startInner.y.toFixed(2),
    'Z',
  ].join(' ')
}

export function calculateDonutSlices(
  rawItems: UsageBreakdownItem[],
  metric: DistributionMetric,
  colors: string[] = SLICE_COLORS
): { slices: DonutSlice[]; totalValue: number } {
  const totalValue = rawItems.reduce((sum, item) => sum + getBreakdownItemValue(item, metric), 0)
  if (totalValue <= 0 || rawItems.length === 0) {
    return { slices: [], totalValue: 0 }
  }

  const activeItems = rawItems.filter((item) => getBreakdownItemValue(item, metric) > 0)
  if (activeItems.length === 0) {
    return { slices: [], totalValue: 0 }
  }

  let accumulatedAngle = 0
  const slices: DonutSlice[] = activeItems.map((item) => {
    const val = getBreakdownItemValue(item, metric)
    const percentage = (val / totalValue) * 100
    const angle = (val / totalValue) * 360
    const startAngle = accumulatedAngle
    const endAngle = accumulatedAngle + angle
    accumulatedAngle += angle

    const originalIdx = rawItems.indexOf(item)
    const color = colors[(originalIdx >= 0 ? originalIdx : 0) % colors.length]

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

  return { slices, totalValue }
}

export function buildBreakdownList(
  rawItems: UsageBreakdownItem[],
  totalValue: number,
  metric: DistributionMetric,
  colors: string[] = SLICE_COLORS
): BreakdownListItem[] {
  return rawItems.map((item, idx) => {
    const val = getBreakdownItemValue(item, metric)
    const percentage = totalValue > 0 ? (val / totalValue) * 100 : 0
    const color = colors[idx % colors.length]
    return {
      item,
      name: item.name,
      value: val,
      percentage,
      color,
    }
  })
}

