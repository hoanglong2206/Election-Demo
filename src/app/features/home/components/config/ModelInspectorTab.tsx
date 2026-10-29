import { Cpu, ChevronDown, Check, ExternalLink, Activity, Zap, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIModelConfig } from '@/services/ai-model/aiModels'

export interface ModelInspectorTabProps {
  aiModels: AIModelConfig[]
  selectedModelId: string
  currentModel: AIModelConfig
  hasModels: boolean
  isModelDropdownOpen: boolean
  isPinging: boolean
  livePing: number
  pingError?: string | null
  modelDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onModelChange: (id: string) => void
  onTestPing: () => void
  onOpenSettings: () => void
  onOpenBenchmark?: () => void
}

export function ModelInspectorTab({
  aiModels,
  selectedModelId,
  currentModel,
  hasModels,
  isModelDropdownOpen,
  isPinging,
  livePing,
  pingError,
  modelDropdownRef,
  onToggleDropdown,
  onModelChange,
  onTestPing,
  onOpenSettings,
  onOpenBenchmark,
}: ModelInspectorTabProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* LLM Model Dropdown */}
      <div ref={modelDropdownRef} className="relative w-full">
        {hasModels ? (
          <>
            <button
              id="btn-select-ai-model"
              type="button"
              onClick={onToggleDropdown}
              className="w-full bg-black/40 border border-white/[0.1] hover:border-violet-500/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 flex items-center justify-between gap-1.5 transition-all text-left"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Cpu className="w-3 h-3 text-violet-400 shrink-0" />
                <span className="truncate block font-medium">
                  {currentModel.name} ({currentModel.provider})
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
                  isModelDropdownOpen && 'rotate-180 text-violet-400'
                )}
              />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 max-h-48 overflow-y-auto custom-scrollbar animate-fade-in">
                {aiModels.map((m) => {
                  const isSelected = m.id === selectedModelId
                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onModelChange(m.id)}
                      onKeyDown={(e) => e.key === 'Enter' && onModelChange(m.id)}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-violet-500/20 text-violet-300 font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                      title={`${m.name} (${m.provider})`}
                    >
                      <span className="truncate pr-2 block">
                        {m.name} ({m.provider})
                      </span>
                      {isSelected && <Check className="w-3 h-3 text-violet-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-violet-200 flex items-center justify-between transition-all"
          >
            <span className="truncate font-medium">
              Chưa có mô hình · Bấm để thêm Key
            </span>
            <ExternalLink className="w-3 h-3 text-violet-400 shrink-0" />
          </button>
        )}
      </div>

      {/* Model Information Rows */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Model ID:</span>
          <code
            className="text-white/85 font-mono text-[9px] truncate max-w-[170px]"
            title={currentModel.id}
          >
            {hasModels ? currentModel.id : '---'}
          </code>
        </div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Ngữ cảnh hỗ trợ:</span>
          <span className="text-white/80 font-mono">
            {hasModels ? currentModel.contextWindow : 'Chưa kích hoạt'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Capabilities:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {hasModels && currentModel.capabilities && currentModel.capabilities.length > 0 ? (
              currentModel.capabilities.map((c) => (
                <span
                  key={c}
                  className="text-[8px] uppercase font-mono px-1 py-0.2 rounded bg-white/5 border border-white/10 text-violet-300"
                >
                  {c}
                </span>
              ))
            ) : (
              <span className="text-white/40 font-mono text-[8.5px]">Text only</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Trạng thái API:</span>
          <span
            className={cn(
              'font-mono font-medium',
              hasModels ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            {hasModels ? 'Real API Active' : 'Chưa có key'}
          </span>
        </div>
      </div>

      {/* Ping latency & test button */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.05] h-6">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-white/40">Ping:</span>
          {isPinging ? (
            <span className="text-amber-300 font-mono text-[9.5px] flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
              <span>Đang đo...</span>
            </span>
          ) : pingError ? (
            <span className="text-rose-400 font-mono text-[9px] truncate" title={pingError}>
              Lỗi đo ({livePing}ms)
            </span>
          ) : (
            <span className="text-emerald-300 font-mono font-semibold">
              {hasModels ? `${livePing}ms` : '---'}
            </span>
          )}
        </div>
        <button
          id="btn-test-ping"
          type="button"
          onClick={() => onTestPing()}
          disabled={isPinging}
          className="text-[9.5px] text-white/40 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 underline underline-offset-2 whitespace-nowrap shrink-0 transition-opacity"
        >
          <Zap className={cn('w-2.5 h-2.5 text-amber-400', isPinging && 'animate-spin')} />
          <span>{isPinging ? 'Đang đo...' : 'Đo lại'}</span>
        </button>
      </div>

      {/* Shortcut banner to AI Benchmark */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenBenchmark}
        onKeyDown={(e) => e.key === 'Enter' && onOpenBenchmark?.()}
        className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/15 transition-all flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-amber-300">
              Đo Tốc Độ API (AI Benchmark)
            </span>
            <span className="text-[9.5px] text-white/40">
              Test latency, tokens/s & prompt thực tế
            </span>
          </div>
        </div>
        <ArrowRight className="w-3 h-3 text-amber-400/70 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  )
}
