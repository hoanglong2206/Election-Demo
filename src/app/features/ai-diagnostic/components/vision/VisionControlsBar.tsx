import { useState, useRef, useEffect } from 'react'
import {
  Eye,
  Camera,
  Crop,
  Upload,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  CapturedImageInfo,
  MultimodalModelOption,
} from '@/services/screen-capture/types'
import {
  VISION_SAMPLE_PRESETS,
  type VisionSamplePreset,
} from '../../types'
import { generateSampleCanvasImage } from '../../utils/generateSampleImage'

export interface VisionControlsBarProps {
  currentVisionModel: MultimodalModelOption | null
  availableVisionModels: MultimodalModelOption[]
  selectedVisionModelId: string
  onSelectVisionModel: (modelId: string) => void
  onTriggerScreenCapture: (cropImmediately: boolean) => void
  onSetCapturedImage: (img: CapturedImageInfo | null) => void
  onOpenCropOverlay: () => void
  hasCapturedImage: boolean
  isCapturing: boolean
}

export function VisionControlsBar({
  currentVisionModel,
  availableVisionModels,
  selectedVisionModelId,
  onSelectVisionModel,
  onTriggerScreenCapture,
  onSetCapturedImage,
  onOpenCropOverlay,
  hasCapturedImage,
  isCapturing,
}: VisionControlsBarProps) {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isSampleDropdownOpen, setIsSampleDropdownOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const sampleDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false)
      }
      if (
        sampleDropdownRef.current &&
        !sampleDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSampleDropdownOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModelDropdownOpen(false)
        setIsSampleDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        onSetCapturedImage({
          dataUrl,
          width: img.width,
          height: img.height,
          source: 'browser_display_media',
          capturedAt: Date.now(),
        })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleLoadSample = (sample: VisionSamplePreset) => {
    try {
      const generated = generateSampleCanvasImage(sample)
      onSetCapturedImage(generated)
      setIsSampleDropdownOpen(false)
    } catch (err) {
      console.warn('[VisionControlsBar] Error generating canvas sample:', err)
    }
  }

  return (
    <div className="space-y-3 pb-3 border-b border-white/[0.06]">
      {/* Header and Model Dropdown */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 flex-wrap relative',
          isModelDropdownOpen ? 'z-40' : 'z-20'
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white/95 leading-tight">
                Kiểm Tra Chụp Màn Hình & Multimodal Vision
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border font-mono bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              >
                {currentVisionModel?.provider || 'Vision'}
              </Badge>
            </div>
            <span className="text-[10px] text-white/40">
              Chụp màn hình, cắt vùng crop, OCR và trích xuất câu hỏi / code LeetCode
            </span>
          </div>
        </div>

        {/* Vision Model Selector Dropdown */}
        <div className="relative" ref={modelDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsModelDropdownOpen((prev) => {
                if (!prev) setIsSampleDropdownOpen(false)
                return !prev
              })
            }}
            className="h-7 px-2.5 rounded-lg bg-black/40 border border-white/10 hover:border-white/20 text-[11px] text-white/80 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="max-w-[140px] truncate font-mono text-[10.5px]">
              {currentVisionModel?.displayName ||
                currentVisionModel?.name ||
                'Chọn Vision Model'}
            </span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-white/40 transition-transform duration-200',
                isModelDropdownOpen && 'rotate-180 text-white'
              )}
            />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 max-h-60 overflow-y-auto rounded-xl bg-[#0d111c]/95 backdrop-blur-2xl border border-white/15 p-1 z-50 shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] custom-scrollbar animate-fade-in">
              <div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Mô hình Multimodal Vision
              </div>
              {availableVisionModels.length > 0 ? (
                availableVisionModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectVisionModel(m.id)
                      setIsModelDropdownOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors',
                      selectedVisionModelId === m.id
                        ? 'bg-emerald-500/20 text-emerald-200 font-medium'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <span className="truncate">{m.displayName || m.name}</span>
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1 py-0 shrink-0 text-white/50"
                    >
                      {m.provider}
                    </Badge>
                  </button>
                ))
              ) : (
                <div className="px-2 py-3 text-center text-xs text-white/40">
                  Chưa có mô hình Vision nào khả dụng.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buttons Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onTriggerScreenCapture(false)}
          disabled={isCapturing}
          className="h-8 px-3 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{isCapturing ? 'Đang chụp...' : 'Chụp Toàn Cửa Sổ'}</span>
        </button>

        <button
          type="button"
          onClick={() => onTriggerScreenCapture(true)}
          disabled={isCapturing}
          className="h-8 px-3 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
        >
          <Crop className="w-3.5 h-3.5 text-cyan-400" />
          <span>Chụp & Cắt Ngay</span>
        </button>

        {hasCapturedImage && (
          <button
            type="button"
            onClick={onOpenCropOverlay}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Crop className="w-3.5 h-3.5 text-amber-400" />
            <span>Cắt Lại Ảnh Hiện Tại</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 px-3 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
        >
          <Upload className="w-3.5 h-3.5 text-violet-400" />
          <span>Tải Ảnh Lên</span>
        </button>

        {/* Sample Presets Dropdown */}
        <div className="relative ml-auto" ref={sampleDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsSampleDropdownOpen((prev) => {
                if (!prev) setIsModelDropdownOpen(false)
                return !prev
              })
            }}
            className="h-8 px-2.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Thử Ảnh Mẫu</span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-white/40 transition-transform duration-200',
                isSampleDropdownOpen && 'rotate-180 text-white'
              )}
            />
          </button>

          {isSampleDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-[#0d111c]/95 backdrop-blur-2xl border border-white/15 p-1 z-50 shadow-2xl custom-scrollbar animate-fade-in">
              <div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Chọn ảnh bài toán mẫu
              </div>
              {VISION_SAMPLE_PRESETS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="w-full text-left p-2 rounded-lg text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors space-y-0.5"
                >
                  <div className="font-medium text-white/95">{sample.title}</div>
                  <div className="text-[10px] text-white/45 leading-tight">
                    {sample.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
