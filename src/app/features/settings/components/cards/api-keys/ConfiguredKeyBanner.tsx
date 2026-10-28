import { ShieldCheck, Edit3, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfiguredKeyBannerProps {
  maskedKey?: string
  isVerifying: boolean
  onVerify: () => void
  onEdit: () => void
  onDeleteRequest: () => void
}

export function ConfiguredKeyBanner({
  maskedKey,
  isVerifying,
  onVerify,
  onEdit,
  onDeleteRequest,
}: ConfiguredKeyBannerProps) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-black/60 rounded-lg border border-white/[0.08]">
      <div className="flex items-center gap-2 font-mono text-[11.5px] text-white/90 min-w-0">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="bg-white/5 px-2 py-0.5 rounded text-emerald-300 font-semibold tracking-wider shrink-0">
          {maskedKey}
        </span>
        <span className="text-[9.5px] text-white/40 font-sans truncate hidden sm:inline">
          (Mã hóa an toàn trong OS Credential Manager)
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onVerify}
          disabled={isVerifying}
          className="h-7 text-[10.5px] px-2.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
        >
          Kiểm tra
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="h-7 text-[10.5px] px-2 bg-white/5 border-white/10 text-white/70 hover:text-white"
          title="Thay đổi khóa API mới"
        >
          <Edit3 className="w-3 h-3 mr-1" />
          Đổi
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDeleteRequest}
          className="h-7 text-[10.5px] px-2 bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20"
          title="Thu hồi và xóa khóa khỏi hệ điều hành"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Thu hồi
        </Button>
      </div>
    </div>
  )
}

