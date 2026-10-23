import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = 'Xác nhận',
  description,
  confirmLabel = 'Xóa',
  cancelLabel = 'Hủy',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Keyboard shortcuts: Escape to cancel, Enter to confirm
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-fade-in"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog card */}
      <div
        className={cn(
          'relative z-10 w-[360px] rounded-2xl border shadow-2xl',
          'bg-gradient-to-br from-[#1a1a2e]/95 via-[#16213e]/95 to-[#0f0f23]/95',
          'backdrop-blur-xl',
          isDanger
            ? 'border-rose-500/25'
            : 'border-amber-500/25'
        )}
        style={{
          boxShadow: isDanger
            ? '0 25px 50px rgba(244,63,94,0.18), 0 0 0 1px rgba(244,63,94,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 25px 50px rgba(245,158,11,0.18), 0 0 0 1px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top shimmer accent line */}
        <div
          className={cn(
            'absolute top-0 left-8 right-8 h-px rounded-full',
            isDanger
              ? 'bg-gradient-to-r from-transparent via-rose-500/70 to-transparent'
              : 'bg-gradient-to-r from-transparent via-amber-500/70 to-transparent'
          )}
        />

        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3.5 right-3.5 w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-white/70 hover:bg-white/10 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Content area */}
        <div className="p-6 pb-5">
          {/* Icon badge */}
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center mb-4 border',
              isDanger
                ? 'bg-rose-500/15 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                : 'bg-amber-500/15 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            )}
          >
            {isDanger
              ? <Trash2 className="w-5 h-5 text-rose-400" />
              : <AlertTriangle className="w-5 h-5 text-amber-400" />
            }
          </div>

          {/* Title */}
          <h3 className="text-[14px] font-semibold text-white/95 mb-2 leading-snug pr-6">
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-[12px] text-white/50 leading-relaxed">
              {description}
            </p>
          )}

          {/* Keyboard hint */}
          <p className="text-[10px] text-white/20 mt-3 font-mono">
            <kbd className="px-1 py-0.5 rounded bg-white/8 text-white/35 text-[9px] border border-white/10">Esc</kbd>
            {' '}để hủy {'·'}{' '}
            <kbd className="px-1 py-0.5 rounded bg-white/8 text-white/35 text-[9px] border border-white/10">Enter</kbd>
            {' '}để xác nhận
          </p>
        </div>

        {/* Divider */}
        <div className={cn('h-px mx-0', isDanger ? 'bg-rose-500/10' : 'bg-amber-500/10')} />

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-white/[0.015] rounded-b-2xl">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-7 px-3.5 text-[11px] bg-white/5 text-white/55 border-white/10 hover:bg-white/10 hover:text-white/90 transition-all"
          >
            {cancelLabel}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className={cn(
              'h-7 px-3.5 text-[11px] font-medium border transition-all flex items-center gap-1.5',
              isDanger
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 hover:text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.2)]'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 hover:text-amber-200'
            )}
          >
            <Trash2 className="w-3 h-3" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
