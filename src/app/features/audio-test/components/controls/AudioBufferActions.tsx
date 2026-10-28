import {
  Play,
  Square,
  Volume2,
  VolumeX,
  Download,
  RotateCcw,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface AudioBufferActionsProps {
  isCapturing: boolean
  isStarting?: boolean
  startCapture: () => Promise<void> | void
  stopCapture: () => void
  isPlaying: boolean
  playBuffer: () => void
  stopPlayback: () => void
  hasBuffer: boolean
  bufferDurationSec: number
  downloadWav: () => void
  clearBuffer: () => void
  onOpenCalibration?: () => void
  calibratedDb?: number | null
  onEnterMeeting?: () => void
}

export function AudioBufferActions({
  isCapturing,
  isStarting = false,
  startCapture,
  stopCapture,
  isPlaying,
  playBuffer,
  stopPlayback,
  hasBuffer,
  bufferDurationSec,
  downloadWav,
  clearBuffer,
  onOpenCalibration,
  calibratedDb,
  onEnterMeeting,
}: AudioBufferActionsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Main Record CTA Button with fixed width to eliminate layout shift */}
      {!isCapturing ? (
        <Button
          id="btn-start-capture"
          onClick={() => {
            const res = startCapture()
            if (res && typeof (res as Promise<void>).catch === 'function') {
              ;(res as Promise<void>).catch(() => {})
            }
          }}
          disabled={isStarting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11.5px] h-8 w-[122px] justify-center gap-1.5 shadow-sm font-semibold transition-all disabled:opacity-50 shrink-0"
        >
          {isStarting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span>{isStarting ? 'Đang mở...' : 'Start Capture'}</span>
        </Button>
      ) : (
        <Button
          id="btn-stop-capture"
          onClick={stopCapture}
          variant="destructive"
          className="bg-rose-600 hover:bg-rose-500 text-white text-[11.5px] h-8 w-[122px] justify-center gap-1.5 shadow-sm font-semibold transition-all animate-pulse shrink-0"
        >
          <Square className="w-3.5 h-3.5 fill-white" />
          <span>Stop Capture</span>
        </Button>
      )}

      {/* Auto Calibrate VAD Button */}
      {onOpenCalibration && (
        <Button
          id="btn-auto-calibrate-vad"
          type="button"
          onClick={onOpenCalibration}
          variant="outline"
          size="sm"
          title="Đo độ ồn nền & tự động hiệu chuẩn ngưỡng VAD"
          className="h-8 px-2.5 text-[11px] border-violet-500/40 text-violet-300 hover:bg-violet-500/15 gap-1.5 transition-all shadow-sm bg-violet-500/5 font-medium shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Auto Calibrate</span>
          {calibratedDb != null && (
            <span className="text-[10px] bg-violet-500/25 px-1.5 py-0.5 rounded font-mono text-violet-200 border border-violet-500/30">
              {calibratedDb}dB
            </span>
          )}
        </Button>
      )}

      {/* Fixed-layout Playback & Buffer Tools (Zero Width Jump) */}
      <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
        {isPlaying ? (
          <Button
            onClick={stopPlayback}
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] text-amber-300 hover:bg-amber-500/15 gap-1 shrink-0"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Dừng</span>
          </Button>
        ) : (
          <Button
            id="btn-play-buffer"
            onClick={playBuffer}
            disabled={!hasBuffer}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-[11px] gap-1 transition-all shrink-0',
              hasBuffer ? 'text-white/90 hover:bg-white/10' : 'text-white/30 cursor-not-allowed'
            )}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Nghe ({bufferDurationSec ? `${bufferDurationSec}s` : '0s'})</span>
          </Button>
        )}

        <Button
          onClick={downloadWav}
          disabled={!hasBuffer}
          variant="ghost"
          size="icon"
          title="Tải file WAV 16kHz"
          className={cn(
            'w-7 h-7 rounded text-white/60 hover:text-white',
            !hasBuffer && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-white/60'
          )}
        >
          <Download className="w-3 h-3" />
        </Button>

        <Button
          onClick={clearBuffer}
          disabled={!hasBuffer}
          variant="ghost"
          size="icon"
          title="Xóa bộ đệm âm thanh"
          className={cn(
            'w-7 h-7 rounded text-white/40 hover:text-rose-400',
            !hasBuffer && 'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-white/40'
          )}
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>

      {/* Enter Meeting Button */}
      {onEnterMeeting && (
        <Button
          id="btn-enter-meeting"
          type="button"
          onClick={onEnterMeeting}
          className="bg-violet-600 hover:bg-violet-500 text-white text-[11.5px] h-8 px-3 gap-1.5 shadow-sm font-medium transition-all shrink-0"
          title="Bắt đầu phiên họp với microphone và ngưỡng VAD đã hiệu chuẩn"
        >
          <span>Vào phòng họp</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}
