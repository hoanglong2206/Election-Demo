import { describe, it, expect } from 'bun:test'
import {
  polarToCartesian,
  describeDonutArc,
  calculateDonutSlices,
  formatDonutMetricValue,
  buildBreakdownList,
} from '../donutChartMath'
import type { UsageBreakdownItem } from '@/services/usage-tracker'

describe('donutChartMath Unit Tests', () => {
  const mockBreakdown = [
    {
      name: 'Google',
      estimatedCostUsd: 0.05,
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 200,
      requests: 4,
      costStatus: 'calculated',
    },
    {
      name: 'OpenAI',
      estimatedCostUsd: 0.15,
      inputTokens: 3000,
      outputTokens: 1500,
      cachedTokens: 0,
      requests: 6,
      costStatus: 'calculated',
    },
  ] as unknown as UsageBreakdownItem[]

  it('polarToCartesian computes accurate Cartesian coordinates from polar degrees', () => {
    // 0 degrees is 12 o'clock (x = 100, y = 100 - r)
    const top = polarToCartesian(100, 100, 50, 0)
    expect(top.x).toBeCloseTo(100, 1)
    expect(top.y).toBeCloseTo(50, 1)

    // 90 degrees is 3 o'clock (x = 100 + r, y = 100)
    const right = polarToCartesian(100, 100, 50, 90)
    expect(right.x).toBeCloseTo(150, 1)
    expect(right.y).toBeCloseTo(100, 1)
  })

  it('describeDonutArc generates valid SVG donut arc path', () => {
    const arc = describeDonutArc(100, 100, 50, 80, 0, 180)
    expect(arc.startsWith('M')).toBe(true)
    expect(arc.endsWith('Z')).toBe(true)
    expect(arc).toContain('A')
  })

  it('describeDonutArc splits full 360 circle into two halves to prevent coincident point omission', () => {
    const fullCircle = describeDonutArc(100, 100, 50, 80, 0, 360)
    // Should contain two M commands because of the split
    expect(fullCircle.split('M').length - 1).toBe(2)
  })

  it('calculateDonutSlices computes angles and percentages', () => {
    const { slices, totalValue } = calculateDonutSlices(mockBreakdown, 'cost')
    expect(totalValue).toBeCloseTo(0.2, 4)
    expect(slices.length).toBe(2)
    expect(slices[0].percentage).toBeCloseTo(25, 1)
    expect(slices[1].percentage).toBeCloseTo(75, 1)
    expect(slices[0].startAngle).toBe(0)
    expect(slices[0].endAngle).toBeCloseTo(90, 1)
    expect(slices[1].startAngle).toBeCloseTo(90, 1)
    expect(slices[1].endAngle).toBeCloseTo(360, 1)
  })

  it('formatDonutMetricValue formats display numbers correctly', () => {
    expect(formatDonutMetricValue(0.1234, 'cost')).toBe('$0.1234')
    expect(formatDonutMetricValue(1500, 'tokens')).toBe('1.5k')
    expect(formatDonutMetricValue(1500000, 'tokens')).toBe('1.50M')
    expect(formatDonutMetricValue(10, 'requests')).toBe('10 reqs')
  })

  it('buildBreakdownList produces complete breakdown items', () => {
    const list = buildBreakdownList(mockBreakdown, 0.2, 'cost')
    expect(list.length).toBe(2)
    expect(list[0].name).toBe('Google')
    expect(list[0].percentage).toBeCloseTo(25, 1)
  })
})
