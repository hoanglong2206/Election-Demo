import {
  FileDown,
  RotateCcw,
  Sparkles,
  Trash2,
  PieChart,
  LayoutDashboard,
  TrendingUp,
  Sliders,
  Coins,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CostTrackerViewTab } from '../../types'

export interface CostTrackerHeaderProps {
  currentTab: CostTrackerViewTab
  onTabChange: (tab: CostTrackerViewTab) => void
  month: string
  totalRequests: number
  isRefreshing: boolean
  onRefresh: () => void
  onSeedDemoData: () => void
  onExportCsv: () => void
  onOpenResetConfirm: () => void
}

export function CostTrackerHeader({
  currentTab,
  onTabChange,
  month,
  totalRequests,
  isRefreshing,
  onRefresh,
  onSeedDemoData,
  onExportCsv,
  onOpenResetConfirm,
}: CostTrackerHeaderProps) {
  const tabs: { id: CostTrackerViewTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'charts', label: 'Xu hướng ngày', icon: TrendingUp },
    { id: 'distribution', label: 'Phân bổ', icon: PieChart },
    { id: 'budget', label: 'Ngân sách', icon: Sliders },
    { id: 'pricing', label: 'Bảng giá mô hình', icon: Coins },
    { id: 'logs', label: 'Lịch sử cuộc gọi', icon: History },
  ]

  return (
    <div className="flex flex-col gap-3 bg-white/[0.03] border border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl">
      {/* Top row: Title + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-white tracking-tight">
                Quản Lý Chi Phí & Token API
              </h1>
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-mono"
              >
                Tháng {month || new Date().toISOString().slice(0, 7)}
              </Badge>
              {totalRequests > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-white/5 border-white/10 text-white/70 font-mono"
                >
                  {totalRequests.toLocaleString()} lượt gọi
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Theo dõi định lượng token, tính toán chi phí chính xác và kiểm soát ngân sách AI thời gian thực
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSeedDemoData}
            title="Nạp dữ liệu mẫu để thử nghiệm biểu đồ"
            className="h-8 text-xs bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:text-white"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-violet-400" />
            <span>Nạp demo</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onExportCsv}
            title="Xuất lịch sử sử dụng ra file CSV"
            className="h-8 text-xs bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <FileDown className="w-3.5 h-3.5 mr-1" />
            <span>Xuất CSV</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Làm mới số liệu"
            className="h-8 w-8 p-0 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-emerald-400')} />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenResetConfirm}
            title="Đặt lại thống kê cục bộ"
            className="h-8 w-8 p-0 bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-white/[0.06] custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border select-none',
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'bg-white/[0.02] text-white/50 border-transparent hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-emerald-400' : 'text-white/40')} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

