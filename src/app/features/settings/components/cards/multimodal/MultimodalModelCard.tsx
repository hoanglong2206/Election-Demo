import { useState, useRef, useEffect } from 'react'
import { Camera, ChevronDown, Check, Sparkles, AlertCircle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getAvailableMultimodalModels,
  type MultimodalModelOption,
} from '@/services/screen-capture/types'

export interface MultimodalModelCardProps {
  selectedMultimodal: string
  onSelectMultimodal: (id: string) => void
}

export function MultimodalModelCard({
  selectedMultimodal,
  onSelectMultimodal,
}: MultimodalModelCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [models, setModels] = useState<MultimodalModelOption[]>(() =>
    getAvailableMultimodalModels()
  )

  useEffect(() => {
    const handleUpdate = () => {
      setModels(getAvailableMultimodalModels())
    }
    window.addEventListener('ai-models-updated', handleUpdate)
    return () => window.removeEventListener('ai-models-updated', handleUpdate)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentOption = models.find((m) => m.id === selectedMultimodal) || null
  const hasModels = models.length > 0

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none py-3.5 px-4 gap-2.5 relative">
      <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between">
        <CardTitle className="text-[12px] text-white/85 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span>Multimodal Vision Model (Phân tích Ảnh câu hỏi & Diagram)</span>
        </CardTitle>
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-300 border-amber-500/20 font-mono"
        >
          OCR & Vision AI
        </Badge>
      </CardHeader>

      <CardContent className="p-0 space-y-2">
        {/* State 1: When no vision models are available */}
        {!hasModels && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-amber-200/90 shadow-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-semibold text-amber-300">Chưa có mô hình Vision nào khả dụng</div>
              <p className="text-white/60 text-[10.5px]">
                Hiện tại chưa có mô hình AI nào hỗ trợ đọc hình ảnh (ví dụ: Google Gemini, OpenAI GPT-4o). Vui lòng cấu hình API Key ở mục trên và bấm <strong>"Đồng bộ mô hình từ API"</strong> để tải danh sách mô hình thực tế.
              </p>
            </div>
          </div>
        )}

        {/* State 2: Has models, but currently selected model is not in available models */}
        {hasModels && selectedMultimodal && !currentOption && (
          <div className="bg-amber-500/15 border border-amber-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-[11px] text-amber-200 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="leading-snug truncate">
                Mô hình Vision "{selectedMultimodal}" không còn khả dụng trong danh sách.
              </span>
            </div>
            {models[0] && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectMultimodal(models[0].id)}
                className="h-6 px-2 text-[10px] bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30 shrink-0 flex items-center gap-1 font-medium"
              >
                <span>Dùng {models[0].displayName || models[0].id}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
        )}

        {/* Custom Interactive Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full h-10 border rounded-xl px-3 text-[11.5px] text-left flex items-center justify-between transition-all bg-black/50 hover:bg-black/70 border-white/[0.1] hover:border-amber-500/40 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 overflow-hidden">
              {currentOption ? (
                <>
                  <span className="font-semibold text-white/95 truncate">
                    {currentOption.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[8.5px] px-1.5 py-0 bg-white/5 border-white/10 text-amber-300 shrink-0 font-mono uppercase"
                  >
                    {currentOption.provider}
                  </Badge>
                </>
              ) : hasModels ? (
                <span className="text-white/60 font-medium">Chọn mô hình Vision...</span>
              ) : (
                <span className="font-medium text-white/40 italic truncate">
                  Chưa có mô hình Vision (Trống)
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
                isOpen && 'rotate-180 text-amber-400'
              )}
            />
          </button>

          {/* Floating Menu */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 max-h-60 overflow-y-auto custom-scrollbar space-y-1 animate-fade-in">
              {!hasModels ? (
                <div className="p-4 text-center text-white/50 text-[11px] space-y-1.5">
                  <p className="font-medium text-white/80">Danh sách mô hình Vision trống</p>
                  <p className="text-[10px] text-white/45 leading-relaxed">
                    Không tìm thấy mô hình Vision nào từ API. Vui lòng cấu hình API Key (Google, OpenAI,...) và bấm "Đồng bộ mô hình từ API" ở mục trên để tải danh sách thực tế.
                  </p>
                </div>
              ) : (
                models.map((m) => {
                  const isSelected = m.id === selectedMultimodal
                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onSelectMultimodal(m.id)
                        setIsOpen(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectMultimodal(m.id)
                          setIsOpen(false)
                        }
                      }}
                      className={cn(
                        'w-full text-left p-2 rounded-lg cursor-pointer transition-all flex items-start justify-between gap-2 border',
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/35 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/[0.05] hover:border-white/10 text-white/70 hover:text-white'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-[11px] text-white">
                            {m.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[8px] px-1 py-0 bg-white/5 border-white/10 text-white/50 uppercase font-mono"
                          >
                            {m.provider}
                          </Badge>
                        </div>
                        {m.description && (
                          <p className="text-[10px] text-white/40 line-clamp-2 mt-0.5">
                            {m.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Info Footnote */}
        <div className="flex items-center gap-2 text-[10.5px] text-white/40 pt-1">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <span>
            Chỉ hiển thị các mô hình hỗ trợ Multimodal Vision. Kích hoạt phân tích ảnh trực tiếp bằng <kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white/70">Ctrl+Shift+S</kbd>.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

