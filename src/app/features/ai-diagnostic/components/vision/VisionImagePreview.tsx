import { Trash2, Crop, Camera, Eye } from 'lucide-react'
import type { CapturedImageInfo } from '@/services/screen-capture/types'

export interface VisionImagePreviewProps {
  capturedImage: CapturedImageInfo | null
  onClearImage: () => void
  onOpenCropOverlay: () => void
  onTriggerCapture: () => void
}

export function VisionImagePreview({
  capturedImage,
  onClearImage,
  onOpenCropOverlay,
  onTriggerCapture,
}: VisionImagePreviewProps) {
  if (!capturedImage) {
    return (
      <div
        onClick={onTriggerCapture}
        className="border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-black/20 hover:bg-black/30 group"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 transition-colors">
          <Camera className="w-6 h-6" />
        </div>
        <p className="text-xs font-medium text-white/80 group-hover:text-white">
          Chưa có hình ảnh nào được chọn
        </p>
        <p className="text-[11px] text-white/40 mt-1 max-w-sm leading-relaxed">
          Bấm để chụp màn hình, hoặc chọn nút &quot;Thử Ảnh Mẫu&quot; phía trên để kiểm tra ngay tính năng OCR & Multimodal.
        </p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl border border-white/10 bg-black/40 overflow-hidden flex flex-col items-center justify-center p-3">
      {/* Top badges bar */}
      <div className="w-full flex items-center justify-between pb-2 text-[10.5px] text-white/50 border-b border-white/[0.06] mb-3">
        <span className="flex items-center gap-1.5 font-medium text-white/70">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          Ảnh chụp hiện tại ({capturedImage.width} × {capturedImage.height}px)
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCropOverlay}
            className="flex items-center gap-1 text-white/60 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
          >
            <Crop className="w-3 h-3 text-cyan-400" />
            <span>Cắt ảnh</span>
          </button>

          <button
            type="button"
            onClick={onClearImage}
            className="flex items-center gap-1 text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-0.5 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {/* Image Preview Canvas/Img */}
      <div className="max-h-64 overflow-hidden rounded-lg border border-white/5 shadow-inner">
        <img
          src={capturedImage.dataUrl}
          alt="Preview"
          className="max-h-60 max-w-full object-contain rounded"
        />
      </div>
    </div>
  )
}
