import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  usageTrackerService,
  type MonthlyUsageSummary,
  type BudgetSettings,
  type UsageRecord,
} from '@/services/usage-tracker'
import type { CostTrackerViewTab, ChartDaysRange } from './types'
import { CostTrackerHeader } from './components/CostTrackerHeader'
import { CostOverviewMetrics } from './components/CostOverviewMetrics'
import { DailyUsageTrendChart } from './components/DailyUsageTrendChart'
import { DistributionCharts } from './components/DistributionCharts'
import { BudgetManagementCard } from './components/BudgetManagementCard'
import { ModelPricingConfigCard } from './components/ModelPricingConfigCard'
import { RecentUsageLogsTable } from './components/RecentUsageLogsTable'

export function CostTracker() {
  const [summary, setSummary] = useState<MonthlyUsageSummary>(() =>
    usageTrackerService.getCurrentMonthSummary()
  )
  const [budget, setBudget] = useState<BudgetSettings>(() =>
    usageTrackerService.getBudgetSettings()
  )
  const [records, setRecords] = useState<UsageRecord[]>(() =>
    usageTrackerService.getAllRecords(200)
  )
  const [currentTab, setCurrentTab] = useState<CostTrackerViewTab>('overview')
  const [chartDays, setChartDays] = useState<ChartDaysRange>(14)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isResetSuccess, setIsResetSuccess] = useState(false)
  const [demoLoadedSuccess, setDemoLoadedSuccess] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleTabChange = useCallback((tab: CostTrackerViewTab) => {
    setCurrentTab(tab)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [])

  // Subscribe to usage updates
  useEffect(() => {
    const unsubscribe = usageTrackerService.subscribe((updatedSummary) => {
      setSummary(updatedSummary)
      setRecords(usageTrackerService.getAllRecords(200))
    })
    return () => unsubscribe()
  }, [])

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setSummary(usageTrackerService.getCurrentMonthSummary())
    setBudget(usageTrackerService.getBudgetSettings())
    setRecords(usageTrackerService.getAllRecords(200))
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }, [isRefreshing])

  const handleSeedDemoData = useCallback(() => {
    usageTrackerService.seedDemoData()
    handleRefresh()
    setDemoLoadedSuccess(true)
    setTimeout(() => setDemoLoadedSuccess(false), 3000)
  }, [handleRefresh])

  const handleResetConfirmed = useCallback(() => {
    const ok = usageTrackerService.resetLocalStatistics(true)
    if (ok) {
      setIsResetConfirmOpen(false)
      setIsResetSuccess(true)
      handleRefresh()
      setTimeout(() => setIsResetSuccess(false), 3000)
    }
  }, [handleRefresh])

  // CSV Export function
  const handleExportCsv = useCallback(() => {
    if (records.length === 0) return

    const headers = [
      'ID',
      'Timestamp',
      'Date',
      'Provider',
      'Model',
      'Feature',
      'InputTokens',
      'OutputTokens',
      'CachedTokens',
      'AudioDurationSec',
      'EstimatedCostUSD',
      'CostStatus',
    ]

    const rows = records.map((r) => [
      r.id,
      r.timestamp,
      new Date(r.timestamp).toISOString(),
      `"${r.provider}"`,
      `"${r.model}"`,
      `"${r.feature}"`,
      r.inputTokens ?? 0,
      r.outputTokens ?? 0,
      r.cachedTokens ?? 0,
      r.audioDurationSeconds ?? 0,
      (r.estimatedCostUsd ?? 0).toFixed(6),
      r.costStatus,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `api-cost-usage-${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [records])

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-scroll [scrollbar-gutter:stable] p-4 space-y-4 custom-scrollbar animate-fade-in select-none"
    >
      {/* ── Header Bar & Tab Switcher ── */}
      <CostTrackerHeader
        currentTab={currentTab}
        onTabChange={handleTabChange}
        month={summary.month}
        totalRequests={summary.totalRequests}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onSeedDemoData={handleSeedDemoData}
        onExportCsv={handleExportCsv}
        onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
      />

      {/* ── Success Notifications ── */}
      {isResetSuccess && (
        <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3.5 py-2 rounded-xl text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Đã xóa toàn bộ lịch sử sử dụng token và chi phí API cục bộ thành công!</span>
        </div>
      )}

      {demoLoadedSuccess && (
        <div className="flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 text-violet-300 px-3.5 py-2 rounded-xl text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-violet-400" />
          <span>Đã tạo dữ liệu mẫu thành công! Tất cả biểu đồ và phân bổ đã được cập nhật.</span>
        </div>
      )}

      {/* ── Top Metric Cards (Always Visible) ── */}
      <CostOverviewMetrics summary={summary} budget={budget} />

      {/* ── Tab Content Container with Min Height to Prevent Vertical Jerk ── */}
      <div className="min-h-[500px]">
        {currentTab === 'overview' && (
          <div key="overview" className="space-y-4 animate-tab-pane">
            {/* Main 2-Column Dashboard: Trend Chart & Donut Distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <div className="xl:col-span-7">
                <DailyUsageTrendChart days={chartDays} onDaysChange={setChartDays} />
              </div>
              <div className="xl:col-span-5">
                <DistributionCharts summary={summary} />
              </div>
            </div>

            {/* Quick Budget & Pricing Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <BudgetManagementCard
                budget={budget}
                summary={summary}
                onBudgetUpdated={setBudget}
              />
              <ModelPricingConfigCard />
            </div>
          </div>
        )}

        {currentTab === 'charts' && (
          <div key="charts" className="space-y-4 animate-tab-pane">
            <DailyUsageTrendChart days={chartDays} onDaysChange={setChartDays} />
          </div>
        )}

        {currentTab === 'distribution' && (
          <div key="distribution" className="space-y-4 animate-tab-pane">
            <DistributionCharts summary={summary} />
          </div>
        )}

        {currentTab === 'budget' && (
          <div key="budget" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start animate-tab-pane">
            <BudgetManagementCard
              budget={budget}
              summary={summary}
              onBudgetUpdated={setBudget}
            />
            <ModelPricingConfigCard />
          </div>
        )}

        {currentTab === 'pricing' && (
          <div key="pricing" className="space-y-4 animate-tab-pane">
            <ModelPricingConfigCard />
          </div>
        )}

        {currentTab === 'logs' && (
          <div key="logs" className="space-y-4 animate-tab-pane">
            <RecentUsageLogsTable records={records} />
          </div>
        )}
      </div>

      {/* ── Privacy & Security Footer ── */}
      <div className="flex items-start gap-2.5 bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl text-[10.5px] text-white/50 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-white/80">Local-First Storage & Real API Verification:</strong> Toàn bộ số liệu token usage và chi phí được lưu trữ cục bộ trên máy tính của bạn. Không gửi bất kỳ dữ liệu nào đến máy chủ bên thứ ba. Giá tiền được tính toán trực tiếp từ dữ liệu token trả về trong HTTP response của từng nhà cung cấp.
        </span>
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121624] border border-white/15 rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Xác nhận đặt lại thống kê?</h3>
            </div>

            <p className="text-[11.5px] text-white/70 leading-relaxed">
              Hành động này sẽ <strong className="text-rose-300">xóa sạch toàn bộ lịch sử sử dụng token và chi phí API</strong> đã lưu trữ trên trình duyệt. Dữ liệu các phiên họp trước đó sẽ không thể phục hồi.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsResetConfirmOpen(false)}
                className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleResetConfirmed}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg shadow-sm"
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CostTracker
