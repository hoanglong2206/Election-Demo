import { useState } from 'react'
import {
  Zap,
  RotateCcw,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Sparkles,
  Settings,
  Terminal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIModelConfig, AIBenchmarkResult } from '../../../services/ai-model/aiModels'

const SAMPLE_BENCHMARK_PROMPTS = [
  {
    id: 'cap',
    label: '⚡ CAP Theorem (Đo latency)',
    prompt: 'Phân tích định lý CAP và đánh đổi giữa Latency vs Consistency trong 1 câu ngắn gọn.',
  },
  {
    id: 'grpc',
    label: '💡 gRPC vs REST (Kỹ thuật)',
    prompt: 'So sánh ưu nhược điểm giữa gRPC và REST API trong kiến trúc Microservices chịu tải cao.',
  },
  {
    id: 'ratelimit',
    label: '🎯 Rate Limiter (System Design)',
    prompt: 'Nêu 3 bước quan trọng nhất để thiết kế hệ thống Rate Limiter phân tán chịu tải 100,000 RPS.',
  },
  {
    id: 'debounce',
    label: '🚀 Debounce TS (Coding)',
    prompt: 'Viết hàm TypeScript debounce có generic type <T> và cancel method ngắn gọn, chuẩn sạch.',
  },
  {
    id: 'english',
    label: '💬 English (Phỏng vấn)',
    prompt: 'Explain the difference between Optimistic Locking and Pessimistic Locking with a brief example.',
  },
]

interface AIBenchmarkCardProps {
  currentModel: AIModelConfig
  benchmarkResult: AIBenchmarkResult | null
  isBenchmarking: boolean
  onRunBenchmark: (customPrompt?: string) => void
  onOpenSettings?: () => void
}

