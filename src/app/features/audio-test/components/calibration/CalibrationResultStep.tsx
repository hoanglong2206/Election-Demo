import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EnvironmentQuality, VADCalibrationResult } from '@/services/vad-calibration'

export interface CalibrationResultStepProps {
  calibrationResult: VADCalibrationResult
}

function getQualityBadge(quality: EnvironmentQuality) {
  switch (quality) {
    case 'pristine':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1.5 py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Phòng thu / Rất yên tĩnh</span>
        </Badge>
      )
    case 'good':
      return (
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1.5 py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>Tốt / Yên tĩnh</span>
        </Badge>
      )
    case 'moderate':
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1.5 py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Trung bình / Tiếng quạt</span>
        </Badge>
      )
    case 'noisy':
      return (
        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 gap-1.5 py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span>Ồn / Nhiều tạp âm</span>
        </Badge>
      )
    case 'critical':
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 gap-1.5 py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          <span>Quá ồn</span>
        </Badge>
      )
  }
}

export function CalibrationResultStep({ calibrationResult }: CalibrationResultStepProps) {
  return (
    <div className="space-y-4">
      {/* Quality & Status Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
              Chất lượng môi trường
            </div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {calibrationResult.qualityLabel}
            </div>
          </div>
        </div>
        {getQualityBadge(calibrationResult.quality)}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-1">
          <span className="text-[10.5px] text-white/50 block font-medium">Độ Ồn Nền (Noise Floor)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-cyan-300">
              {calibrationResult.noiseFloorDbfs}
            </span>
            <span className="text-xs text-white/40 font-mono">dBFS</span>
          </div>
          <span className="text-[10px] text-white/40 block">
            RMS: {calibrationResult.noiseFloorRms.toFixed(5)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-1 shadow-sm">
          <span className="text-[10.5px] text-violet-300/80 block font-medium">
            Ngưỡng VAD Khuyên Dùng
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-violet-300">
              {calibrationResult.speechThresholdDbfs}
            </span>
            <span className="text-xs text-violet-300/60 font-mono">dBFS</span>
          </div>
          <span className="text-[10px] text-violet-300/60 block">
            RMS: {calibrationResult.speechThresholdRms.toFixed(5)} (+{calibrationResult.safetyMarginDb} dB)
          </span>
        </div>
      </div>

      {/* Statistical Distribution & Outliers */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-white/60 space-y-1.5">
        <div className="flex justify-between">
          <span>Tổng số khung (50ms frames):</span>
          <span className="font-mono text-white/80">{calibrationResult.totalFrames} khung (100%)</span>
        </div>
        <div className="flex justify-between">
          <span>Khung hợp lệ (Inliers):</span>
          <span className="font-mono text-emerald-400 font-medium">
            {calibrationResult.inlierFrames} khung
          </span>
        </div>
        <div className="flex justify-between">
          <span>Tạp âm đột ngột bị loại bỏ (IQR Outliers):</span>
          <span className="font-mono text-amber-300 font-medium">
            {calibrationResult.outlierFrames} khung ({Math.round((calibrationResult.outlierFrames / calibrationResult.totalFrames) * 100)}%)
          </span>
        </div>
        <div className="flex justify-between">
          <span>Độ nhạy ngắt câu ước tính:</span>
          <span className="font-mono text-violet-300 font-semibold">
            {Math.round(calibrationResult.sensitivity * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}
