import { useState, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChartDaysRange, ChartMetricMode } from '../../types'
import { usageTrackerService, type DailyUsageItem } from '@/services/usage-tracker'
import {
  getMetricTheme,
  extractMetricValues,
  calculateMaxMetricValue,
  calculateChartPoints,
  generateAreaPath,
  generateLinePath,
  computeTrendSummaryStats,
} from '../../utils/trendChartMath'
import { TrendChartControls } from './TrendChartControls'
import { TrendChartSvg } from './TrendChartSvg'
import { TrendChartTooltip } from './TrendChartTooltip'
import { TrendChartStatsRibbon } from './TrendChartStatsRibbon'

export interface DailyUsageTrendChartProps {
  days: ChartDaysRange
  onDaysChange: (d: ChartDaysRange) => void
  dailyHistory?: DailyUsageItem[]
}

const SVG_WIDTH = 800
const SVG_HEIGHT = 220
const PADDING = { top: 20, right: 30, bottom: 35, left: 55 }
const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right
const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom

export function DailyUsageTrendChart({
  days,
  onDaysChange,
  dailyHistory: propHistory,
}: DailyUsageTrendChartProps) {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('cost')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const history = useMemo(() => {
    return propHistory || usageTrackerService.getDailyHistory(days)
  }, [propHistory, days])

  const theme = useMemo(() => getMetricTheme(metricMode), [metricMode])
  const values = useMemo(() => extractMetricValues(history, metricMode), [history, metricMode])
  const maxValue = useMemo(() => calculateMaxMetricValue(values, metricMode), [values, metricMode])

  const points = useMemo(() => {
    return calculateChartPoints(history, values, maxValue, {
      chartWidth: CHART_WIDTH,
      chartHeight: CHART_HEIGHT,
      paddingLeft: PADDING.left,
      paddingTop: PADDING.top,
    })
  }, [history, values, maxValue])

  const areaPath = useMemo(
    () => generateAreaPath(points, PADDING.top, CHART_HEIGHT),
    [points]
  )
  const linePath = useMemo(() => generateLinePath(points), [points])
  const summaryStats = useMemo(
    () => computeTrendSummaryStats(values, days),
    [values, days]
  )
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
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

        <TrendChartControls
          metricMode={metricMode}
          onMetricModeChange={setMetricMode}
          days={days}
          onDaysChange={onDaysChange}
        />
      </CardHeader>

      <CardContent className="p-0 pt-3 flex flex-col gap-3">
        <div className="relative w-full overflow-hidden select-none">
          <TrendChartSvg
            svgWidth={SVG_WIDTH}
            svgHeight={SVG_HEIGHT}
            padding={PADDING}
            chartWidth={CHART_WIDTH}
            chartHeight={CHART_HEIGHT}
            theme={theme}
            maxValue={maxValue}
            metricMode={metricMode}
            areaPath={areaPath}
            linePath={linePath}
            points={points}
            days={days}
            hoveredIndex={hoveredIndex}
            onHoverIndex={setHoveredIndex}
            hoveredPoint={hoveredPoint}
          />
          <TrendChartTooltip hoveredPoint={hoveredPoint} svgWidth={SVG_WIDTH} />
        </div>

        <TrendChartStatsRibbon
          summaryStats={summaryStats}
          days={days}
          format={theme.format}
        />
      </CardContent>
    </Card>
  )
}
