import { useState, useCallback } from 'react'
import {
  Timer,
  Play,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  CapturedImageInfo,
  VisualAnalysisResult,
  MultimodalModelOption,
} from '@/services/screen-capture/types'
import {
  VISION_SAMPLE_PRESETS,
  type VisionSamplePreset,
} from '../../types'
import { generateSampleCanvasImage } from '../../utils/generateSampleImage'

export interface MockScreenDrillBannerProps {
  onSetCapturedImage: (img: CapturedImageInfo | null) => void
  onAnalyzeImage: (
    customPrompt?: string,
    implementationLanguage?: string
  ) => void
  isAnalyzing: boolean
  analysisResult: VisualAnalysisResult | null
  currentVisionModel: MultimodalModelOption | null
  selectedImplementationLanguage: string
}

export function MockScreenDrillBanner({
  onSetCapturedImage,
  onAnalyzeImage,
  isAnalyzing,
  analysisResult,
  currentVisionModel,
  selectedImplementationLanguage,
}: MockScreenDrillBannerProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('two_sum')
  const [drillStartTime, setDrillStartTime] = useState<number | null>(null)
  const [drillCompletedTime, setDrillCompletedTime] = useState<number | null>(null)

  const selectedPreset: VisionSamplePreset =
    VISION_SAMPLE_PRESETS.find((p) => p.id === selectedPresetId) ||
    VISION_SAMPLE_PRESETS[0]

  // Trigger end-to-end simulation drill
  const handleStartDrill = useCallback(() => {
    const sampleImg = generateSampleCanvasImage(selectedPreset)
    onSetCapturedImage(sampleImg)
    setDrillStartTime(Date.now())
    setDrillCompletedTime(null)

    // Trigger analysis with the preset context
    onAnalyzeImage(
      `Phân tích bài toán ${selectedPreset.title} và cung cấp lời giải tối ưu nhất.`,
      selectedImplementationLanguage
    )
  }, [
    selectedPreset,
    onSetCapturedImage,
    onAnalyzeImage,
    selectedImplementationLanguage,
  ])

  // Track completion time when analysis result arrives
  if (isAnalyzing && drillStartTime && !drillCompletedTime) {
    // still in flight
  } else if (!isAnalyzing && drillStartTime && !drillCompletedTime && analysisResult) {
    const elapsed = Date.now() - drillStartTime
    setDrillCompletedTime(elapsed)
  }

  const effectiveTimeMs = drillCompletedTime ?? analysisResult?.latencyMs ?? null

  const getSpeedVerdict = (ms: number) => {
    if (ms < 2500) {
      return {
        rating: 'excellent',
        badge: '⚡ Tốc Độ Tàng Hình Hoàn Hảo (<2.5s)',
        badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        advice:
          'Đối phương sẽ không nhận ra bạn đang dùng trợ lý. Lời giải xuất hiện ngay trước mắt bạn chỉ sau hơn 1 giây.',
      }
    }
    if (ms <= 5000) {
      return {
        rating: 'good',
        badge: '🎯 Tốc Độ Tiêu Chuẩn (2.5s - 5s)',
        badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        advice:
          'Thời gian phản hồi ở mức khá. Bạn có thể vừa mở lời chào vừa đọc lướt ý chính của giải thuật.',
      }
    }
    return {
      rating: 'slow',
      badge: '⚠️ Độ Trễ Hơi Cao (>5s)',
      badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      advice:
        'Thời gian phân tích lâu có thể làm bạn bị khựng lại. Khuyên bạn nên chuyển sang model Vision nhẹ hơn (như Gemini 2.0 Flash) khi phỏng vấn live.',
    }
  }

  const verdict = effectiveTimeMs ? getSpeedVerdict(effectiveTimeMs) : null

  return (
    <div className="bg-gradient-to-r from-[#141226] via-[#101420] to-[#0c101d] border border-violet-500/25 rounded-xl p-3.5 space-y-3 shadow-md backdrop-blur-md">
      {/* Header Row */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/95">
                Giả Lập Phản Xạ Màn Hình (Mock Screen Interview Drill)
              </span>
              <Badge
                variant="outline"
                className="text-[9.5px] px-1.5 py-0 bg-violet-500/15 text-violet-300 border-violet-500/30 font-mono"
              >
                End-to-End Latency
              </Badge>
            </div>
            <p className="text-[10.5px] text-white/45">
              Đo toàn trình: từ lúc chụp đề bài $\rightarrow$ Vision AI trích xuất $\rightarrow$ xuất code giải thuật.
            </p>
          </div>
        </div>

        {/* Start Drill CTA */}
        <Button
          type="button"
          size="sm"
          onClick={handleStartDrill}
          disabled={isAnalyzing || !currentVisionModel}
          className="h-7 px-3 text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg transition-all cursor-pointer shadow-md shadow-violet-500/20"
        >
          {isAnalyzing ? (
            <>
              <Timer className="w-3 h-3 mr-1 animate-spin text-amber-300" />
              Đang đo phản xạ...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1 text-white fill-current" />
              Bắt Đầu Test Phản Xạ
            </>
          )}
        </Button>
      </div>

      {/* Preset Scenario Selector Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
        <span className="text-[11px] text-white/50 shrink-0 mr-1">Tình huống giả lập:</span>
        {VISION_SAMPLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setSelectedPresetId(preset.id)}
            disabled={isAnalyzing}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0 cursor-pointer',
              selectedPresetId === preset.id
                ? 'bg-violet-600/30 text-violet-200 border-violet-500/50 shadow-sm'
                : 'bg-white/[0.04] text-white/60 hover:text-white border-white/10 hover:bg-white/[0.08]'
            )}
          >
            {preset.title.split(':')[0]}
          </button>
        ))}
      </div>

      {/* Speed & Verdict Banner if measured */}
      {verdict && effectiveTimeMs ? (
        <div className="bg-black/35 border border-white/[0.06] rounded-xl p-2.5 space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50">Thời gian toàn trình:</span>
              <span className="text-sm font-bold font-mono text-white/95">
                {(effectiveTimeMs / 1000).toFixed(2)}s{' '}
                <span className="text-[10px] text-white/40 font-normal">({effectiveTimeMs}ms)</span>
              </span>
            </div>
            <Badge variant="outline" className={cn('text-[9.5px] px-2 py-0.5 border font-semibold', verdict.badgeStyle)}>
              {verdict.badge}
            </Badge>
          </div>
          <p className="text-[11px] text-white/80 leading-relaxed">
            💡 {verdict.advice}
          </p>
        </div>
      ) : (
        <div className="text-[10.5px] text-white/40 bg-black/20 border border-white/[0.04] rounded-lg p-2 flex items-center justify-between">
          <span>
            Bấm &ldquo;Bắt Đầu Test Phản Xạ&rdquo; để chạy thử nghiệm tốc độ giải đề LeetCode với mô hình Vision hiện tại.
          </span>
          <span className="text-violet-400/80 font-mono text-[10px]">Phím tắt: [1] Nửa trái LeetCode</span>
        </div>
      )}
    </div>
  )
}
