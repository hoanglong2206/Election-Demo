import { Activity, Volume2, Mic, Bot, ArrowRight, AlertCircle, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppMode } from '../../../types/electron.d'

interface SystemQuickStatusCardProps {
  className?: string
  currentAudioDeviceLabel: string
  currentSTTLabel: string
  isSTTLocal: boolean
  currentLLMLabel: string
  hasLLMKey: boolean
  livePing: number
  liveSTTLatency?: number
  totalTokensMonth: number
  estimatedCostMonth: number
  totalSessionsCount: number
  mode?: AppMode
  canEnterMeeting?: boolean
  meetingError?: string | null
  onLaunchMeeting?: () => void
  onClearMeetingError?: () => void
  onViewChange?: (view: any) => void
}

export function SystemQuickStatusCard({
  className,
  currentAudioDeviceLabel,
  currentSTTLabel,
  isSTTLocal,
  currentLLMLabel,
  hasLLMKey,
  livePing,
  liveSTTLatency,
  totalTokensMonth,
  estimatedCostMonth,
  totalSessionsCount,
  mode,
  canEnterMeeting = true,
  meetingError,
  onLaunchMeeting,
  onClearMeetingError,
  onViewChange,
}: SystemQuickStatusCardProps) {
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return `${tokens}`
  }

  const formatAudioDeviceName = (name: string) => {
    if (!name) return 'Loopback Output'
    const cleaned = name.replace(/\s*\([^(]*?(?:âm thanh|loa|máy|loopback|audio|device|output|input).*?\)/gi, '').trim()
    return cleaned || name
  }

  return (
    <Card className={cn('bg-white/[0.03] border-white/[0.07] shadow-none p-2.5 flex flex-col justify-between gap-2', className)}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.05] gap-2">
        <div className="flex items-center gap-1.5 min-w-0 shrink-0" title="Cấu hình hệ thống hoạt động đồng bộ từ trang Cài đặt">
          <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11.5px] font-semibold text-white/90 whitespace-nowrap">
            Trạng Thái Hệ Thống
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="text-[8.5px] px-1.5 py-0 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/25 flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sẵn sàng</span>
          </Badge>

          {onLaunchMeeting && (
            <Button
              id="btn-goto-meeting"
              size="sm"
              onClick={onLaunchMeeting}
              className={cn(
                'text-[11px] h-6 rounded-lg px-2.5 gap-1 shadow-sm font-medium shrink-0 transition-all text-white whitespace-nowrap',
                mode === 'interview'
                  ? 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.35)]'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              )}
              title={
                mode === 'interview' && !canEnterMeeting
                  ? 'Chế độ Phỏng Vấn yêu cầu có cả CV và JD trước khi vào phòng họp'
                  : 'Bắt đầu cuộc họp'
              }
            >
              <span>Vào Meeting Mode</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </Button>
          )}
        </div>
      </div>

      {meetingError && (
        <div className="bg-rose-500/15 border border-rose-500/30 rounded-lg p-1.5 px-2 flex items-center justify-between text-rose-300 text-[10px] animate-fade-in shadow-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{meetingError}</span>
          </div>
          {onClearMeetingError && (
            <button
              type="button"
              onClick={onClearMeetingError}
              className="text-rose-400 hover:text-rose-200 ml-1.5 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 3 Core Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* 1. Audio */}
        <div className="p-1.5 py-1.5 rounded-lg bg-black/30 border border-white/[0.05] flex flex-col justify-between gap-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 flex items-center gap-1 whitespace-nowrap">
              <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
              Âm thanh
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          </div>
          <span className="text-[10px] font-medium text-white/90 truncate block" title={currentAudioDeviceLabel}>
            {formatAudioDeviceName(currentAudioDeviceLabel)}
          </span>
          <span className="text-[8.5px] font-mono text-emerald-400/80 whitespace-nowrap">Sẵn sàng thu</span>
        </div>

        {/* 2. STT */}
        <div className="p-1.5 py-1.5 rounded-lg bg-black/30 border border-white/[0.05] flex flex-col justify-between gap-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 flex items-center gap-1 whitespace-nowrap">
              <Mic className="w-3 h-3 text-cyan-400 shrink-0" />
              STT Bóc băng
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
          </div>
          <span className="text-[10px] font-medium text-white/90 truncate block" title={currentSTTLabel}>
            {currentSTTLabel}
          </span>
          <span className="text-[8.5px] font-mono text-cyan-300/80 whitespace-nowrap">
            {isSTTLocal
              ? liveSTTLatency ? `Offline ~${liveSTTLatency}ms` : 'Offline 100%'
              : liveSTTLatency ? `Ping ~${liveSTTLatency}ms` : 'Cloud Whisper'}
          </span>
        </div>

        {/* 3. LLM Copilot */}
        <div className="p-1.5 py-1.5 rounded-lg bg-black/30 border border-white/[0.05] flex flex-col justify-between gap-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 flex items-center gap-1 whitespace-nowrap">
              <Bot className="w-3 h-3 text-violet-400 shrink-0" />
              AI Copilot
            </span>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', hasLLMKey ? 'bg-emerald-400' : 'bg-amber-400')} />
          </div>
          <span className="text-[10px] font-medium text-white/90 truncate block" title={currentLLMLabel}>
            {currentLLMLabel}
          </span>
          <span className="text-[8.5px] font-mono text-violet-300/80 whitespace-nowrap">
            {hasLLMKey ? `Ping ${livePing}ms` : 'Chưa có key'}
          </span>
        </div>
      </div>

      {/* Bottom Mini Metrics Strip */}
      <div className="pt-1.5 border-t border-white/[0.04] flex items-center justify-between text-[9.5px] text-white/50 px-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onViewChange?.('cost-tracker')}
          title="Bấm để xem chi tiết chi phí & token API"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 hover:bg-white/[0.06] hover:text-white px-1.5 py-0.5 -mx-1.5 rounded transition-all cursor-pointer group text-left"
        >
          <span className="whitespace-nowrap">
            Tokens: <strong className="text-cyan-300 font-mono font-semibold group-hover:text-cyan-200">{formatTokens(totalTokensMonth)}</strong>
          </span>
          <span className="whitespace-nowrap">
            Chi phí: <strong className="text-emerald-400 font-mono font-semibold group-hover:text-emerald-300">${estimatedCostMonth.toFixed(4)}</strong>
          </span>
          <ArrowRight className="w-2.5 h-2.5 text-white/30 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange?.('history')}
          title="Bấm để xem lịch sử phiên họp"
          className="text-white/40 font-mono text-[9px] whitespace-nowrap shrink-0 hover:text-white hover:bg-white/[0.06] px-1.5 py-0.5 -mx-1.5 rounded transition-all cursor-pointer"
        >
          Lịch sử: <strong className="text-white/80">{totalSessionsCount}</strong> phiên
        </button>
      </div>
    </Card>
  )
}