export function AIBenchmarkCard({
  currentModel,
  benchmarkResult,
  isBenchmarking,
  onRunBenchmark,
  onOpenSettings,
}: AIBenchmarkCardProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>('cap')
  const [customPrompt, setCustomPrompt] = useState<string>(SAMPLE_BENCHMARK_PROMPTS[0].prompt)
  const [copied, setCopied] = useState(false)

  const handleSelectSample = (sample: (typeof SAMPLE_BENCHMARK_PROMPTS)[0]) => {
    setSelectedPromptId(sample.id)
    setCustomPrompt(sample.prompt)
  }

  const handlePromptChange = (val: string) => {
    setCustomPrompt(val)
    const matched = SAMPLE_BENCHMARK_PROMPTS.find((s) => s.prompt === val)
    setSelectedPromptId(matched ? matched.id : 'custom')
  }

  const isNoModel = !currentModel.id || currentModel.id === 'no-model-configured'

  const handleTriggerBenchmark = () => {
    if (!customPrompt.trim() || isNoModel) return
    onRunBenchmark(customPrompt.trim())
  }

  const handleCopyResponse = () => {
    if (benchmarkResult?.response) {
      navigator.clipboard.writeText(benchmarkResult.response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isSuccess = benchmarkResult?.isRealAPI
  const isError = benchmarkResult && !benchmarkResult.isRealAPI

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 space-y-3.5 shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05] gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-white/95 leading-tight">
                Đo Tốc Độ API (AI Benchmark Real-time)
              </span>
              <Badge
                variant="outline"
                className="text-[8.5px] px-1.5 py-0 border font-mono bg-violet-500/10 text-violet-300 border-violet-500/30"
              >
                {currentModel.provider}
              </Badge>
            </div>
            <span className="text-[10px] text-white/40 font-mono">
              Model ID: <code className="text-violet-300">{currentModel.id}</code>
            </span>
          </div>
        </div>

        {/* Test Speed Button */}
        <Button
          id="btn-test-ai-speed"
          size="sm"
          onClick={handleTriggerBenchmark}
          disabled={isBenchmarking || !customPrompt.trim() || isNoModel}
          title={isNoModel ? 'Chưa cấu hình mô hình hoặc API Key' : 'Kiểm tra tốc độ phản hồi từ API thực tế'}
          className={cn(
            'text-[11px] h-7 px-3 gap-1.5 shadow-sm font-medium transition-all shrink-0',
            isNoModel
              ? 'bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/10'
              : 'bg-amber-600 hover:bg-amber-500 text-white'
          )}
        >
          {isBenchmarking ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang đo...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Test AI Speed</span>
            </>
          )}
        </Button>
      </div>

      {/* 3 Real-time Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Metric 1: Latency */}
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[9.5px] text-white/40 uppercase font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Độ trễ Roundtrip</span>
          </span>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-[17px] font-mono font-bold text-white tracking-tight">
              {benchmarkResult ? `${benchmarkResult.latencyMs}ms` : '---'}
            </span>
            {benchmarkResult && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[8.5px] px-1.5 py-0 font-mono shrink-0',
                  benchmarkResult.latencyMs < 300
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : benchmarkResult.latencyMs < 750
                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                )}
              >
                {benchmarkResult.latencyMs < 300
                  ? 'Siêu tốc'
                  : benchmarkResult.latencyMs < 750
                  ? 'Nhanh'
                  : 'Bình thường'}
              </Badge>
            )}
          </div>
        </div>

        {/* Metric 2: Tokens / sec */}
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[9.5px] text-white/40 uppercase font-medium flex items-center gap-1">
            <Gauge className="w-3 h-3 text-violet-400 shrink-0" />
            <span>Tốc độ sinh (Speed)</span>
          </span>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-[17px] font-mono font-bold text-violet-300 tracking-tight">
              {benchmarkResult ? `${benchmarkResult.tokensPerSec}` : '---'}
            </span>
            <span className="text-[9.5px] text-white/40 font-mono">tokens/s</span>
          </div>
        </div>

        {/* Metric 3: Real API Status */}
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/[0.06] flex flex-col justify-between">
          <span className="text-[9.5px] text-white/40 uppercase font-medium flex items-center gap-1">
            {isSuccess ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : isError ? (
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            ) : (
              <Terminal className="w-3 h-3 text-white/40 shrink-0" />
            )}
            <span>Trạng thái kết nối</span>
          </span>
          <div className="mt-1">
            <span
              className={cn(
                'text-[12px] font-mono font-semibold truncate block',
                isSuccess
                  ? 'text-emerald-400'
                  : isError
                  ? 'text-amber-400'
                  : 'text-white/50'
              )}
            >
              {isSuccess
                ? 'Real API Verified'
                : isError
                ? 'Lỗi API / Chưa có key'
                : 'Chờ kiểm tra'}
            </span>
            <span className="text-[8.5px] text-white/35 font-mono truncate block">
              {benchmarkResult?.timestamp || 'Bấm Test để gửi prompt'}
            </span>
          </div>
        </div>
      </div>

      {/* Sample Prompts (Mẫu Prompt Thử Nghiệm) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-white/60 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Mẫu prompt thử nghiệm (Bấm để chọn nhanh):</span>
          </span>
          {selectedPromptId === 'custom' && (
            <span className="text-violet-300 text-[9.5px] font-mono italic">
              Đang dùng prompt tùy chỉnh
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {SAMPLE_BENCHMARK_PROMPTS.map((sample) => {
            const isSelected = selectedPromptId === sample.id
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-lg border transition-all whitespace-nowrap font-medium',
                  isSelected
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm'
                    : 'bg-white/[0.02] text-white/60 border-white/[0.07] hover:bg-white/[0.06] hover:text-white'
                )}
              >
                {sample.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom Prompt Textarea */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] px-0.5">
          <span className="text-white/50">Nội dung prompt test gửi lên mô hình:</span>
          <span className="text-white/35 font-mono">{customPrompt.length} ký tự</span>
        </div>
        <textarea
          rows={2}
          value={customPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder="Nhập prompt tùy ý bạn muốn test tốc độ API..."
          className="w-full min-h-[56px] max-h-[110px] bg-black/40 border border-white/[0.08] rounded-lg p-2 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 resize-y font-mono leading-relaxed custom-scrollbar"
        />
      </div>

      {/* Real Response Box */}
      <div className="bg-black/40 border border-white/[0.07] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1.5">
            <span className="text-white/60 font-medium">Phản hồi từ Real API:</span>
            {isSuccess && (
              <Badge
                variant="outline"
                className="text-[8px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-mono"
              >
                Real API Response ({benchmarkResult.latencyMs}ms)
              </Badge>
            )}
          </div>

          {benchmarkResult && (
            <button
              type="button"
              onClick={handleCopyResponse}
              className="text-[9.5px] text-white/40 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.08]"
            >
              {copied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-300">Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.05] text-[11px] leading-relaxed min-h-[60px] flex items-center">
          {isBenchmarking ? (
            <div className="flex items-center gap-2 text-white/50 font-mono py-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Đang gửi request lên Real API của {currentModel.provider} và đo mili-giây...</span>
            </div>
          ) : isError ? (
            <div className="w-full space-y-2 py-0.5">
              <div className="flex items-start gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="text-[11px] leading-relaxed">
                  <p className="font-semibold text-amber-200">Không thể thực hiện benchmark:</p>
                  <p className="text-amber-300/80 mt-0.5">{benchmarkResult.response}</p>
                </div>
              </div>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-[10px] text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition-all"
                >
                  <Settings className="w-3 h-3" />
                  <span>Mở Cài Đặt (Settings) để thêm API Key</span>
                </button>
              )}
            </div>
          ) : benchmarkResult ? (
            <p className="text-white/90 whitespace-pre-wrap">{benchmarkResult.response}</p>
          ) : (
            <p className="text-white/35 italic">
              Bấm nút <strong className="text-amber-300 font-semibold">&quot;Test AI Speed&quot;</strong> ở trên để đo độ trễ và nhận phản hồi thực tế từ nhà cung cấp {currentModel.provider}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
