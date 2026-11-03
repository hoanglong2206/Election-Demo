import React from 'react'
import {
  Sparkles,
  RotateCcw,
  AlertCircle,
  Loader2,
  Clock,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { STTQueueMetrics } from '@/services/ai-model/stt'

export interface TranscriptSubToolbarProps {
  sttEngineLabel: string
  queueMetrics?: STTQueueMetrics
  hasLines: boolean
  onClearTranscript: () => void
}

export const TranscriptSubToolbar = React.memo(function TranscriptSubToolbar({
  sttEngineLabel,
  queueMetrics,
  hasLines,
  onClearTranscript,
}: TranscriptSubToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-1.5 px-3 py-1 shrink-0 border-b border-white/[0.02] flex-wrap min-w-0">
      <div className="flex items-center justify-between flex-1 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[9.5px] px-1.5 py-0 h-5 bg-violet-500/10 text-violet-300 border-violet-500/20 font-mono flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5 text-violet-400" />
            <span>STT: {sttEngineLabel}</span>
          </Badge>

          {/* Native Worker Abstract State Indicator */}
          {queueMetrics?.provider === 'Local' && queueMetrics.workerState && (
            <Badge
              variant="outline"
              className={cn(
                'text-[9.5px] px-1.5 py-0 h-5 font-mono flex items-center gap-1 transition-all',
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
              className="text-[9.5px] px-1.5 py-0 h-5 bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono flex items-center gap-1 animate-pulse"
              title={`Đang chờ xử lý trong hàng đợi STT | Giới hạn concurrency: ${queueMetrics.concurrency} | Chờ TB: ${queueMetrics.averageWaitTime}ms | Bỏ qua: ${queueMetrics.droppedJobs}`}
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>STT Queue: {queueMetrics.queueDepth} {queueMetrics.queueDepth === 1 ? 'job' : 'jobs'}</span>
            </Badge>
          )}

          {queueMetrics && queueMetrics.provider !== 'Local' && queueMetrics.processingJobs > 0 && (
            <Badge
              variant="outline"
              className="text-[9.5px] px-1.5 py-0 h-5 bg-blue-500/15 text-blue-300 border-blue-500/30 font-mono flex items-center gap-1"
              title={`Worker đang chạy song song trên ${queueMetrics.provider} Whisper (${queueMetrics.processingJobs}/${queueMetrics.concurrency})`}
            >
              <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
              <span>Worker: {queueMetrics.processingJobs}/{queueMetrics.concurrency}</span>
            </Badge>
          )}
        </div>

        {hasLines && (
          <button
            type="button"
            onClick={onClearTranscript}
            className="text-[10px] text-white/35 hover:text-rose-300 transition-colors flex items-center gap-1 px-1 py-0.5 rounded shrink-0 cursor-pointer"
            title="Xóa toàn bộ transcript đã nhận diện"
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span>Xóa</span>
          </button>
        )}
      </div>
    </div>
  )
})
