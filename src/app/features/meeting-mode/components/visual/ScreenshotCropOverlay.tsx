import React, { useState, useRef, useEffect, useCallback } from 'react'
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
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
    return { x, y }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing || isClosing || e.button !== 0) return
    const point = getImageCoordinates(e.clientX, e.clientY)
    if (!point) return
    setIsDrawing(true)
    setStartPoint(point)
    setCropRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || isProcessing || isClosing) return
    const current = getImageCoordinates(e.clientX, e.clientY)
    if (!current) return

    const x = Math.min(startPoint.x, current.x)
    const y = Math.min(startPoint.y, current.y)
    const width = Math.abs(current.x - startPoint.x)
    const height = Math.abs(current.y - startPoint.y)

    setCropRect({ x, y, width, height })
  }

  const handleMouseUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    if (cropRect && (cropRect.width < 20 || cropRect.height < 20)) {
      setCropRect(null)
    }
  }

  const handleSelectFullScreen = () => {
    if (!imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    setCropRect({ x: 0, y: 0, width: rect.width, height: rect.height })
  }

  const handleConfirm = () => {
    if (isProcessing || isClosing) return
    if (!imageRef.current) return

    const rect = imageRef.current.getBoundingClientRect()
    const scaleX = imageInfo.width / rect.width
    const scaleY = imageInfo.height / rect.height

    if (!cropRect || cropRect.width < 10 || cropRect.height < 10) {
      onConfirmCrop({ x: 0, y: 0, width: imageInfo.width, height: imageInfo.height })
      return
    }

    const naturalCrop: CropRect = {
      x: Math.round(cropRect.x * scaleX),
      y: Math.round(cropRect.y * scaleY),
      width: Math.round(cropRect.width * scaleX),
      height: Math.round(cropRect.height * scaleY),
    }

    onConfirmCrop(naturalCrop)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing || isClosing) return
      if (e.key === 'Escape') triggerClose(onCancel)
      if (e.key === 'Enter') handleConfirm()
      if (e.key === 'f' || e.key === 'F') handleSelectFullScreen()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProcessing, isClosing, triggerClose, onCancel, handleConfirm])

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none transition-opacity duration-150',
        isClosing ? 'opacity-0' : 'opacity-100'
      )}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-violet-500/20 text-violet-300 border-violet-500/30 gap-1.5 py-1">
            <Crop className="w-3.5 h-3.5" />
            <span>Khoanh vùng câu hỏi</span>
          </Badge>
          <span className="text-xs text-white/50 flex items-center gap-1">
            <MousePointer className="w-3 h-3" />
            <span>Kéo chuột để chọn vùng bài toán / câu hỏi cần AI giải đáp</span>
          </span>
        </div>

        <button
          onClick={() => triggerClose(onCancel)}
          className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Đóng (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <img
            ref={imageRef}
            src={imageInfo.dataUrl}
            alt="Màn hình đã chụp"
            className="max-h-[calc(100vh-140px)] max-w-[calc(100vw-32px)] object-contain rounded-lg border border-white/10 shadow-2xl pointer-events-none"
            draggable={false}
          />

          {cropRect && cropRect.width > 0 && cropRect.height > 0 && (
            <div
              className="absolute border-2 border-violet-400 bg-violet-500/15 pointer-events-none rounded shadow-sm"
              style={{
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.width}px`,
                height: `${cropRect.height}px`,
              }}
            >
              <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9.5px] font-mono text-white/80">
                {Math.round(cropRect.width)} x {Math.round(cropRect.height)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-black/60">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectFullScreen}
            disabled={isProcessing || isClosing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Toàn màn hình (F)</span>
          </button>
          <button
            onClick={() => setCropRect(null)}
            disabled={!cropRect || isProcessing || isClosing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Chọn lại</span>
          </button>
          <button
            onClick={() => triggerClose(onRetake)}
            disabled={isProcessing || isClosing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chụp lại</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={isProcessing || isClosing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xử lý ảnh...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Lưu ảnh (Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
