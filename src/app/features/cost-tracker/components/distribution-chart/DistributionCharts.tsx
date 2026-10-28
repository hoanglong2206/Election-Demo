import { useState, useMemo, useCallback } from 'react'
import { PieChart as PieIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DistributionCategory, DistributionMetric } from '../../types'
import type { MonthlyUsageSummary, UsageBreakdownItem } from '@/services/usage-tracker'
import {
  calculateDonutSlices,
  buildBreakdownList,
  formatDonutMetricValue,
} from '../../utils/donutChartMath'
import { DistributionHeaderControls } from './DistributionHeaderControls'
import { DonutChartSvg } from './DonutChartSvg'
import { BreakdownItemList } from './BreakdownItemList'

export interface DistributionChartsProps {
  summary: MonthlyUsageSummary
}

export function DistributionCharts({ summary }: DistributionChartsProps) {
  const [category, setCategory] = useState<DistributionCategory>('provider')
  const [metric, setMetric] = useState<DistributionMetric>('cost')
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)

  const rawItems: UsageBreakdownItem[] = useMemo(() => {
    if (category === 'provider') return summary.byProvider
    if (category === 'model') return summary.byModel
    return summary.byFeature
  }, [category, summary])

  const { slices, totalValue: totalMetricValue } = useMemo(() => {
    return calculateDonutSlices(rawItems, metric)
  }, [rawItems, metric])

  const breakdownItems = useMemo(() => {
    return buildBreakdownList(rawItems, totalMetricValue, metric)
  }, [rawItems, totalMetricValue, metric])

  const activeHoveredItem = useMemo(() => {
    if (!hoveredSlice) return null
    return slices.find((s) => s.name === hoveredSlice) || null
  }, [hoveredSlice, slices])

  const formatMetric = useCallback(
    (val: number) => formatDonutMetricValue(val, metric),
    [metric]
  )

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
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

        <DistributionHeaderControls
          category={category}
          onCategoryChange={(cat) => {
            setCategory(cat)
            setHoveredSlice(null)
          }}
          metric={metric}
          onMetricChange={setMetric}
        />
      </CardHeader>

      <CardContent className="p-0 pt-4">
        {rawItems.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-white/40 bg-black/20 rounded-xl border border-white/[0.04]">
            Chưa có dữ liệu API usage trong tháng này để hiển thị phân bổ.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
              <DonutChartSvg
                slices={slices}
                hoveredSlice={hoveredSlice}
                onHoverSlice={setHoveredSlice}
                activeHoveredItem={activeHoveredItem}
                totalMetricValue={totalMetricValue}
                category={category}
                rawItemsCount={rawItems.length}
                formatMetricValue={formatMetric}
              />
            </div>

            <BreakdownItemList
              breakdownItems={breakdownItems}
              totalMetricValue={totalMetricValue}
              rawItemsCount={rawItems.length}
              metric={metric}
              category={category}
              hoveredSlice={hoveredSlice}
              onHoverSlice={setHoveredSlice}
              onMetricChange={setMetric}
              formatMetricValue={formatMetric}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

