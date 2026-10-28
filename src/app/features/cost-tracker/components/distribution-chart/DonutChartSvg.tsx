import type { DistributionCategory } from '../../types'
import { FEATURE_NAMES } from '../../types'
import type { DonutSlice } from '../../utils/donutChartMath'
import { describeDonutArc } from '../../utils/donutChartMath'

interface DonutChartSvgProps {
  slices: DonutSlice[]
  hoveredSlice: string | null
  onHoverSlice: (name: string | null) => void
  activeHoveredItem: DonutSlice | null
  totalMetricValue: number
  category: DistributionCategory
  rawItemsCount: number
  formatMetricValue: (val: number) => string
}

export function DonutChartSvg({
  slices,
  hoveredSlice,
  onHoverSlice,
  activeHoveredItem,
  totalMetricValue,
  category,
  rawItemsCount,
  formatMetricValue,
}: DonutChartSvgProps) {
  return (
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
                onMouseEnter={() => onHoverSlice(slice.name)}
                onMouseLeave={() => onHoverSlice(null)}
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
              {rawItemsCount} mục
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

