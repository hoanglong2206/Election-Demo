import { cn } from '@/lib/utils'

interface MeetingFooterProps {
  modelName: string
  sttEngineLabel: string
  isCapturing: boolean
  isListening: boolean
  transcriptCount: number
}

export function MeetingFooter({
  modelName,
  sttEngineLabel,
  isCapturing,
  isListening,
  transcriptCount,
}: MeetingFooterProps) {
  return (
    <footer className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.05] shrink-0 bg-black/20">
      <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
        <span>AI Meeting Copilot</span>
        <span>&bull;</span>
        <span>LLM: {modelName}</span>
        <span>&bull;</span>
        <span>STT: {sttEngineLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isCapturing && isListening ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'
          )}
        />
        <span className="text-[10px] text-white/30 font-mono">
          {transcriptCount} câu đã nhận diện
        </span>
      </div>
    </footer>
  )
}
