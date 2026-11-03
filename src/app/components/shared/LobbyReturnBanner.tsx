import { ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface LobbyReturnBannerProps {
  onReturnToLobby: () => void
  onDismiss?: () => void
  readinessScore?: number
}

export function LobbyReturnBanner({
  onReturnToLobby,
  onDismiss,
  readinessScore,
}: LobbyReturnBannerProps) {
  return (
    <div
      role="region"
      aria-label="Lobby Return Navigation Banner"
      className="w-full bg-gradient-to-r from-violet-950/80 via-[#0c101d]/90 to-emerald-950/80 border-b border-violet-500/30 backdrop-blur-md px-3.5 py-2 flex items-center justify-between gap-3 shadow-lg select-none animate-slide-down shrink-0 z-20"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white/95">
            Đang hiệu chuẩn thực chiến từ Sảnh Chờ
          </span>
          <span className="text-[11px] text-white/50 hidden md:inline">
            — Hoàn tất cấu hình rồi bấm quay lại để tiếp tục tiến trình vào phòng họp
          </span>
          {typeof readinessScore === 'number' && (
            <Badge
              variant="outline"
              className="text-[9.5px] px-1.5 py-0 border font-mono bg-violet-500/20 text-violet-300 border-violet-500/40"
            >
              Sẵn sàng: {readinessScore}%
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          onClick={onReturnToLobby}
          className="h-7 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>✓ Hoàn tất & Quay lại Sảnh chờ</span>
        </Button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng thanh điều hướng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
