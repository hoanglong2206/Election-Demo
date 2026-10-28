import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, Cpu, Layers, LoaderCircle, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AudioChunkMeta, AudioSourceType } from '@/core/audio/types'
import type { STTQueueMetrics } from '@/services/ai-model/stt'
import type { PipelineStage } from '../../types'
import { computePipelineOverview } from '../../utils/pipelineStagesHelper'

export interface PipelineStagesCardProps {
  pipelineStages: PipelineStage[]
  bufferDurationSec: number
  bufferSizeBytes: number
  chunks: AudioChunkMeta[]
  queueMetrics: STTQueueMetrics
  isCapturing: boolean
  isStarting: boolean
  sourceType: AudioSourceType
  isAudioDetected: boolean
  captureError: string | null
  inputSampleRateHz: number | null
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Đang chờ',
  processing: 'Đang xử lý',
  active: 'Hoạt động',
  ready: 'Sẵn sàng',
  error: 'Có lỗi',
}

export function PipelineStagesCard(props: PipelineStagesCardProps) {
  const {
    pipelineStages,
    bufferDurationSec,
    bufferSizeBytes,
    chunks,
    queueMetrics,
    isCapturing,
    isStarting,
    sourceType,
    isAudioDetected,
    captureError,
    inputSampleRateHz,
  } = props

  const overview = useMemo(() => {
    return computePipelineOverview({
      pipelineStages,
      bufferDurationSec,
      bufferSizeBytes,
      chunks,
      queueMetrics,
      isCapturing,
      isStarting,
      sourceType,
      isAudioDetected,
      captureError,
      inputSampleRateHz,
    })
  }, [
    pipelineStages,
    bufferDurationSec,
    bufferSizeBytes,
    chunks,
    queueMetrics,
    isCapturing,
    isStarting,
    sourceType,
    isAudioDetected,
    captureError,
    inputSampleRateHz,
  ])

  const totalChunksCreated = chunks[0]?.index ?? 0
  const processing = queueMetrics.processingJobs
  const succeeded = queueMetrics.succeededJobs ?? 0
  const sent = queueMetrics.enqueuedJobs ?? succeeded + queueMetrics.queueDepth + processing
  const isWorkerFailed = queueMetrics.provider === 'Local' && queueMetrics.workerState === 'FAILED'
  const sttFailed = Boolean(queueMetrics.lastResult && !queueMetrics.lastResult.success)

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
        <div className="text-[12px] text-white/80 flex items-center gap-1.5 uppercase tracking-wider font-semibold">
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span>Pipeline (6 Bước)</span>
        </div>
        <span className="text-[9.5px] text-white/45 font-mono">Đầu ra STT: 16kHz · Mono · 16-bit PCM</span>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-black/20 p-2.5">
        {captureError || isWorkerFailed || sttFailed ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
        ) : succeeded > 0 ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        ) : isCapturing ? (
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        ) : (
          <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white/90">{overview.overallLabel}</div>
          <div className="mt-1 text-[9.5px] leading-relaxed text-white/50">
            {sourceType === 'system' ? 'System audio' : 'Micro'}
            {' · '}{inputSampleRateHz ? `${inputSampleRateHz.toLocaleString()} Hz đầu vào` : 'Chưa mở audio context'}
            {' · '}16,000 Hz đầu ra
            {queueMetrics.isPaused && sent > 0 ? ' · STT queue đang tạm dừng' : ''}
          </div>
          {overview.advice && (
            <div className={cn(
              'mt-2 rounded-md border px-2 py-1.5 text-[9.5px] leading-relaxed',
              overview.adviceTone === 'error'
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-200/90'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-100/90'
            )}>
              <span className="font-semibold">Gợi ý: </span>{overview.advice}
            </div>
          )}
        </div>
        {(isStarting || processing > 0) && <LoaderCircle className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-violet-300" />}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {overview.stages.map((stage) => {
          const status = stage.status
          const isError = status === 'error'
          const isBusy = status === 'active' || status === 'processing'
          const isReady = status === 'ready'
          return (
            <div key={stage.stage} className={cn(
              'min-w-0 rounded-lg border p-2 transition-colors',
              isError ? 'border-rose-500/30 bg-rose-500/[0.06]' : isBusy ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : isReady ? 'border-violet-500/20 bg-violet-500/[0.04]' : 'border-white/[0.06] bg-white/[0.015]'
            )}>
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold font-mono', isError ? 'bg-rose-500 text-white' : isBusy ? 'bg-emerald-500 text-white' : isReady ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/40')}>
                    {stage.stage}
                  </span>
                  <span className="truncate text-[10px] font-medium text-white/85">{stage.name}</span>
                </div>
                <Badge variant="outline" className={cn('shrink-0 whitespace-nowrap px-1 py-0 text-[8px] font-mono', isError ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : isBusy ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : isReady ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-white/10 bg-white/5 text-white/40')}>
                  {STATUS_LABEL[status] || status}
                </Badge>
              </div>
              <div className="mt-1 truncate text-[9.5px] text-white/65" title={stage.detail}>{stage.detail}</div>
              {stage.subDetail && <div className="mt-0.5 truncate text-[9px] text-white/40" title={stage.subDetail}>{stage.subDetail}</div>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        <div className="flex flex-col rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
          <span className="text-[9px] uppercase text-white/40">Audio trong buffer</span>
          <span className="text-[11px] font-mono font-medium text-white/90">{bufferDurationSec.toFixed(1)}s</span>
        </div>
        <div className="flex flex-col rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
          <span className="text-[9px] uppercase text-white/40">Buffer RAM</span>
          <span className="text-[11px] font-mono font-medium text-white/90">{(bufferSizeBytes / 1024).toFixed(1)} KB</span>
        </div>
        <div className="flex flex-col rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
          <span className="text-[9px] uppercase text-white/40">Chunk đã tạo</span>
          <span className="text-[11px] font-mono font-medium text-violet-300">{totalChunksCreated}</span>
        </div>
      </div>

      {chunks.length > 0 && (
        <div className="space-y-1 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[9.5px] font-medium text-white/55">
              <Cpu className="h-3 w-3 text-emerald-400" /> Chunk PCM gần nhất
            </span>
            <span className="text-[9px] font-mono text-white/35">Int16 PCM</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chunks.slice(0, 4).map((chunk) => (
              <Badge key={chunk.id} variant="outline" className="border-white/10 bg-black/40 px-1.5 py-0 text-[9px] font-mono text-white/70">
                #{chunk.index} · {chunk.durationSec.toFixed(1)}s · {chunk.rmsDb} dBFS
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
