import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  const [cropRect, setCropRect] = useState<(CropRect & { realWidth?: number; realHeight?: number }) | null>(null)
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
      scaleX: imageInfo.width / (rect.width || 1),
      scaleY: imageInfo.height / (rect.height || 1),
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

  // Smooth window-level drag tracking so dragging outside bounds clamps cleanly
  useEffect(() => {
    if (!isDrawing) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!startPoint) return
      const coords = getImageCoordinates(e.clientX, e.clientY)
      if (!coords) return
      const x = Math.min(startPoint.x, coords.x)
      const y = Math.min(startPoint.y, coords.y)
      const width = Math.abs(coords.x - startPoint.x)
      const height = Math.abs(coords.y - startPoint.y)
      const realWidth = Math.round(width * coords.scaleX)
      const realHeight = Math.round(height * coords.scaleY)
      setCropRect({ x, y, width, height, realWidth, realHeight })
    }

    const handleWindowMouseUp = () => {
      setIsDrawing(false)
      setStartPoint(null)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [isDrawing, startPoint, getImageCoordinates])

  const handleConfirm = useCallback(() => {
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
    const scaleX = imageInfo.width / (rect.width || 1)
    const scaleY = imageInfo.height / (rect.height || 1)

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
  }, [cropRect, imageInfo.width, imageInfo.height, onConfirmCrop, triggerClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') triggerClose(onCancel)
      else if (e.key === 'Enter') handleConfirm()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleConfirm, onCancel, triggerClose])

  const content = (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-[99999] flex flex-col bg-black/95 backdrop-blur-xl select-none transition-opacity duration-200 rounded-2xl overflow-hidden',
        isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      )}
    >
      {/* Top action bar: Spans full width of the application with responsive spacing */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-white/10 bg-black/60 shrink-0 gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs font-semibold shrink-0"
          >
            <Crop className="w-3.5 h-3.5 text-violet-400" />
            <span>KÉO CHUỘT ĐỂ CẮT VÙNG CÂU HỎI</span>
          </Badge>
          <span className="text-xs text-white/50 hidden md:flex items-center gap-1.5 truncate">
            <MousePointer className="w-3 h-3 text-white/40 shrink-0" />
            Nhấn giữ & kéo vùng chứa câu hỏi, code hoặc diagram cần AI giải đáp
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => triggerClose(onRetake)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Chụp lại</span>
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
              'flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-semibold shadow-lg transition-all',
              cropRect && cropRect.width > 20 && cropRect.height > 20
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white cursor-pointer'
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
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport Area: Takes 100% available space in the full application */}
      <div className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden">
        {/* Precise image wrapper: exactly bounds the rendered image pixels */}
        <div
          className="relative inline-block select-none overflow-hidden rounded-lg border border-white/20 shadow-2xl cursor-crosshair max-w-full max-h-full"
          onMouseDown={handleMouseDown}
        >
          <img
            ref={imageRef}
            src={imageInfo.dataUrl}
            alt="Screen capture preview"
            className="block max-h-[calc(100vh-100px)] max-w-[calc(100vw-32px)] w-auto h-auto select-none pointer-events-none"
            draggable={false}
          />

          {/* Idle prompt banner when no crop has been drawn yet */}
          {(!cropRect || cropRect.width === 0) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium shadow-2xl flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-violet-400" />
                <span>Kéo chuột trên ảnh để chọn vùng câu hỏi hoặc nhấn Enter để dùng toàn bộ</span>
              </div>
            </div>
          )}

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
              {/* Corner accents for crisp framing */}
              <span className="absolute -top-[2px] -left-[2px] w-2.5 h-2.5 border-t-2 border-l-2 border-white" />
              <span className="absolute -top-[2px] -right-[2px] w-2.5 h-2.5 border-t-2 border-r-2 border-white" />
              <span className="absolute -bottom-[2px] -left-[2px] w-2.5 h-2.5 border-b-2 border-l-2 border-white" />
              <span className="absolute -bottom-[2px] -right-[2px] w-2.5 h-2.5 border-b-2 border-r-2 border-white" />

              {/* Dynamic Dimension Badge */}
              <div
                className={cn(
                  'absolute px-1.5 py-0.5 bg-violet-600 text-white font-mono text-[10px] rounded shadow-sm whitespace-nowrap z-10 flex items-center gap-1',
                  cropRect.y > 26 ? '-top-6 left-0' : 'top-1.5 left-1.5'
                )}
              >
                <span>
                  {cropRect.realWidth ?? Math.round(cropRect.width)} x {cropRect.realHeight ?? Math.round(cropRect.height)} px
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const portalTarget = typeof document !== 'undefined' ? document.body : null
  return portalTarget ? createPortal(content, portalTarget) : content
}
