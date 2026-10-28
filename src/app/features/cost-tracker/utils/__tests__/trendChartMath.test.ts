import { describe, it, expect } from 'bun:test'
import {
  getMetricTheme,
  extractMetricValues,
  calculateMaxMetricValue,
  calculateChartPoints,
  generateAreaPath,
  generateLinePath,
  computeTrendSummaryStats,
} from '../trendChartMath'
import type { DailyUsageItem } from '@/services/usage-tracker'

describe('trendChartMath Unit Tests', () => {
  const mockHistory: DailyUsageItem[] = [
    { date: '2026-10-01', estimatedCostUsd: 0.12, tokens: 1500, requests: 5 },
    { date: '2026-10-02', estimatedCostUsd: 0.24, tokens: 3000, requests: 10 },
    { date: '2026-10-03', estimatedCostUsd: 0.0, tokens: 0, requests: 0 },
  ]

  it('getMetricTheme returns correct themes for cost, tokens, and requests', () => {
    const costTheme = getMetricTheme('cost')
    expect(costTheme.stroke).toBe('#10b981')
    expect(costTheme.format(0.12345)).toBe('$0.1235')

    const tokenTheme = getMetricTheme('tokens')
    expect(tokenTheme.stroke).toBe('#06b6d4')
    expect(tokenTheme.format(2500)).toBe('2.5k')
    expect(tokenTheme.format(2500000)).toBe('2.50M')

    const reqTheme = getMetricTheme('requests')
    expect(reqTheme.stroke).toBe('#8b5cf6')
    expect(reqTheme.format(8)).toBe('8 reqs')
  })

  it('extractMetricValues extracts correct arrays according to metric mode', () => {
    expect(extractMetricValues(mockHistory, 'cost')).toEqual([0.12, 0.24, 0.0])
    expect(extractMetricValues(mockHistory, 'tokens')).toEqual([1500, 3000, 0])
    expect(extractMetricValues(mockHistory, 'requests')).toEqual([5, 10, 0])
  })

  it('calculateMaxMetricValue adds headroom and handles edge cases', () => {
    expect(calculateMaxMetricValue([0.1, 0.2], 'cost')).toBeCloseTo(0.23, 2)
    expect(calculateMaxMetricValue([0, 0], 'cost')).toBe(0.05)
    expect(calculateMaxMetricValue([1000, 2000], 'tokens')).toBe(2300)
    expect(calculateMaxMetricValue([5, 10], 'requests')).toBe(12)
  })

  it('calculateChartPoints produces valid coordinates within bounds', () => {
    const values = [0.12, 0.24, 0.0]
    const dimensions = { chartWidth: 700, chartHeight: 180, paddingLeft: 50, paddingTop: 20 }
    const points = calculateChartPoints(mockHistory, values, 0.3, dimensions)

    expect(points.length).toBe(3)
    expect(points[0].x).toBe(50)
    expect(points[2].x).toBe(750)
    expect(points[0].y).toBeGreaterThanOrEqual(20)
    expect(points[0].y).toBeLessThanOrEqual(200)
    expect(points[0].value).toBe(0.12)
  })

  it('generateAreaPath and generateLinePath generate valid SVG path strings', () => {
    const points = [
      { x: 50, y: 100, data: mockHistory[0], value: 0.12, index: 0 },
      { x: 400, y: 50, data: mockHistory[1], value: 0.24, index: 1 },
      { x: 750, y: 200, data: mockHistory[2], value: 0.0, index: 2 },
    ]

    const linePath = generateLinePath(points)
    expect(linePath).toBe('M 50.0 100.0 L 400.0 50.0 L 750.0 200.0')

    const areaPath = generateAreaPath(points, 20, 180)
    expect(areaPath).toContain('M 50.0 100.0')
    expect(areaPath).toContain('Z')
  })

  it('computeTrendSummaryStats calculates total, activeDays, peak, and average', () => {
    const stats = computeTrendSummaryStats([10, 20, 0], 14)
    expect(stats.total).toBe(30)
    expect(stats.activeDays).toBe(2)
    expect(stats.peak).toBe(20)
    expect(stats.avg).toBeCloseTo(30 / 14, 4)
  })
})
