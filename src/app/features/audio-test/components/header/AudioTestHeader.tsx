import { Headphones, AlertCircle, X, Mic } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AudioEngineType } from '@/core/audio/types'

export interface AudioTestHeaderProps {
  showTip: boolean
  setShowTip: (show: boolean) => void
  engineType?: AudioEngineType
  sourceType?: 'mic' | 'system'
  activeDeviceName?: string
}

export function AudioTestHeader({
  showTip,
  setShowTip,
  engineType,
  sourceType,
  activeDeviceName,
}: AudioTestHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 bg-emerald-500/15 border-emerald-500/25">
            <Headphones className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold text-white/95 leading-tight truncate">
              Kiểm Tra Thu Âm Hệ Thống & Live STT (Audio Diagnostic)
            </h2>

            <p className="text-[10.5px] text-white/40 leading-tight mt-0.5 truncate">
              Kiểm tra âm thanh loopback YouTube/Calls, cân chỉnh độ nhạy micro VAD và nhận diện giọng nói Whisper
            </p>
          </div>
        </div>

        {/* Right side status badges: Active Mic & AudioWorklet Engine */}
        <div className="flex items-center gap-2 shrink-0">
          {sourceType === 'mic' && activeDeviceName && (
            <Badge
              variant="outline"
              className="text-[10px] h-6 px-2.5 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hidden sm:inline-flex items-center gap-1.5 max-w-[220px]"
              title={`Microphone đang dùng: ${activeDeviceName}`}
            >
              <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{activeDeviceName.split(' (')[0].trim()}</span>
            </Badge>
          )}

          {engineType && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] h-6 px-2.5 border font-mono flex items-center gap-1.5',
                engineType === 'audio_worklet'
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  engineType === 'audio_worklet' ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'
                )}
              />
              <span>{engineType === 'audio_worklet' ? '⚡ AudioWorklet' : 'ScriptProcessor'}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Tip Banner */}
      {showTip && (
        <div className="border rounded-xl p-2.5 px-3 flex items-start justify-between gap-3 shadow-inner bg-emerald-950/25 border-emerald-500/25">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-emerald-200/90">
              <strong className="text-emerald-300 font-semibold">
                Hướng dẫn thu âm YouTube:
              </strong>{' '}
              Chọn <code className="bg-emerald-500/20 px-1 py-0.5 rounded text-[10px]">System Audio</code>, bấm{' '}
              <strong className="text-white">Start Capture</strong>, chọn tab Chrome đang mở video YouTube và nhớ tích chọn{' '}
              <strong className="text-emerald-300 underline underline-offset-2">
                &quot;Also share system audio&quot;
              </strong>.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTip(false)}
            className="transition-colors shrink-0 p-0.5 text-emerald-400/60 hover:text-emerald-300"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
