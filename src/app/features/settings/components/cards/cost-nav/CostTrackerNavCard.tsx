import { Coins, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CostTrackerNavCardProps {
  onViewChange?: (view: any) => void
}

export function CostTrackerNavCard({ onViewChange }: CostTrackerNavCardProps) {
  return (
    <div className="bg-gradient-to-r from-emerald-500/10 via-white/[0.02] to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
          <Coins className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white/95">
              Theo Dõi Chi Phí & Token Usage API
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-mono"
            >
              Feature Riêng
            </Badge>
          </div>
          <p className="text-[11px] text-white/50 mt-0.5">
            Bảng điều khiển trực quan với biểu đồ chi tiêu 30 ngày, Donut chart phân bổ model, quản lý
            ngân sách và nhật ký request.
          </p>
        </div>
      </div>
      {onViewChange && (
        <Button
          type="button"
          onClick={() => onViewChange('cost-tracker')}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 gap-1.5 shrink-0 shadow-sm font-medium transition-all"
        >
          <span>Mở Dashboard Chi Phí</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

