import { useState, useRef, useEffect } from 'react'
import { Mic, ChevronDown, Check, Sparkles, RotateCcw, CheckCircle2, Zap } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { STTEngineConfig } from '../../../services/ai-model/aiModels'

interface STTEngineCardProps {
  sttEnginesList: STTEngineConfig[]
  selectedSTT: string
  onSelectSTT: (id: string) => void
  currentSTT: STTEngineConfig
  isCheckingNative: boolean
  nativeTestResult: { latencyMs: number; isNative: boolean; text: string } | null
  onCheckNativeEngine: () => void
  isCheckingGroqSTT?: boolean
  groqTestResult?: { latencyMs: number; text: string } | null
  onCheckGroqSTT?: () => void
}

export function STTEngineCard({
  sttEnginesList,
  selectedSTT,
  onSelectSTT,
  currentSTT,
  isCheckingNative,
  nativeTestResult,
  onCheckNativeEngine,
  isCheckingGroqSTT = false,
  groqTestResult,
  onCheckGroqSTT,
}: STTEngineCardProps) {
  const [isSTTOpen, setIsSTTOpen] = useState(false)
  const sttRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sttRef.current && !sttRef.current.contains(e.target as Node)) {
        setIsSTTOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <Card className="h-full min-w-0 bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative flex flex-col gap-2.5">
      <CardHeader className="min-w-0 p-0 pb-0 space-y-1">
        <div className="flex items-center justify-between min-h-[24px]">
          <CardTitle className="min-w-0 text-[12.5px] font-semibold text-white/95 flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>STT Engine (Nhận diện giọng nói)</span>
          </CardTitle>

          <Badge
            variant="outline"
            className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-mono flex items-center gap-1 shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Speech &rarr; Text</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-w-0 p-0 gap-2.5">
        {/* Custom Interactive Dropdown for STT */}
        <div ref={sttRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSTTOpen(!isSTTOpen)}
            className="w-full h-10 bg-black/50 hover:bg-black/70 border border-white/[0.1] hover:border-emerald-500/40 rounded-xl px-3 text-[11.5px] text-left flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 overflow-hidden">
              <span className="font-semibold text-white/95 truncate">
                {currentSTT.name.split(' (')[0]}
              </span>
              <Badge
                variant="outline"
                className="text-[8.5px] px-1.5 py-0 bg-white/5 border-white/10 text-emerald-300 shrink-0 font-mono"
              >
                {currentSTT.badge}
              </Badge>
            </div>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
                isSTTOpen && 'rotate-180 text-emerald-400'
              )}
            />
          </button>

          {/* STT Floating Menu */}
          {isSTTOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 space-y-1 animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
              {sttEnginesList.map((eng) => {
                const isSelected = eng.id === selectedSTT
                return (
                  <div
                    key={eng.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectSTT(eng.id)
                      setIsSTTOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSelectSTT(eng.id)
                        setIsSTTOpen(false)
                      }
                    }}
                    className={cn(
                      'p-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2',
                      isSelected
                        ? 'bg-emerald-600/20 text-white border border-emerald-500/30'
                        : 'hover:bg-white/[0.06] text-white/75'
                    )}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[11px] text-white">
                          {eng.name.split(' (')[0]}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 bg-white/5 border-white/10 text-emerald-300 font-mono"
                        >
                          {eng.badge}
                        </Badge>
                      </div>
                      <p className="text-[9.5px] text-white/40 leading-relaxed truncate">
                        {eng.description}
                      </p>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                  </div>
                )
              })}

              {!sttEnginesList.some((e) => e.provider === 'Groq') && (
                <div className="pt-1.5 mt-1 border-t border-white/[0.06] px-2 py-1 text-[9px] text-white/40 flex items-center gap-1.5">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  <span>Nhập và kiểm tra Groq Key ở trên để mở khóa các mô hình Whisper chạy trên chip Groq LPU.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Active STT Model Details Card ── */}
        <div className="flex-1 min-w-0 bg-gradient-to-b from-black/60 to-black/40 p-3 rounded-xl border border-emerald-500/20 flex flex-col justify-between space-y-2 text-[10.5px] animate-fade-in shadow-inner">
          <div className="flex items-center justify-between gap-2 min-h-6">
            <div className="flex items-center gap-1.5 font-medium text-white/90 text-[10.5px]">
              <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Thông tin mô hình STT đã chọn:</span>
            </div>
            <Badge
              variant="outline"
              className="text-[9px] px-2 py-0.5 flex items-center gap-1 font-mono bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentSTT.provider === 'Local' ? 'Local · Offline C++' : 'Groq · LPU Cloud'}</span>
            </Badge>
          </div>

          <div className="space-y-1.5 text-white/50 text-[9.5px]">
            {/* Row 1: Model ID */}
            <div className="flex items-center justify-between gap-3 min-h-[22px]">
              <span className="text-white/45 text-[10px] shrink-0">Mã định danh (Model ID):</span>
              <code
                className="text-white/90 font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9.5px] truncate max-w-[62%]"
                title={currentSTT.modelFile || currentSTT.id}
              >
                {currentSTT.modelFile || currentSTT.id}
              </code>
            </div>

            {/* Row 2: Architecture / Size */}
            <div className="flex items-center justify-between gap-3 min-h-[22px]">
              <span className="text-white/45 text-[10px] shrink-0">Dung lượng / Kiến trúc:</span>
              <span className="text-white/80 font-mono text-[9.5px] bg-white/5 border border-white/10 px-2 py-0.5 rounded truncate max-w-[62%]">
                {currentSTT.sizeMb ? `${currentSTT.sizeMb}MB GGML Binary` : 'OpenAI Whisper Cloud'}
              </span>
            </div>

            {/* Row 3: Capabilities / Engine Mode */}
            <div className="flex items-center justify-between gap-3 min-h-[22px]">
              <span className="text-white/45 text-[10px] shrink-0">Phương thức xử lý:</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300 font-medium">
                  {currentSTT.provider === 'Local' ? 'C++ NATIVE' : 'CLOUD API'}
                </span>
                <span className="text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                  AUDIO &rarr; TEXT
                </span>
              </div>
            </div>

            {/* Row 4: Latency */}
            <div className="flex items-center justify-between gap-2 min-h-[22px]">
              <span className="text-white/45 text-[10px] shrink-0">Độ trễ (Latency):</span>
              <div className="flex items-center gap-1.5 min-w-0 justify-end flex-wrap">
                {currentSTT.provider === 'Local' ? (
                  <span className="text-emerald-300 font-mono font-medium text-[9.5px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded truncate">
                    ~{currentSTT.latencyMs || 120}ms (Local AVX2)
                  </span>
                ) : groqTestResult ? (
                  <span
                    className="text-emerald-300 font-mono font-semibold text-[9.5px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1.5 shrink-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{groqTestResult.latencyMs}ms</span>
                    <span className="text-white/40 font-normal text-[8.5px]">
                      (LPU Cloud)
                    </span>
                  </span>
                ) : isCheckingGroqSTT ? (
                  <span className="text-amber-300 font-mono font-medium text-[9.5px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Đang đo ping...</span>
                  </span>
                ) : null}

                {onCheckGroqSTT && currentSTT.provider !== 'Local' && (
                  <button
                    type="button"
                    onClick={onCheckGroqSTT}
                    disabled={isCheckingGroqSTT}
                    className="text-[9px] text-white/50 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors"
                    title="Đo ping mạng thực tế tới hạ tầng Groq LPU"
                  >
                    <Zap className={cn('w-2.5 h-2.5 text-amber-400', isCheckingGroqSTT && 'animate-spin')} />
                    <span>{isCheckingGroqSTT ? '...' : groqTestResult ? 'Đo lại' : 'Đo ping'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Row 5: Recommended for */}
            <div className="flex items-start justify-between gap-3 min-h-[22px]">
              <span className="text-white/45 text-[10px] shrink-0 pt-0.5">Khuyên dùng cho:</span>
              <span className="text-white/80 text-right text-[9.5px] leading-tight line-clamp-2 max-w-[62%]">
                {currentSTT.recommendedFor || 'Phụ đề trực tiếp và nhận diện giọng nói thời gian thực'}
              </span>
            </div>

            {/* Description Quote */}
            <div className="pt-2 border-t border-white/[0.06] text-[9.5px] text-white/50 italic leading-relaxed min-h-[38px] flex items-center">
              <p className="line-clamp-2">&ldquo;{currentSTT.description || 'Chuyển đổi âm thanh hội thoại sang văn bản song ngữ trực tiếp.'}&rdquo;</p>
            </div>
          </div>

          {/* Bottom Action / Status Bar */}
          <div className="h-8 flex items-center justify-between pt-2 border-t border-white/[0.08] text-[9.5px] gap-2">
            {currentSTT.provider === 'Local' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCheckNativeEngine}
                  disabled={isCheckingNative}
                  className="h-6 text-[10px] px-2.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 font-medium flex items-center gap-1.5 shrink-0"
                >
                  {isCheckingNative ? (
                    <>
                      <RotateCcw className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                      <span>Đang kiểm tra...</span>
                    </>
                  ) : (
                    <span>Kiểm tra Native Engine</span>
                  )}
                </Button>

                {nativeTestResult ? (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-[9.5px] font-mono truncate min-w-0',
                      nativeTestResult.isNative ? 'text-emerald-400' : 'text-amber-400'
                    )}
                    title={nativeTestResult.text}
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {nativeTestResult.isNative
                        ? `~${nativeTestResult.latencyMs}ms (C++ Native)`
                        : nativeTestResult.text || `Mô phỏng (~${nativeTestResult.latencyMs}ms)`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[9px] shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Sẵn sàng Offline 100%</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono min-w-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">Sẵn sàng nhận diện qua Groq LPU</span>
                </div>

                <Badge
                  variant="outline"
                  className="h-5 text-[8.5px] px-1.5 flex items-center bg-white/5 border-white/10 text-white/60 font-mono shrink-0"
                >
                  Hardware LPU
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
