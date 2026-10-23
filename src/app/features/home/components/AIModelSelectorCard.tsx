import { useState } from 'react'
import {
  Cpu,
  ChevronDown,
  Check,
  ExternalLink,
  Activity,
  Zap,
  ArrowRight,
  Bot,
  Mic,
  Gauge,
  Shield,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AIModelConfig } from '../../../services/ai-model/aiModels'
import type { STTEngineConfig } from '../../../services/ai-model/types'

interface AIModelSelectorCardProps {
  className?: string
  // LLM props
  aiModels: AIModelConfig[]
  selectedModelId: string
  currentModel: AIModelConfig
  hasModels: boolean
  isModelDropdownOpen: boolean
  isPinging: boolean
  livePing: number
  modelDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onModelChange: (id: string) => void
  onTestPing: () => void
  onOpenSettings: () => void
  onOpenBenchmark?: () => void

  // STT props
  sttEngines: STTEngineConfig[]
  selectedSTTId: string
  currentSTTEngine: STTEngineConfig | undefined
  isSTTDropdownOpen: boolean
  sttDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleSTTDropdown: () => void
  onSTTChange: (id: string) => void
  onOpenAudioTest?: () => void
  isSTTPinging?: boolean
  liveSTTLatency?: number
  onTestSTTPing?: () => void
}

