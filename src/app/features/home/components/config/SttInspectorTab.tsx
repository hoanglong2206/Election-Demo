import { Mic, ChevronDown, Check, Gauge, Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { STTEngineConfig } from '@/services/ai-model/types'

export interface SttInspectorTabProps {
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

export function SttInspectorTab({
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
}: SttInspectorTabProps) {
  return (
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
          <code
            className="text-white/85 font-mono text-[9px] truncate max-w-[170px]"
            title={currentSTTEngine?.id}
          >
            {currentSTTEngine?.id || '---'}
          </code>
        </div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Phương thức:</span>
          <span className="text-cyan-300 font-mono">
            {currentSTTEngine?.provider === 'Local'
              ? 'C++ Offline (Bảo mật)'
              : 'Cloud API (Groq)'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9.5px]">
          <span className="text-white/40">Khuyên dùng:</span>
          <span
            className="text-white/75 truncate max-w-[180px]"
            title={currentSTTEngine?.recommendedFor}
          >
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
  )
}
