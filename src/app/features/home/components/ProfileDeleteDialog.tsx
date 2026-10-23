import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProfilePreset } from '../../../services/profile-preset'

interface ProfileDeleteDialogProps {
  open: boolean
  preset: ProfilePreset | null
  isActive: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ProfileDeleteDialog({
  open,
  preset,
  isActive,
  onClose,
  onConfirm,
}: ProfileDeleteDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !preset) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative z-10 w-full max-w-md flex flex-col rounded-2xl border shadow-2xl p-5',
          'bg-gradient-to-br from-[#180f14]/95 via-[#12090e]/95 to-[#0a0508]/95',
          'border-rose-500/30 backdrop-blur-xl text-white'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pb-3 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="text-[13px] font-semibold text-rose-300">
              Xác nhận xóa Profile Phỏng Vấn
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-[11px] text-white/70 space-y-2.5 leading-relaxed">
          <p>
            Bạn có chắc chắn muốn xóa bộ hồ sơ phỏng vấn này không?
          </p>
          <div className="p-3 rounded-lg bg-black/40 border border-white/10">
            <span className="font-semibold text-white/95 block text-[12px]">{preset.name}</span>
            <span className="text-white/40 text-[10px] block font-mono mt-0.5">
              {preset.role} {preset.companyName ? `• ${preset.companyName}` : ''} ({preset.keywords?.length || 0} từ khóa)
            </span>
          </div>

          {isActive && (
            <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10.5px]">
              ⚠️ Đây là Profile <strong>đang được kích hoạt (Active)</strong>. Sau khi xóa, hệ thống sẽ tự động chuyển sang Profile kế tiếp.
            </div>
          )}

          <p className="text-white/40 text-[10px] italic">
            Lưu ý: Các phiên họp trước đây đã lưu trong Lịch sử sẽ không bị ảnh hưởng vì đã được lưu snapshot độc lập.
          </p>
        </div>

        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-white/10 hover:bg-white/5 text-white/70 text-[11px]"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xác nhận xóa</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
