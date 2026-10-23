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
  Terminal,
  Cpu,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AI_BENCHMARK_MAX_OUTPUT_TOKENS, type AIModelConfig, type AIBenchmarkResult } from '../../../services/ai-model/aiModels'
import { BENCHMARK_PROMPT_PRESETS } from '../types'

interface AILatencyBenchmarkSectionProps {
  currentModel: AIModelConfig
  availableModels: AIModelConfig[]
  selectedModelId: string
  onSelectModel: (modelId: string) => void
  benchmarkResult: AIBenchmarkResult | null
  isBenchmarking: boolean
  onRunBenchmark: (modelId: string, customPrompt: string) => void
  onOpenSettings?: () => void
}

export function AILatencyBenchmarkSection({
  currentModel,
  availableModels,
  selectedModelId,
  onSelectModel,
  benchmarkResult,
  isBenchmarking,
  onRunBenchmark,
}: AILatencyBenchmarkSectionProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>('cap')
  const [customPrompt, setCustomPrompt] = useState<string>(BENCHMARK_PROMPT_PRESETS[0].prompt)
  const [copied, setCopied] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleSelectPreset = (preset: (typeof BENCHMARK_PROMPT_PRESETS)[0]) => {
    setSelectedPromptId(preset.id)
    setCustomPrompt(preset.prompt)
  }

  const handlePromptChange = (val: string) => {
    setCustomPrompt(val)
    const matched = BENCHMARK_PROMPT_PRESETS.find((s) => s.prompt === val)
    setSelectedPromptId(matched ? matched.id : 'custom')
  }

  const isNoModel = !currentModel.id || currentModel.id === 'no-model-configured'

  const handleTriggerBenchmark = () => {
    if (!customPrompt.trim() || isNoModel) return
    onRunBenchmark(selectedModelId, customPrompt.trim())
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
  const errorTitle = benchmarkResult?.errorCategory
    ? {
        authentication: 'API key / quyền truy cập',
        model: 'Model không khả dụng',
        quota: 'Quota / billing đã hết',
        rate_limit: 'Giới hạn tốc độ (rate limit)',
        request: 'Request không hợp lệ',
        service: 'Provider đang gặp sự cố',
        network: 'Lỗi kết nối mạng',
        unknown: 'Lỗi chưa phân loại',
      }[benchmarkResult.errorCategory]
    : 'Lỗi API'
  const errorAdvice = benchmarkResult?.errorCategory
    ? {
        authentication: 'Kiểm tra API key và quyền truy cập model trong trang quản lý của provider.',
        model: 'Model có thể đã ngừng phục vụ hoặc key không được cấp quyền. Hãy đồng bộ lại danh sách rồi chọn model khác.',
        quota: 'Kiểm tra quota, billing hoặc giới hạn chi tiêu trong dashboard của provider.',
        rate_limit: 'Đang gửi quá nhanh hoặc chạm giới hạn tạm thời. Chờ thời gian reset rồi thử lại.',
        request: 'Provider từ chối cấu hình gửi lên. Kiểm tra model, endpoint và tham số hỗ trợ.',
        service: 'Provider đang gặp sự cố tạm thời. Thử lại sau.',
        network: 'Kiểm tra kết nối mạng rồi thử lại.',
        unknown: 'Xem chi tiết lỗi từ provider bên dưới.',
      }[benchmarkResult.errorCategory]
    : null

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3.5 shadow-sm flex flex-col h-full">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white/95 leading-tight">
                Đo Tốc Độ API (LLM Benchmark)
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border font-mono bg-violet-500/10 text-violet-300 border-violet-500/30"
              >
                {currentModel.provider}
              </Badge>
            </div>
            <span className="text-[10px] text-white/40">
              Đo streaming: thời gian tới token đầu tiên (TTFT) và tốc độ sinh token
            </span>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="h-7 px-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 text-[11px] text-white/80 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="max-w-[140px] truncate font-mono text-[10.5px]">
              {currentModel.name || currentModel.id}
            </span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 max-h-60 overflow-y-auto rounded-xl bg-slate-900 border border-white/15 p-1 z-30 shadow-2xl custom-scrollbar animate-fade-in">
              <div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Chọn mô hình cần đo tốc độ
              </div>
              {availableModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(m.id)
                    setIsDropdownOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors',
                    selectedModelId === m.id
                      ? 'bg-amber-500/20 text-amber-200 font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 text-white/50">
                    {m.provider}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3 Real-time Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Latency */}
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
              <span
                className={cn(
                  benchmarkResult.status === 'excellent'
                    ? 'text-emerald-300'
                    : benchmarkResult.status === 'good'
                    ? 'text-amber-300'
                    : 'text-rose-300'
                )}
              >
                {benchmarkResult.ttftMs ?? benchmarkResult.latencyMs} <span className="text-[10px] font-normal text-white/40">ms</span>
              </span>
            ) : (
              <span className="text-white/20 text-sm">-- ms</span>
            )}
          </div>
          <span className="text-[9.5px] text-white/40 mt-0.5">
            {benchmarkResult
              ? (benchmarkResult.ttftMs ?? benchmarkResult.latencyMs) < 300
                ? '⚡ Cực nhanh (Fast)'
                : (benchmarkResult.ttftMs ?? benchmarkResult.latencyMs) < 800
                ? 'Ổn định (Normal)'
                : 'Chậm / Đang chờ'
              : 'Chưa đo'}
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
            {benchmarkResult?.tokensPerSec
              ? benchmarkResult.tokensPerSec > 80
                ? `🚀 Siêu tốc${benchmarkResult.tokenRateIsEstimate ? ' (ước tính)' : ''}`
                : benchmarkResult.tokenRateIsEstimate ? 'Ước tính từ nội dung' : 'Theo usage API'
              : 'Chưa đo'}
          </span>
        </div>

        {/* Total response duration */}
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-[10px] mb-1">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-violet-400" />Tổng thời gian phản hồi</span>
          </div>
          <div className="text-base font-bold font-mono text-white/90">
            {benchmarkResult ? <>{benchmarkResult.latencyMs} <span className="text-[10px] font-normal text-white/40">ms</span></> : <span className="text-white/20 text-sm">-- ms</span>}
          </div>
          <span className="text-[9.5px] text-white/40 mt-0.5">Từ lúc gửi đến khi nhận xong</span>
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
                  {errorTitle}
                </span>
              )
            ) : (
              <span className="text-white/20">Sẵn sàng</span>
            )}
          </div>
          <span className="text-[9.5px] text-white/40 mt-0.5 truncate">
            {benchmarkResult?.response
              ? `${benchmarkResult.response.length} ký tự • ${benchmarkResult.generationMs ?? benchmarkResult.latencyMs}ms sinh`
              : 'Bấm Test để gửi request'}
          </span>
        </div>
      </div>

      {/* Preset Prompts Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-white/70 block">
          Chọn câu hỏi kiểm thử mẫu hoặc nhập câu hỏi:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BENCHMARK_PROMPT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={cn(
                'text-[10px] px-2 py-1 rounded-lg border transition-all text-left whitespace-nowrap',
                selectedPromptId === p.id
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-medium shadow-sm'
                  : 'bg-white/[0.02] text-white/60 border-white/[0.08] hover:bg-white/[0.06] hover:text-white'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Textarea and Execute Button */}
      <div className="space-y-2">
        <div className="relative">
          <textarea
            value={customPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            rows={2}
            placeholder="Nhập câu hỏi benchmark tùy chọn..."
            className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-xl p-2.5 text-white/90 placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-none transition-all"
          />
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/75">
          <span className="font-semibold text-amber-200">Có thể phát sinh phí hoặc tiêu quota.</span>{' '}
          Khi bấm, ứng dụng gửi một request thật tới <span className="font-mono text-amber-100">{currentModel.provider} / {currentModel.id}</span>; giới hạn đầu ra là tối đa {AI_BENCHMARK_MAX_OUTPUT_TOKENS} token. Chi phí thực tế tùy giá và cách tính token của provider.
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/40">
            Prompt {customPrompt.length} ký tự • Tối đa {AI_BENCHMARK_MAX_OUTPUT_TOKENS} token • <code className="text-amber-300 font-mono">{currentModel.id}</code>
          </span>

          <Button
            id="btn-run-ai-benchmark"
            size="sm"
            onClick={handleTriggerBenchmark}
            disabled={isBenchmarking || !customPrompt.trim() || isNoModel}
            className={cn(
              'text-[11px] h-8 px-4 gap-1.5 shadow-sm font-medium transition-all shrink-0',
              isNoModel
                ? 'bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/10'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            )}
          >
            {isBenchmarking ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang gửi request...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Bắt Đầu Đo Tốc Độ</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Benchmark Response Card */}
      <div className="flex-1 flex flex-col min-h-[160px] bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-white/50 text-[10.5px] pb-1.5 border-b border-white/[0.05]">
          <span className="font-medium text-white/70 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            Nội dung phản hồi từ AI
            {benchmarkResult?.timestamp && (
              <span className="text-white/30 text-[9.5px]">({benchmarkResult.timestamp})</span>
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
                    <p className="text-[12px] font-semibold text-rose-200">{errorTitle}</p>
                    <p className="text-[10.5px] text-rose-100/75 leading-relaxed">{errorAdvice}</p>
                    <p className="text-[9.5px] text-rose-200/50 font-mono break-all">{benchmarkResult.provider} · {benchmarkResult.modelName} ({benchmarkResult.modelId})</p>
                  </div>
                </div>
                <details className="border-t border-rose-400/15 pt-2">
                  <summary className="cursor-pointer select-none text-[10px] text-rose-200/65 hover:text-rose-100">Chi tiết lỗi từ API</summary>
                  <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-rose-100/75">{benchmarkResult.response}</pre>
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
    </div>
  )
}
