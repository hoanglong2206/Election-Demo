import { X } from 'lucide-react'

export interface ScreenshotLightboxModalProps {
  imageUrl: string | null
  onClose: () => void
}

export function ScreenshotLightboxModal({
  imageUrl,
  onClose,
}: ScreenshotLightboxModalProps) {
  if (!imageUrl) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
    >
      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Screenshot full preview"
          className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl border border-white/10"
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-3 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
        >
          <X className="w-3 h-3" />
          <span>Đóng xem ảnh (ESC / Bấm ra ngoài)</span>
        </button>
      </div>
    </div>
  )
}

