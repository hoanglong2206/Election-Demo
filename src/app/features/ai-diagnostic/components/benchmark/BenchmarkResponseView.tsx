import { useState, useCallback } from 'react'
import {
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'
import { getBenchmarkErrorDetails } from '../../utils/benchmarkFormatters'

export interface BenchmarkResponseViewProps {
  benchmarkResult: AIBenchmarkResult | null
}

export function BenchmarkResponseView({
  benchmarkResult,
}: BenchmarkResponseViewProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyResponse = useCallback(() => {
    if (benchmarkResult?.response) {
      navigator.clipboard.writeText(benchmarkResult.response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [benchmarkResult])

  const isError = benchmarkResult && !benchmarkResult.isRealAPI
  const errorDetails = getBenchmarkErrorDetails(benchmarkResult?.errorCategory)

  return (
    <div className="flex-1 flex flex-col min-h-[160px] bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-white/50 text-[10.5px] pb-1.5 border-b border-white/[0.05]">
        <span className="font-medium text-white/70 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          Nội dung phản hồi từ AI
          {benchmarkResult?.timestamp && (
            <span className="text-white/30 text-[9.5px]">
              ({benchmarkResult.timestamp})
            </span>
          )}
        </span>

        {benchmarkResult?.response && (
          <button
            type="button"
            onClick={handleCopyResponse}
            className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors p-0.5 rounded"
            title="Sao chép câu trả lời"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar text-xs text-white/80 leading-relaxed font-sans pr-1">
        {benchmarkResult?.response ? (
          isError && benchmarkResult.errorCategory ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="text-[12px] font-semibold text-rose-200">
                    {errorDetails.title}
                  </p>
                  <p className="text-[10.5px] text-rose-100/75 leading-relaxed">
                    {errorDetails.advice}
                  </p>
                  <p className="text-[9.5px] text-rose-200/50 font-mono break-all">
                    {benchmarkResult.provider} · {benchmarkResult.modelName} (
                    {benchmarkResult.modelId})
                  </p>
                </div>
              </div>
              <details className="border-t border-rose-400/15 pt-2">
                <summary className="cursor-pointer select-none text-[10px] text-rose-200/65 hover:text-rose-100">
                  Chi tiết lỗi từ API
                </summary>
                <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-rose-100/75">
                  {benchmarkResult.response}
                </pre>
              </details>
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-lg p-2 font-mono text-[11.5px] bg-white/[0.02] text-white/90 break-words">
              {benchmarkResult.response}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-6 text-white/30 space-y-1">
            <Zap className="w-6 h-6 text-white/20" />
            <p className="text-[11px]">Chưa có dữ liệu phản hồi.</p>
            <p className="text-[10px] text-white/25">
              Bấm &quot;Bắt Đầu Đo Tốc Độ&quot; để kiểm tra thời gian phản hồi thực tế từ API.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
