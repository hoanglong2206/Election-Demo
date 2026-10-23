import { useState } from 'react'
import {
  Sliders,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/ui/number-input'
import { cn } from '@/lib/utils'
import type { BudgetSettings, MonthlyUsageSummary } from '@/services/usage-tracker'
import { usageTrackerService } from '@/services/usage-tracker'

interface BudgetManagementCardProps {
  budget: BudgetSettings
  summary: MonthlyUsageSummary
  onBudgetUpdated: (newBudget: BudgetSettings) => void
}

export function BudgetManagementCard({
  budget,
  summary,
  onBudgetUpdated,
}: BudgetManagementCardProps) {
  const currentLimit = budget.monthlyBudgetLimitUsd ?? budget.monthlyLimitUsd
  const [budgetLimitInput, setBudgetLimitInput] = useState<string>(
    currentLimit ? String(currentLimit) : '20.00'
  )
  const [budgetWarningInput, setBudgetWarningInput] = useState<string>(
    String(budget.warningThresholdPercent || 80)
  )
  const [isSaved, setIsSaved] = useState(false)

  // Budget calculations
  const limitNum = parseFloat(budgetLimitInput) || 0
  const currentCost = summary.totalEstimatedCostUsd
  const budgetSpendPercent =
    limitNum > 0 ? Math.min(100, Math.round((currentCost / limitNum) * 100)) : 0
  const isBudgetWarning =
    limitNum > 0 && budgetSpendPercent >= (budget.warningThresholdPercent || 80)
  const isBudgetExceeded = limitNum > 0 && currentCost >= limitNum

  // End-of-month projection
  const now = new Date()
  const currentDay = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projectedMonthlySpend =
    currentDay > 0 ? (currentCost / currentDay) * daysInMonth : currentCost

  const handleSaveBudget = () => {
    const limit = parseFloat(budgetLimitInput)
    const threshold = parseInt(budgetWarningInput, 10)

    const updated = usageTrackerService.updateBudgetSettings({
      monthlyBudgetLimitUsd: isNaN(limit) || limit <= 0 ? null : limit,
      warningThresholdPercent: isNaN(threshold) ? 80 : Math.min(100, Math.max(10, threshold)),
    })

    onBudgetUpdated(updated)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
  }

  const applyPreset = (amount: number) => {
    setBudgetLimitInput(String(amount.toFixed(2)))
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden">
      <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-[13px] text-white/90 font-semibold flex items-center gap-2">
              <span>Quản Lý Hạn Mức Ngân Sách Hàng Tháng (Monthly Budget)</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0 border font-mono',
                  isBudgetExceeded
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : isBudgetWarning
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                )}
              >
                {isBudgetExceeded ? 'Vượt ngân sách' : isBudgetWarning ? 'Cảnh báo đạt ngưỡng' : 'Trong tầm kiểm soát'}
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-white/40 mt-0.5">
              Tự động giám sát chi phí API hàng tháng và cảnh báo trước khi vượt ngân sách
            </p>
          </div>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] animate-fade-in font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã lưu thành công!</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 pt-4 space-y-4">
        {/* Progress Bar & Current Status */}
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60 flex items-center gap-1.5">
              <span>Đã chi tiêu tháng này:</span>
              <strong className="text-white font-mono font-semibold">
                ${currentCost.toFixed(4)}
              </strong>
            </span>
            <span className="text-white/60 font-mono">
              Hạn mức: <strong className="text-white">${limitNum.toFixed(2)}</strong> ({budgetSpendPercent}%)
            </span>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-white/[0.06] h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isBudgetExceeded
                  ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                  : isBudgetWarning
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
              )}
              style={{ width: `${Math.min(100, budgetSpendPercent)}%` }}
            />
          </div>

          {/* Alerts */}
          {isBudgetExceeded ? (
            <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1.5 rounded-lg animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Cảnh báo chi tiêu:</strong> Tổng chi phí tháng ${currentCost.toFixed(2)} đã chạm hoặc vượt mức ngân sách giới hạn ${limitNum.toFixed(2)}. Hãy cân nhắc nâng hạn mức hoặc chuyển sang model rẻ hơn.
              </span>
            </div>
          ) : isBudgetWarning ? (
            <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 rounded-lg animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Sắp chạm hạn mức:</strong> Bạn đã sử dụng {budgetSpendPercent}% ngân sách (ngưỡng cảnh báo đặt ở {budget.warningThresholdPercent}%).
              </span>
            </div>
          ) : null}
        </div>

        {/* Projection & Preset Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* End-of-month Forecast */}
          <div className="bg-black/25 border border-white/[0.05] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span className="flex items-center gap-1.5 text-white/70 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Dự Phóng Chi Tiêu Cuối Tháng
              </span>
              <span className="font-mono text-cyan-300">Ngày {currentDay}/{daysInMonth}</span>
            </div>

            <div className="my-2">
              <div className="text-2xl font-bold font-mono text-cyan-200">
                ~${projectedMonthlySpend.toFixed(2)}
              </div>
              <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
                Dựa trên tốc độ tiêu thụ trung bình ${(currentDay > 0 ? currentCost / currentDay : 0).toFixed(4)}/ngày của tháng này.
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.04] text-[10px] text-white/50 flex items-center justify-between">
              <span>Chênh lệch so với hạn mức:</span>
              <span
                className={cn(
                  'font-mono font-semibold',
                  projectedMonthlySpend > limitNum ? 'text-rose-400' : 'text-emerald-400'
                )}
              >
                {projectedMonthlySpend > limitNum ? '+' : ''}$
                {(projectedMonthlySpend - limitNum).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Budget Setting Form */}
          <div className="bg-black/25 border border-white/[0.05] rounded-xl p-3 flex flex-col justify-between gap-2.5">
            <div className="text-[11px] font-medium text-white/80">
              Cấu Hình Giới Hạn & Ngưỡng Cảnh Báo
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-white/40">Gợi ý:</span>
              {[5, 10, 20, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-md border transition-all font-mono',
                    limitNum === preset
                      ? 'bg-violet-600 border-violet-500 text-white font-semibold'
                      : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                  )}
                >
                  ${preset}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">
                  Hạn mức tháng ($ USD):
                </label>
                <NumberInput
                  step={0.5}
                  min={0.5}
                  value={budgetLimitInput}
                  onChange={setBudgetLimitInput}
                  prefix="$"
                  suffix="USD"
                  stepperType="chevrons"
                  placeholder="20.00"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/50 block mb-1">
                  Cảnh báo tại (% ngân sách):
                </label>
                <NumberInput
                  step={5}
                  min={10}
                  max={100}
                  value={budgetWarningInput}
                  onChange={setBudgetWarningInput}
                  suffix="%"
                  stepperType="chevrons"
                  placeholder="80"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSaveBudget}
              className="w-full h-7 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium rounded-lg transition-all"
            >
              Lưu Cài Đặt Ngân Sách
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
