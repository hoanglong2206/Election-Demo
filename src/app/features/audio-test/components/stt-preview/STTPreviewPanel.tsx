import type { RefObject } from 'react'
import { Sparkles, Clock, Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { STTLang, STTPreviewLine } from '../../types'
import type { STTEngineConfig } from '@/services/ai-model/aiModels'
import type { STTQueueMetrics } from '@/services/ai-model/stt'
import { STTEngineControls } from './STTEngineControls'
import { STTSubtitlesStream } from './STTSubtitlesStream'

export interface STTPreviewPanelProps {
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
                    isCapturing || isSimulatingSTT ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'
                  )}
                />
                <span>
                  {isCapturing ? `Live (~${currentSTTEngine.latencyMs || 140}ms)` : 'Chờ bật'}
                </span>
              </Badge>
            </div>
          </div>

          {/* Row 2: Controls Toolbar */}
          <STTEngineControls
            currentSTTEngine={currentSTTEngine}
            availableSTTEngines={availableSTTEngines}
            selectedSTT={selectedSTT}
            onSelectSTTEngine={onSelectSTTEngine}
            sttLang={sttLang}
            onSelectSTTLang={onSelectSTTLang}
            sttLinesCount={sttLines.length}
            onSimulateSTT={onSimulateSTT}
            onClearSTT={onClearSTT}
          />
        </div>

        {/* Subtitles Stream Container */}
        <STTSubtitlesStream
          scrollRef={scrollRef}
          sttLines={sttLines}
          isCapturing={isCapturing}
          isSimulatingSTT={isSimulatingSTT}
          isTranscribing={isTranscribing}
          currentSTTEngine={currentSTTEngine}
        />

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
