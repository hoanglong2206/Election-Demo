import { Zap, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  AI_BENCHMARK_MAX_OUTPUT_TOKENS,
  type AIModelConfig,
} from '@/services/ai-model/aiModels'
import {
  BENCHMARK_PROMPT_PRESETS,
  type BenchmarkPromptPreset,
} from '../../types'

export interface BenchmarkPromptFormProps {
  selectedPromptId: string
  customPrompt: string
  onSelectPreset: (preset: BenchmarkPromptPreset) => void
  onPromptChange: (val: string) => void
  onTriggerBenchmark: () => void
  isBenchmarking: boolean
  isNoModel: boolean
  currentModel: AIModelConfig
}

export function BenchmarkPromptForm({
  selectedPromptId,
  customPrompt,
  onSelectPreset,
  onPromptChange,
  onTriggerBenchmark,
  isBenchmarking,
  isNoModel,
  currentModel,
}: BenchmarkPromptFormProps) {
  return (
    <div className="space-y-3">
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
              onClick={() => onSelectPreset(p)}
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
            onChange={(e) => onPromptChange(e.target.value)}
            rows={2}
            autoComplete="off"
            spellCheck={false}
            placeholder="Nhập câu hỏi benchmark tùy chọn..."
            className="w-full text-xs font-mono bg-[#0d111d] border border-white/10 rounded-xl p-2.5 text-white/90 placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-none transition-colors duration-150 caret-amber-400"
          />
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/75">
          <span className="font-semibold text-amber-200">
            Có thể phát sinh phí hoặc tiêu quota.
          </span>{' '}
          Khi bấm, ứng dụng gửi một request thật tới{' '}
          <span className="font-mono text-amber-100">
            {currentModel.provider} / {currentModel.id}
          </span>
          ; giới hạn đầu ra là tối đa {AI_BENCHMARK_MAX_OUTPUT_TOKENS} token. Chi
          phí thực tế tùy giá và cách tính token của provider.
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/40">
            Prompt {customPrompt.length} ký tự • Tối đa{' '}
            {AI_BENCHMARK_MAX_OUTPUT_TOKENS} token •{' '}
            <code className="text-amber-300 font-mono">{currentModel.id}</code>
          </span>

          <Button
            id="btn-run-ai-benchmark"
            size="sm"
            onClick={onTriggerBenchmark}
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
    </div>
  )
}