export function AIModelSelectorCard({
  className,
  aiModels,
  selectedModelId,
  currentModel,
  hasModels,
  isModelDropdownOpen,
  isPinging,
  livePing,
  modelDropdownRef,
  onToggleDropdown,
  onModelChange,
  onTestPing,
  onOpenSettings,
  onOpenBenchmark,
  sttEngines,
  selectedSTTId,
  currentSTTEngine,
  isSTTDropdownOpen,
  sttDropdownRef,
  onToggleSTTDropdown,
  onSTTChange,
  onOpenAudioTest,
  isSTTPinging = false,
  liveSTTLatency,
  onTestSTTPing,
}: AIModelSelectorCardProps) {
  const [activeEngineTab, setActiveEngineTab] = useState<'llm' | 'stt'>('llm')

  return (
    <Card className={cn('bg-white/[0.03] border-white/[0.07] shadow-none p-3 gap-2 flex flex-col justify-between h-[255px] shrink-0 relative', className)}>
      {/* ── Top Header with Tab Switcher & Provider Badge ── */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.05]">
        {/* Sub-tab switcher: LLM vs STT */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px] shrink-0">
          <button
            type="button"
            id="tab-engine-llm"
            onClick={() => setActiveEngineTab('llm')}
            className={cn(
              'h-6 px-2.5 rounded-md font-medium transition-colors flex items-center gap-1.5 border select-none whitespace-nowrap shrink-0',
              activeEngineTab === 'llm'
                ? 'bg-violet-600/30 text-violet-200 border-violet-500/40 shadow-sm'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            <Bot className="w-3 h-3 text-violet-400 shrink-0" />
            <span className="whitespace-nowrap">LLM Copilot</span>
          </button>

          <button
            type="button"
            id="tab-engine-stt"
            onClick={() => setActiveEngineTab('stt')}
            className={cn(
              'h-6 px-2.5 rounded-md font-medium transition-colors flex items-center gap-1.5 border select-none whitespace-nowrap shrink-0',
              activeEngineTab === 'stt'
                ? 'bg-cyan-600/30 text-cyan-200 border-cyan-500/40 shadow-sm'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            <Mic className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="whitespace-nowrap">STT Bóc Băng</span>
          </button>
        </div>

        {/* Right Badge & Inspect Clarifier */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeEngineTab === 'llm' ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 border font-mono',
                hasModels
                  ? currentModel.tier === 'Free'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              )}
            >
              {hasModels ? currentModel.provider : 'Chưa có key'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 border font-mono',
                currentSTTEngine?.provider === 'Local'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              )}
            >
              {currentSTTEngine?.provider === 'Local' ? 'C++ Offline' : 'Cloud Whisper'}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Active Content Area (Unified Height for Zero CLS) ── */}
      {activeEngineTab === 'llm' ? (
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
                <span className="truncate font-medium">Chưa có mô hình · Bấm để thêm Key</span>
                <ExternalLink className="w-3 h-3 text-violet-400 shrink-0" />
              </button>
            )}
          </div>

          {/* Model Information Rows */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-white/40">Model ID:</span>
              <code className="text-white/85 font-mono text-[9px] truncate max-w-[170px]" title={currentModel.id}>
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
              <span className={cn('font-mono font-medium', hasModels ? 'text-emerald-400' : 'text-amber-400')}>
                {hasModels ? 'Real API Active' : 'Chưa có key'}
              </span>
            </div>
          </div>

          {/* Ping latency & test button */}
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.05]">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="text-white/40">Ping:</span>
              <span className="text-emerald-300 font-mono font-semibold">
                {hasModels ? `${livePing}ms` : '---'}
              </span>
            </div>
            <button
              id="btn-test-ping"
              type="button"
              onClick={onTestPing}
              disabled={isPinging}
              className="text-[9.5px] text-white/40 hover:text-white flex items-center gap-1 underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              <Zap className={cn('w-2.5 h-2.5 text-amber-400', isPinging && 'animate-spin')} />
              <span>{isPinging ? 'Đo ping...' : 'Đo lại'}</span>
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
      ) : (
        <div className="flex flex-col gap-2">
          {/* STT Engine Dropdown */}
          <div ref={sttDropdownRef} className="relative w-full">
            <button
              id="btn-select-stt-engine"
              type="button"
              onClick={onToggleSTTDropdown}
              className="w-full bg-black/40 border border-white/[0.1] hover:border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 flex items-center justify-between gap-1.5 transition-all text-left"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Mic className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate block font-medium">
                  {currentSTTEngine?.name || 'Local Whisper'}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
                  isSTTDropdownOpen && 'rotate-180 text-cyan-400'
                )}
              />
            </button>

            {isSTTDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 max-h-48 overflow-y-auto custom-scrollbar animate-fade-in">
                {sttEngines.map((e) => {
                  const isSelected = e.id === selectedSTTId
                  return (
                    <div
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSTTChange(e.id)}
                      onKeyDown={(ev) => ev.key === 'Enter' && onSTTChange(e.id)}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                      title={e.description}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate block font-medium">{e.name}</span>
                        <span className="text-[8px] px-1 py-0.2 rounded bg-white/5 text-white/40 shrink-0">
                          {e.provider}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* STT Information Rows */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-white/40">Mô hình STT:</span>
              <code className="text-white/85 font-mono text-[9px] truncate max-w-[170px]" title={currentSTTEngine?.id}>
                {currentSTTEngine?.id || '---'}
              </code>
            </div>
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-white/40">Phương thức:</span>
              <span className="text-cyan-300 font-mono">
                {currentSTTEngine?.provider === 'Local' ? 'C++ Offline (Bảo mật)' : 'Cloud API (Groq)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-white/40">Khuyên dùng:</span>
              <span className="text-white/75 truncate max-w-[180px]" title={currentSTTEngine?.recommendedFor}>
                {currentSTTEngine?.recommendedFor || 'Phỏng vấn / Meeting'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-white/40">Chi phí sử dụng:</span>
              <span className="text-emerald-400 font-mono font-medium">
                {currentSTTEngine?.provider === 'Local' ? 'Miễn phí 100%' : 'Gói Cloud API'}
              </span>
            </div>
          </div>

          {/* Latency row */}
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.05]">
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              <span className="text-white/40">Độ trễ xử lý:</span>
              <span className="text-cyan-300 font-mono font-semibold">
                ~{liveSTTLatency ?? currentSTTEngine?.latencyMs ?? 150}ms
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-test-stt-ping"
                type="button"
                onClick={onTestSTTPing}
                disabled={isSTTPinging}
                className="text-[9.5px] text-white/40 hover:text-white flex items-center gap-1 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                title="Đo lại độ trễ thực tế của mô hình STT"
              >
                <Zap className={cn('w-2.5 h-2.5 text-cyan-400', isSTTPinging && 'animate-spin')} />
                <span>{isSTTPinging ? 'Đang đo...' : 'Đo lại'}</span>
              </button>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {currentSTTEngine?.provider === 'Local' ? 'Offline No-Lag' : 'Cloud Speed'}
              </span>
            </div>
          </div>

          {/* Shortcut banner to Audio Test */}
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenAudioTest}
            onKeyDown={(e) => e.key === 'Enter' && onOpenAudioTest?.()}
            className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 transition-all flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-emerald-300">
                  Kiểm Tra Thu Âm & Live STT
                </span>
                <span className="text-[9.5px] text-white/40">
                  Test microphone, loopback & bóc băng
                </span>
              </div>
            </div>
            <ArrowRight className="w-3 h-3 text-emerald-400/70 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      )}
    </Card>
  )
}
