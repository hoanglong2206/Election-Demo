import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Crop,
  Maximize2,
  RefreshCw,
  X,
  Sparkles,
  Camera,
  MousePointer,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  CapturedImageInfo,
  CropRect,
} from '@/services/screen-capture/types'

export interface ScreenshotCropOverlayProps {
  imageInfo: CapturedImageInfo
  isProcessing?: boolean
  onConfirmCrop: (cropRect: CropRect) => void
  onCancel: () => void
  onRetake: () => void
}

export function ScreenshotCropOverlay({
  imageInfo,
  isProcessing = false,
  onConfirmCrop,
  onCancel,
  onRetake,
}: ScreenshotCropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [isClosing, setIsClosing] = useState(false)

  const triggerClose = useCallback((callback: () => void) => {
    setIsClosing(true)
    setTimeout(() => {
      callback()
    }, 150)
  }, [])

  const getImageCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!imageRef.current) return null
    const rect = imageRef.current.getBoundingClientRect()
    const relX = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const relY = Math.max(0, Math.min(clientY - rect.top, rect.height))
    return {
      x: relX,
      y: relY,
      scaleX: imageInfo.width / rect.width,
      scaleY: imageInfo.height / rect.height,
      displayedWidth: rect.width,
      displayedHeight: rect.height,
    }
  }, [imageInfo.width, imageInfo.height])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing) return
    const coords = getImageCoordinates(e.clientX, e.clientY)
    if (!coords) return
    setIsDrawing(true)
    setStartPoint({ x: coords.x, y: coords.y })
    setCropRect(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return
    const coords = getImageCoordinates(e.clientX, e.clientY)
    if (!coords) return
    const x = Math.min(startPoint.x, coords.x)
    const y = Math.min(startPoint.y, coords.y)
    const width = Math.abs(coords.x - startPoint.x)
    const height = Math.abs(coords.y - startPoint.y)
    setCropRect({ x, y, width, height })
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    setStartPoint(null)
  }

  const handleConfirm = () => {
    if (!cropRect || !imageRef.current) {
      onConfirmCrop({
        x: 0,
        y: 0,
        width: imageInfo.width,
        height: imageInfo.height,
      })
      return
    }

    const rect = imageRef.current.getBoundingClientRect()
    const scaleX = imageInfo.width / rect.width
    const scaleY = imageInfo.height / rect.height

    const realCrop: CropRect = {
      x: Math.round(cropRect.x * scaleX),
      y: Math.round(cropRect.y * scaleY),
      width: Math.round(cropRect.width * scaleX),
      height: Math.round(cropRect.height * scaleY),
    }

    if (realCrop.width < 30 || realCrop.height < 30) {
      onConfirmCrop({
        x: 0,
        y: 0,
        width: imageInfo.width,
        height: imageInfo.height,
      })
      return
    }

    triggerClose(() => onConfirmCrop(realCrop))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') triggerClose(onCancel)
      else if (e.key === 'Enter') handleConfirm()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none transition-opacity duration-200',
        isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      )}
      onMouseUp={handleMouseUp}
    >
      {/* Top action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs font-semibold"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>KÉO CHUỘT ĐỂ CẮT VÙNG CÂU HỎI</span>
          </Badge>
          <span className="text-xs text-white/50 flex items-center gap-1">
            <MousePointer className="w-3.5 h-3.5" />
            Nhấn giữ & kéo vùng chứa câu hỏi, code hoặc diagram cần AI giải đáp
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerClose(onRetake)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Chụp lại</span>
          </button>

          <button
            onClick={() => {
              setCropRect(null)
              handleConfirm()
            }}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dùng toàn ảnh</span>
          </button>

          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-lg transition-all',
              cropRect && cropRect.width > 20 && cropRect.height > 20
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Xác nhận & Phân tích AI</span>
              </>
            )}
          </button>

          <button
            onClick={() => triggerClose(onCancel)}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport Area with Crop Box */}
      <div
        className="flex-1 relative flex items-center justify-center p-6 overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div className="relative inline-block max-w-full max-h-full">
          <img
            ref={imageRef}
            src={imageInfo.dataUrl}
            alt="Screen capture preview"
            className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-48px)] object-contain shadow-2xl rounded-sm pointer-events-none"
            draggable={false}
          />

          {/* Dimmed backdrop outside crop area when drawing */}
          {cropRect && cropRect.width > 0 && cropRect.height > 0 && (
            <div
              className="absolute pointer-events-none border-2 border-violet-400 bg-violet-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
              style={{
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.width}px`,
                height: `${cropRect.height}px`,
              }}
            >
              <div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-violet-600 text-white font-mono text-[10px] rounded shadow-sm whitespace-nowrap">
                {Math.round(cropRect.width)} x {Math.round(cropRect.height)}px
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
