import {
  Coins,
  RefreshCw,
  Trash2,
  Download,
  BarChart2,
  PieChart,
  Sliders,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CostTrackerViewTab } from '../types'

interface CostTrackerHeaderProps {
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
    { id: 'overview', label: 'Tổng Quan', icon: Layers },
    { id: 'charts', label: 'Biểu Đồ Xu Hướng', icon: BarChart2 },
    { id: 'distribution', label: 'Phân Bổ Chi Phí', icon: PieChart },
    { id: 'budget', label: 'Ngân Sách & Giá Model', icon: Sliders },
    { id: 'logs', label: 'Nhật Ký Yêu Cầu', icon: FileSpreadsheet },
  ]

  return (
    <div className="space-y-3 pb-1 border-b border-white/[0.08]">
      {/* Top Bar: Title & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title & Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-cyan-500/20 to-violet-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40">
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-bold text-white/95 leading-tight tracking-tight">
                Theo Dõi Chi Phí & Token Usage API
              </h2>
              <Badge
                variant="outline"
                className="text-[9.5px] h-5 px-2 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/30 flex items-center gap-1"
              >
                <span>Tháng {month}</span>
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] h-5 px-1.5 border font-mono bg-cyan-500/10 text-cyan-300 border-cyan-500/25 hidden md:inline-flex"
              >
                Local-First Storage
              </Badge>
            </div>

            <p className="text-[11px] text-white/45 leading-tight mt-0.5">
              Phân tích trực quan tiêu thụ token, kiểm soát ngân sách theo ngày và tối ưu chi phí qua Prompt Caching
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto flex-wrap">
          {totalRequests === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSeedDemoData}
              className="h-7 px-2.5 text-[11px] border-violet-500/40 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 gap-1.5 shadow-sm font-medium transition-all"
              title="Tạo dữ liệu mẫu đa dạng để xem biểu đồ và kiểm thử giao diện"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Nạp dữ liệu mẫu</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExportCsv}
            disabled={totalRequests === 0}
            className="h-7 px-2.5 text-[11px] text-white/70 hover:text-white hover:bg-white/10 gap-1.5 rounded-lg border border-white/[0.08] transition-all disabled:opacity-40"
            title="Xuất dữ liệu chi phí và tokens ra file CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xuất CSV</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'h-7 px-2.5 text-[11px] gap-1.5 rounded-lg border border-white/[0.08] transition-all',
              isRefreshing
                ? 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
            title="Làm mới thống kê chi phí và tokens"
          >
            <RefreshCw className={cn('w-3 h-3 text-cyan-400', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? 'Cập nhật...' : 'Làm mới'}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenResetConfirm}
            className="h-7 px-2 text-[11px] text-rose-400/80 hover:text-rose-200 hover:bg-rose-500/15 gap-1 rounded-lg border border-rose-500/20 transition-all"
            title="Xóa lịch sử thống kê cục bộ"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span className="hidden sm:inline">Đặt lại</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tab Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.08] shrink-0 shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-cost-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'h-7 px-3 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-95 flex items-center gap-1.5 whitespace-nowrap border focus:outline-none select-none cursor-pointer',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 text-emerald-200 border-emerald-500/40 shadow-[0_0_14px_rgba(16,185,129,0.22)]'
                    : 'border-transparent text-white/50 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-emerald-400' : 'text-white/40')} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
