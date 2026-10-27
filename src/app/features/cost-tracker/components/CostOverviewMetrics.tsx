import {
  TrendingUp,
  Bot,
  Sparkles,
  Mic,
  Sliders,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MonthlyUsageSummary, BudgetSettings } from '@/services/usage-tracker'

interface CostOverviewMetricsProps {
  summary: MonthlyUsageSummary
  budget: BudgetSettings
}

export function CostOverviewMetrics({ summary, budget }: CostOverviewMetricsProps) {
  const totalTokens = summary.totalInputTokens + summary.totalOutputTokens
  const inputRatio = totalTokens > 0 ? (summary.totalInputTokens / totalTokens) * 100 : 50
  const outputRatio = totalTokens > 0 ? (summary.totalOutputTokens / totalTokens) * 100 : 50

  // Format audio seconds
  const formatAudioTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  }

  // Budget calculations
  const budgetLimit = budget.monthlyBudgetLimitUsd ?? budget.monthlyLimitUsd
  const budgetSpendPercent =
    budgetLimit && budgetLimit > 0
      ? Math.min(100, Math.round((summary.totalEstimatedCostUsd / budgetLimit) * 100))
      : 0
  const isBudgetWarning =
    budgetLimit &&
    budgetLimit > 0 &&
    budgetSpendPercent >= (budget.warningThresholdPercent || 80)
  const isBudgetExceeded =
    budgetLimit && budgetLimit > 0 && summary.totalEstimatedCostUsd >= budgetLimit

  // Estimated cache savings in USD (~50% discount on input price)
  const estimatedSavedUsd = Number(((summary.totalCachedTokens / 1_000_000) * 1.25).toFixed(4))
  const cacheHitRate = summary.totalInputTokens > 0
    ? Math.round((summary.totalCachedTokens / summary.totalInputTokens) * 1000) / 10
    : 0
  const uncachedInput = Math.max(0, summary.totalInputTokens - summary.totalCachedTokens)

  // Average cost per request
  const avgCostPerReq =
    summary.totalRequests > 0
      ? (summary.totalEstimatedCostUsd / summary.totalRequests).toFixed(4)
      : '0.0000'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Total Estimated Cost */}
      <Card className="bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-black/40 border-white/[0.08] p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition-all shadow-none animate-metric-card [animation-delay:40ms]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5 font-medium text-white/70">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Ước tính chi phí
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[8.5px] px-1.5 py-0 border font-mono',
              summary.costStatus === 'free'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : summary.costStatus === 'unknown'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            )}
          >
            {summary.costStatus === 'free'
              ? 'Free Tier'
              : summary.costStatus === 'unknown'
              ? 'Unknown'
              : 'Pay-per-token'}
          </Badge>
        </div>

        <div className="my-2">
          {summary.hasUnknownCosts ? (
            <div className="text-xl font-bold tracking-tight text-amber-300" title="Có request chưa có quy tắc giá; tổng thực tế chưa xác định.">
              Chưa xác định
            </div>
          ) : (
            <div className="text-2xl font-bold font-mono tracking-tight text-white flex items-baseline gap-1">
              <span className="text-emerald-400 text-lg font-normal">$</span>
              <span>{summary.totalEstimatedCostUsd.toFixed(4)}</span>
            </div>
          )}
          <div className="text-[10px] text-white/40 mt-1 flex items-center justify-between">
            <span>{summary.totalRequests} API requests</span>
            <span className="font-mono text-emerald-400/80">~${avgCostPerReq}/req</span>
          </div>
        </div>

        <div className="w-full bg-white/[0.04] h-1 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
        </div>
      </Card>

      {/* 2. Total Tokens Breakdown */}
      <Card className="bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-black/40 border-white/[0.08] p-3.5 flex flex-col justify-between hover:border-cyan-500/30 transition-all shadow-none animate-metric-card [animation-delay:80ms]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5 font-medium text-white/70">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            Tổng Token Usage
          </span>
          <span className="text-[10px] font-mono text-cyan-300 font-semibold">
            {totalTokens >= 1_000_000
              ? `${(totalTokens / 1_000_000).toFixed(2)}M`
              : `${(totalTokens / 1_000).toFixed(1)}k`}
          </span>
        </div>

        <div className="my-2 font-mono text-[10.5px] space-y-1">
          <div className="flex justify-between items-center text-white/80">
            <span className="text-white/40 font-sans flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Input:
            </span>
            <span className="font-semibold text-cyan-200">
              {summary.totalInputTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-white/80">
            <span className="text-white/40 font-sans flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Output:
            </span>
            <span className="font-semibold text-blue-200">
              {summary.totalOutputTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Proportional Segmented Bar */}
        <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden flex">
          <div className="bg-cyan-400 h-full" style={{ width: `${inputRatio}%` }} title={`Input: ${Math.round(inputRatio)}%`} />
          <div className="bg-blue-500 h-full" style={{ width: `${outputRatio}%` }} title={`Output: ${Math.round(outputRatio)}%`} />
        </div>
      </Card>

      {/* 3. Prompt Caching Discount */}
      <Card className="bg-gradient-to-br from-violet-500/[0.08] via-white/[0.02] to-black/40 border-white/[0.08] p-3.5 flex flex-col justify-between hover:border-violet-500/30 transition-all shadow-none animate-metric-card [animation-delay:120ms]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5 font-medium text-white/70">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            Prompt Caching
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[8.5px] px-1 py-0 font-mono',
              cacheHitRate >= 70
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
            )}
          >
            {cacheHitRate > 0 ? `Hit ${cacheHitRate}%` : 'Giảm 50-80%'}
          </Badge>
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold font-mono tracking-tight text-violet-200">
            {summary.totalCachedTokens > 0
              ? summary.totalCachedTokens.toLocaleString()
              : '0'}
          </div>
          <div className="text-[10px] text-white/40 mt-1 flex items-center justify-between">
            <span>Tiết kiệm / Chưa cache:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              +${estimatedSavedUsd} <span className="text-white/30 font-normal">| {uncachedInput.toLocaleString()} tok</span>
            </span>
          </div>
        </div>

        <div className="w-full bg-white/[0.04] h-1 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              cacheHitRate >= 70 ? 'bg-emerald-400' : 'bg-violet-400'
            )}
            style={{ width: `${Math.min(100, Math.max(cacheHitRate > 0 ? cacheHitRate : (summary.totalCachedTokens > 0 ? 100 : 0)))}%` }}
          />
        </div>
      </Card>

      {/* 4. Audio STT Duration */}
      <Card className="bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-black/40 border-white/[0.08] p-3.5 flex flex-col justify-between hover:border-amber-500/30 transition-all shadow-none animate-metric-card [animation-delay:160ms]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5 font-medium text-white/70">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            Thời Lượng STT
          </span>
          <Badge variant="outline" className="text-[8.5px] px-1 py-0 bg-amber-500/15 text-amber-300 border-amber-500/30">
            Whisper
          </Badge>
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold font-mono tracking-tight text-amber-300">
            {formatAudioTime(summary.totalAudioDurationSeconds)}
          </div>
          <div className="text-[10px] text-white/40 mt-1 flex items-center justify-between">
            <span>Local Whisper:</span>
            <span className="text-emerald-400 font-medium">Miễn phí 100%</span>
          </div>
        </div>

        <div className="w-full bg-white/[0.04] h-1 rounded-full overflow-hidden">
          <div className="bg-amber-400 h-full rounded-full" style={{ width: summary.totalAudioDurationSeconds > 0 ? '100%' : '0%' }} />
        </div>
      </Card>

      {/* 5. Budget Progress & Status */}
      <Card className="sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-500/[0.08] via-white/[0.02] to-black/40 border-white/[0.08] p-3.5 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-none animate-metric-card [animation-delay:200ms]">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5 font-medium text-white/70">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Hạn Mức Ngân Sách
          </span>
          <span className="text-[10px] font-mono text-white/70 font-semibold">
            {budgetLimit ? `${budgetSpendPercent}%` : 'Chưa đặt'}
          </span>
        </div>

        <div className="my-2">
          <div className="text-xl font-bold font-mono tracking-tight text-white flex items-baseline gap-1">
            <span>${summary.totalEstimatedCostUsd.toFixed(2)}</span>
            <span className="text-white/40 text-xs font-normal">
              / ${budgetLimit ? budgetLimit.toFixed(2) : '---'}
            </span>
          </div>
          <div className="text-[10px] text-white/40 mt-1 flex items-center justify-between">
            <span>Trạng thái:</span>
            <span
              className={cn(
                'font-medium',
                isBudgetExceeded
                  ? 'text-rose-400'
                  : isBudgetWarning
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              )}
            >
              {isBudgetExceeded ? 'Vượt hạn mức' : isBudgetWarning ? 'Cảnh báo tiêu' : 'An toàn'}
            </span>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isBudgetExceeded
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                : isBudgetWarning
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            )}
            style={{ width: `${Math.min(100, budgetSpendPercent)}%` }}
          />
        </div>
      </Card>
    </div>
  )
}
