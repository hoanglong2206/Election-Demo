import { useState, useRef, useEffect, useCallback } from 'react'
import { Zap, Cpu, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AIModelConfig, AIBenchmarkResult } from '@/services/ai-model/aiModels'
import {
  BENCHMARK_PROMPT_PRESETS,
  type BenchmarkPromptPreset,
} from '../../types'
import { BenchmarkMetricCards } from './BenchmarkMetricCards'
import { BenchmarkPromptForm } from './BenchmarkPromptForm'
import { BenchmarkResponseView } from './BenchmarkResponseView'

export interface AILatencyBenchmarkSectionProps {
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
  const [customPrompt, setCustomPrompt] = useState<string>(
    BENCHMARK_PROMPT_PRESETS[0].prompt
  )
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSelectPreset = useCallback((preset: BenchmarkPromptPreset) => {
    setSelectedPromptId(preset.id)
    setCustomPrompt(preset.prompt)
  }, [])

  const handlePromptChange = useCallback((val: string) => {
    setCustomPrompt(val)
    const matched = BENCHMARK_PROMPT_PRESETS.find((s) => s.prompt === val)
    setSelectedPromptId(matched ? matched.id : 'custom')
  }, [])

  const isNoModel =
    !currentModel.id || currentModel.id === 'no-model-configured'

  const handleTriggerBenchmark = useCallback(() => {
    if (!customPrompt.trim() || isNoModel) return
    onRunBenchmark(selectedModelId, customPrompt.trim())
  }, [customPrompt, isNoModel, onRunBenchmark, selectedModelId])

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
              Đo streaming: thời gian tới token đầu tiên (TTFT) và tốc độ sinh
              token
            </span>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className={cn(
              'h-7 px-2.5 rounded-lg bg-black/50 hover:bg-black/70 border border-white/10 hover:border-amber-500/40 text-[11px] text-white/90 flex items-center gap-1.5 transition-all duration-200 shadow-inner select-none cursor-pointer active:scale-[0.99]',
              isDropdownOpen && 'border-amber-500/60 ring-2 ring-amber-500/25'
            )}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="max-w-[140px] truncate font-mono text-[10.5px] font-medium">
              {currentModel.name || currentModel.id}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
                isDropdownOpen && 'rotate-180 text-amber-400'
              )}
            />
          </button>

          {isDropdownOpen && (
            <div
              role="listbox"
              className="absolute right-0 top-full mt-1.5 w-64 max-h-60 overflow-y-auto rounded-xl bg-[#0c101d]/95 backdrop-blur-2xl border border-white/15 p-1 z-50 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] custom-scrollbar animate-in fade-in zoom-in-95 duration-150 ease-out space-y-0.5"
            >
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
                    'w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-all duration-150 select-none cursor-pointer',
                    selectedModelId === m.id
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/35 font-medium shadow-sm'
                      : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1 py-0 shrink-0 text-white/50"
                  >
                    {m.provider}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4 Real-time Metrics Cards */}
      <BenchmarkMetricCards benchmarkResult={benchmarkResult} />

      {/* Preset Prompts Selector & Textarea Form */}
      <BenchmarkPromptForm
        selectedPromptId={selectedPromptId}
        customPrompt={customPrompt}
        onSelectPreset={handleSelectPreset}
        onPromptChange={handlePromptChange}
        onTriggerBenchmark={handleTriggerBenchmark}
        isBenchmarking={isBenchmarking}
        isNoModel={isNoModel}
        currentModel={currentModel}
      />

      {/* Benchmark Response Card */}
      <BenchmarkResponseView benchmarkResult={benchmarkResult} />
    </div>
  )
}
