import { useEffect, type RefObject } from 'react'
import { Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { STTPreviewLine } from '../../types'
import type { STTEngineConfig } from '@/services/ai-model/aiModels'

export interface STTSubtitlesStreamProps {
  scrollRef: RefObject<HTMLDivElement | null>
  sttLines: STTPreviewLine[]
  isCapturing: boolean
  isSimulatingSTT: boolean
  isTranscribing: boolean
  currentSTTEngine: STTEngineConfig
}

export function STTSubtitlesStream({
  scrollRef,
  sttLines,
  isCapturing,
  isSimulatingSTT,
  isTranscribing,
  currentSTTEngine,
}: STTSubtitlesStreamProps) {
  // Auto scroll STT container when lines change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [sttLines, scrollRef])

  return (
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
  )
}
