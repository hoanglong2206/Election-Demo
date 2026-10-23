import { useState, useRef, useEffect, type RefObject } from 'react'
import { Sparkles, Cpu, ChevronDown, Check, Globe, Play, Trash2, Radio, Clock, Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STT_LANG_OPTIONS } from '../constants'
import type { STTLang, STTPreviewLine } from '../types'
import type { STTEngineConfig } from '../../../services/ai-model/aiModels'
import type { STTQueueMetrics } from '../../../services/ai-model/stt'

interface STTPreviewPanelProps {
  isCapturing: boolean
  isSimulatingSTT: boolean
  isTranscribing: boolean
  queueMetrics?: STTQueueMetrics
  currentSTTEngine: STTEngineConfig
  availableSTTEngines: STTEngineConfig[]
  selectedSTT: string
  onSelectSTTEngine: (engineId: string) => void
  sttLang: STTLang
  onSelectSTTLang: (lang: STTLang) => void
  sttLines: STTPreviewLine[]
  onSimulateSTT: () => void
  onClearSTT: () => void
  scrollRef: RefObject<HTMLDivElement | null>
}

export function STTPreviewPanel({
  isCapturing,
  isSimulatingSTT,
  isTranscribing,
  queueMetrics,
  currentSTTEngine,
  availableSTTEngines,
  selectedSTT,
  onSelectSTTEngine,
  sttLang,
  onSelectSTTLang,
  sttLines,
  onSimulateSTT,
  onClearSTT,
  scrollRef,
}: STTPreviewPanelProps) {
  const [isSTTMenuOpen, setIsSTTMenuOpen] = useState(false)
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
  const sttMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sttMenuRef.current && !sttMenuRef.current.contains(e.target as Node)) {
        setIsSTTMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="w-full space-y-3.5">
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-sm">
        {/* Card Header Container */}
        <div className="pb-2.5 border-b border-white/[0.05] space-y-2">
          {/* Row 1: Title & Live Status Indicator */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[12px] font-semibold text-white/95 leading-tight block">
                  Kết Quả Nhận Diện Giọng Nói Thử Nghiệm (Live STT Preview)
                </span>
              </div>
            </div>

            {/* Status indicators on top right */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Native Worker Abstract State Indicator */}
              {queueMetrics?.provider === 'Local' && queueMetrics.workerState && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] px-2 py-0.5 h-6 font-mono flex items-center gap-1 transition-all',
                    queueMetrics.workerState === 'RESTARTING' &&
                      'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
                    queueMetrics.workerState === 'FAILED' &&
                      'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    queueMetrics.workerState === 'BUSY' &&
                      'bg-blue-500/20 text-blue-300 border-blue-500/40',
                    (queueMetrics.workerState === 'READY' || queueMetrics.workerState === 'STARTING') &&
                      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  )}
                  title={
                    queueMetrics.nativeTelemetry
                      ? `Whisper Worker [${queueMetrics.workerState}] | Restarts: ${queueMetrics.nativeTelemetry.restartCount} | Timeouts: ${queueMetrics.nativeTelemetry.timeoutCount} | Crashes: ${queueMetrics.nativeTelemetry.crashCount} | Avg Latency: ${queueMetrics.nativeTelemetry.processLatency}ms`
                      : `Whisper Worker: ${queueMetrics.workerState}`
                  }
                >
                  {queueMetrics.workerState === 'RESTARTING' && (
                    <>
                      <RotateCcw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                      <span>STT Restarting...</span>
                    </>
                  )}
                  {queueMetrics.workerState === 'FAILED' && (
                    <>
                      <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                      <span>STT Failed</span>
                    </>
                  )}
                  {queueMetrics.workerState === 'BUSY' && (
                    <>
                      <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                      <span>STT Busy</span>
                    </>
                  )}
                  {queueMetrics.workerState === 'READY' && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>STT Ready</span>
                    </>
                  )}
                  {queueMetrics.workerState === 'STARTING' && (
                    <>
                      <Loader2 className="w-2.5 h-2.5 text-emerald-400 animate-spin" />
                      <span>STT Starting</span>
                    </>
                  )}
                </Badge>
              )}

              {queueMetrics && queueMetrics.queueDepth > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-2 py-0.5 h-6 bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono flex items-center gap-1 animate-pulse"
                  title={`STT Queue: ${queueMetrics.queueDepth} job chờ | Workers: ${queueMetrics.processingJobs}/${queueMetrics.concurrency} | Chờ TB: ${queueMetrics.averageWaitTime}ms | Bỏ qua: ${queueMetrics.droppedJobs}`}
                >
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                  <span>STT Queue: {queueMetrics.queueDepth}</span>
                </Badge>
              )}

              {queueMetrics && queueMetrics.provider !== 'Local' && queueMetrics.processingJobs > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-2 py-0.5 h-6 bg-blue-500/15 text-blue-300 border-blue-500/30 font-mono flex items-center gap-1"
                  title={`Worker đang xử lý trên ${queueMetrics.provider} Whisper (${queueMetrics.processingJobs}/${queueMetrics.concurrency})`}
                >
                  <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                  <span>Worker: {queueMetrics.processingJobs}/{queueMetrics.concurrency}</span>
                </Badge>
              )}

              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0.5 h-6 border font-mono flex items-center gap-1 transition-colors shrink-0',
                  isCapturing || isSimulatingSTT
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/5 text-white/40 border-white/10'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    isCapturing || isSimulatingSTT
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-white/30'
                  )}
                />
                <span>
                  {isCapturing ? `Live (~${currentSTTEngine.latencyMs || 140}ms)` : 'Chờ bật'}
                </span>
              </Badge>
            </div>
          </div>

          {/* Row 2: Controls Toolbar */}
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {/* Interactive STT Engine Selector */}
            <div ref={sttMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsSTTMenuOpen(!isSTTMenuOpen)}
                className="h-6 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-md text-[10px] text-emerald-300 font-medium flex items-center gap-1 transition-all"
                title="Chọn mô hình STT đang sử dụng"
              >
                <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="max-w-[130px] truncate">
                  {currentSTTEngine.name.split(' (')[0]}
                </span>
                <ChevronDown
                  className={cn(
                    'w-2.5 h-2.5 text-emerald-400 shrink-0 transition-transform duration-200',
                    isSTTMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {isSTTMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[240px] space-y-0.5 animate-fade-in">
                  <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider">
                    Mô hình STT nhận diện:
                  </div>
                  {availableSTTEngines.map((eng) => {
                    const isSelected = eng.id === selectedSTT
                    return (
                      <div
                        key={eng.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectSTTEngine(eng.id)
                          setIsSTTMenuOpen(false)
                        }}
                        className={cn(
                          'px-2 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[10.5px]',
                          isSelected
                            ? 'bg-emerald-600/20 text-white border border-emerald-500/30'
                            : 'hover:bg-white/[0.06] text-white/75'
                        )}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-medium text-white/95 leading-tight truncate">
                            {eng.name.split(' (')[0]}
                          </div>
                          <div className="text-[9px] text-white/40 font-mono truncate">
                            {eng.badge}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Interactive Language Selector Dropdown */}
            <div ref={langMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="h-6 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-md text-[10px] text-emerald-300 font-medium flex items-center gap-1 transition-all"
                title="Chọn ngôn ngữ âm thanh đầu vào"
              >
                <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="max-w-[120px] truncate">
                  {STT_LANG_OPTIONS.find((l) => l.id === sttLang)?.name || 'Tự động (Auto)'}
                </span>
                <ChevronDown
                  className={cn(
                    'w-2.5 h-2.5 text-emerald-400 shrink-0 transition-transform duration-200',
                    isLangMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[230px] space-y-0.5 animate-fade-in">
                  <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider">
                    Ngôn ngữ âm thanh:
                  </div>
                  {STT_LANG_OPTIONS.map((langOpt) => {
                    const isSelected = langOpt.id === sttLang
                    return (
                      <div
                        key={langOpt.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectSTTLang(langOpt.id)
                          setIsLangMenuOpen(false)
                        }}
                        className={cn(
                          'px-2 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[10.5px]',
                          isSelected
                            ? 'bg-emerald-600/20 text-white border border-emerald-500/30'
                            : 'hover:bg-white/[0.06] text-white/75'
                        )}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-medium text-white/95 leading-tight truncate">
                            {langOpt.name}
                          </div>
                          <div className="text-[9px] text-white/40 font-mono truncate">
                            {langOpt.desc}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Simulate Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={onSimulateSTT}
              className="h-6 text-[10px] px-2 gap-1 bg-white/5 text-violet-300 border-violet-500/30 hover:bg-violet-500/20 transition-all font-medium"
              title="Chạy mô phỏng lời nói mẫu để xem phụ đề"
            >
              <Play className="w-2.5 h-2.5 fill-violet-300" />
              <span>Mẫu YouTube</span>
            </Button>

            {sttLines.length > 0 && (
              <button
                type="button"
                onClick={onClearSTT}
                className="text-[10px] text-white/40 hover:text-rose-300 flex items-center gap-0.5 px-1.5 py-1 rounded transition-colors"
                title="Xóa danh sách nhận diện"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa</span>
              </button>
            )}
          </div>
        </div>

        {/* Subtitles Stream Container */}
        <div
          ref={scrollRef}
          className="overflow-y-auto bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-3 custom-scrollbar min-h-[360px] max-h-[520px]"
        >
          {sttLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-white/40 space-y-2.5">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isCapturing
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                    : 'bg-white/5 text-white/40 border border-white/10'
                )}
              >
                <Radio className="w-5 h-5" />
              </div>
              <div className="text-[12px] font-medium text-white/80">
                {isCapturing ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Đang nhận âm thanh & tự động chuyển thành văn bản...
                  </span>
                ) : (
                  <>
                    Đang kết nối: <span className="text-emerald-400 font-semibold">{currentSTTEngine.name}</span>
                  </>
                )}
              </div>
              <p className="text-[10.5px] max-w-sm text-white/40 leading-relaxed">
                {isCapturing
                  ? `Đang lắng nghe qua ${currentSTTEngine.id}. Hãy phát video YouTube (tiếng Anh) hoặc nói vào Micro, phụ đề sẽ tự động hiển thị ngay bên dưới.`
                  : `Bấm nút "Start Capture" ở trên để bắt đầu thu âm và chuyển trực tiếp âm thanh thành văn bản thời gian thực.`}
              </p>
            </div>
          ) : (
            sttLines.map((line, idx) => (
              <div
                key={line.id}
                className={cn(
                  'animate-fade-in transition-opacity border-b border-white/[0.05] pb-2.5 last:border-b-0 last:pb-0',
                  idx === sttLines.length - 1 ? 'opacity-100' : 'opacity-75'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {line.speaker}
                    </span>
                    <span className="text-white/20">&bull;</span>
                    <span className="text-[10px] text-white/35 font-mono">{line.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 h-4 bg-violet-500/10 text-violet-300 border-violet-500/25"
                    >
                      {line.engineBadge || currentSTTEngine.id}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="px-1 py-0 h-4 bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                    >
                      Độ chuẩn: {line.confidence}%
                    </Badge>
                    <span className="text-white/40">{line.latencyMs}ms</span>
                  </div>
                </div>

                {/* English original: Gray 60% */}
                <p className="text-[11.5px] leading-relaxed text-white/60 font-normal mb-0.5">
                  {line.originalEn}
                </p>

                {/* Vietnamese instant translation: Bright Bold White */}
                <p className="text-[12.5px] leading-relaxed text-white font-medium tracking-normal">
                  {line.translatedVi}
                </p>
              </div>
            ))
          )}

          {/* Typing pulse indicator */}
          {(isCapturing || isSimulatingSTT || isTranscribing) && (
            <div className="flex items-center gap-1.5 pt-1 text-[10px] text-emerald-400/80 italic">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {isTranscribing
                  ? `Đang giải mã giọng nói qua ${currentSTTEngine.id}...`
                  : 'Đang thu nhận & giải mã luồng âm thanh PCM 16kHz...'}
              </span>
            </div>
          )}
        </div>

        {/* STT Status Footnote */}
        <div className="flex items-center justify-between text-[10px] text-white/40 pt-0.5">
          <div className="flex items-center gap-1.5 font-mono truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">
              Engine đang chạy: <strong className="text-emerald-300">{currentSTTEngine.id}</strong> ({currentSTTEngine.badge})
            </span>
          </div>
          <span className="font-mono text-white/50 shrink-0 ml-2">
            Đã nhận diện: {sttLines.length} câu
          </span>
        </div>
      </div>
    </div>
  )
}
