import {
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Terminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'
import {
  classifyLatency,
  formatTokenRate,
  getBenchmarkErrorDetails,
} from '../../utils/benchmarkFormatters'

export interface BenchmarkMetricCardsProps {
  benchmarkResult: AIBenchmarkResult | null
}

export function BenchmarkMetricCards({
  benchmarkResult,
}: BenchmarkMetricCardsProps) {
  const isSuccess = benchmarkResult?.isRealAPI
  const errorDetails = getBenchmarkErrorDetails(benchmarkResult?.errorCategory)
  const latencyInfo = classifyLatency(
    benchmarkResult ? (benchmarkResult.ttftMs ?? benchmarkResult.latencyMs) : 0
  )
  const tokenRateInfo = formatTokenRate(
    benchmarkResult?.tokensPerSec ?? 0,
    benchmarkResult?.tokenRateIsEstimate
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {/* Latency / TTFT */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-white/50 text-[10px] mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            TTFT (token đầu tiên)
          </span>
          {benchmarkResult && (
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                benchmarkResult.status === 'excellent'
                  ? 'bg-emerald-400'
                  : benchmarkResult.status === 'good'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              )}
            />
          )}
        </div>
        <div className="text-base font-bold font-mono text-white/90">
          {benchmarkResult ? (
            <span className={latencyInfo.color}>
              {benchmarkResult.ttftMs ?? benchmarkResult.latencyMs}{' '}
              <span className="text-[10px] font-normal text-white/40">ms</span>
            </span>
          ) : (
            <span className="text-white/20 text-sm">-- ms</span>
          )}
        </div>
        <span className="text-[9.5px] text-white/40 mt-0.5">
          {benchmarkResult ? latencyInfo.label : 'Chưa đo'}
        </span>
      </div>

      {/* Tokens / Sec */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-white/50 text-[10px] mb-1">
          <span className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-cyan-400" />
            Tốc độ sinh token
          </span>
        </div>
        <div className="text-base font-bold font-mono text-cyan-300">
          {benchmarkResult?.tokensPerSec ? (
            <span>
              {benchmarkResult.tokensPerSec}{' '}
              <span className="text-[10px] font-normal text-white/40">tok/s</span>
            </span>
          ) : (
            <span className="text-white/20 text-sm">-- tok/s</span>
          )}
        </div>
        <span className="text-[9.5px] text-white/40 mt-0.5">
          {benchmarkResult?.tokensPerSec ? tokenRateInfo.speedLabel : 'Chưa đo'}
        </span>
      </div>

      {/* Total response duration */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-white/50 text-[10px] mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-violet-400" />
            Tổng thời gian
          </span>
        </div>
        <div className="text-base font-bold font-mono text-white/90">
          {benchmarkResult ? (
            <>
              {benchmarkResult.latencyMs}{' '}
              <span className="text-[10px] font-normal text-white/40">ms</span>
            </>
          ) : (
            <span className="text-white/20 text-sm">-- ms</span>
          )}
        </div>
        <span className="text-[9.5px] text-white/40 mt-0.5">
          Từ lúc gửi đến khi nhận xong
        </span>
      </div>

      {/* Status / Output Length */}
      <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-white/50 text-[10px] mb-1">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-violet-400" />
            Kết nối API
          </span>
        </div>
        <div className="text-xs font-semibold text-white/90 truncate">
          {benchmarkResult ? (
            isSuccess ? (
              <span className="text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Real API OK
              </span>
            ) : (
              <span className="text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                {errorDetails.title}
              </span>
            )
          ) : (
            <span className="text-white/20">Sẵn sàng</span>
          )}
        </div>
        <span className="text-[9.5px] text-white/40 mt-0.5 truncate">
          {benchmarkResult?.response
            ? `${benchmarkResult.response.length} ký tự • ${
                benchmarkResult.generationMs ?? benchmarkResult.latencyMs
              }ms sinh`
            : 'Bấm Test để gửi request'}
        </span>
      </div>
    </div>
  )
}
