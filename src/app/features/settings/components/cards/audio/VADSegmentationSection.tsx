import { cn } from '@/lib/utils'
import { getVADCalibration } from '@/services/vad-calibration'

interface VADSegmentationSectionProps {
  selectedDevice: string
  vadThreshold: string
  onVadThresholdChange: (val: string) => void
  segmentationMode?: 'sentence' | 'fixed'
  onSegmentationModeChange?: (mode: 'sentence' | 'fixed') => void
  silenceEndMs?: number
  onSilenceEndMsChange?: (val: number) => void
  maxSegmentMs?: number
  onMaxSegmentMsChange?: (val: number) => void
}

export function VADSegmentationSection({
  selectedDevice,
  vadThreshold,
  onVadThresholdChange,
  segmentationMode = 'sentence',
  onSegmentationModeChange,
  silenceEndMs = 400,
  onSilenceEndMsChange,
  maxSegmentMs = 4500,
  onMaxSegmentMsChange,
}: VADSegmentationSectionProps) {
  const calibration = getVADCalibration(selectedDevice)

  return (
    <div className="space-y-2 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85">Cơ chế phân đoạn âm thanh (VAD):</span>
        <div className="flex items-center gap-1.5">
          {calibration && (
            <span className="text-[9.5px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded font-mono">
              {calibration.speechThresholdDbfs} dBFS
            </span>
          )}
          <span className="text-violet-300 font-mono text-[10.5px] font-medium">
            {segmentationMode === 'sentence' ? `${silenceEndMs}ms` : `${vadThreshold}s`}
          </span>
        </div>
      </div>

      {/* Mode Switcher: Sentence Boundary vs Fixed Slicing */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onSegmentationModeChange?.('sentence')}
          className={cn(
            'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
            segmentationMode === 'sentence'
              ? 'bg-violet-600/30 border-violet-500/60 text-white shadow-sm'
              : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
          )}
        >
          <span className="text-[11px] font-bold">Theo câu trọn vẹn</span>
          <span className="text-[8.5px] opacity-60 leading-tight">
            Khuyên dùng (SpeechSegmenter)
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSegmentationModeChange?.('fixed')}
          className={cn(
            'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
            segmentationMode === 'fixed'
              ? 'bg-amber-600/30 border-amber-500/60 text-white shadow-sm'
              : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
          )}
        >
          <span className="text-[11px] font-bold">Cắt cố định 1.0s</span>
          <span className="text-[8.5px] opacity-60 leading-tight">Rollback (Legacy Fixed)</span>
        </button>
      </div>

      {segmentationMode === 'sentence' ? (
        <div className="space-y-2 pt-1 border-t border-white/[0.05]">
          {/* SILENCE_END_MS */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-white/75">
              <span>Khoảng lặng chốt câu (SILENCE_END_MS):</span>
              <span className="font-mono text-cyan-300">{silenceEndMs}ms</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 300, label: '300ms', sub: 'Nhanh' },
                { val: 400, label: '400ms', sub: 'Chuẩn' },
                { val: 600, label: '600ms', sub: 'Thong thả' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onSilenceEndMsChange?.(item.val)}
                  className={cn(
                    'py-1 px-1.5 rounded text-center transition-all border text-[10px]',
                    silenceEndMs === item.val
                      ? 'bg-cyan-600/30 border-cyan-500/50 text-white font-semibold'
                      : 'bg-white/[0.02] border-white/[0.04] text-white/60 hover:bg-white/[0.05]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAX_SEGMENT_MS */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-white/75">
              <span>Trần câu tối đa (MAX_SEGMENT_MS):</span>
              <span className="font-mono text-emerald-300">
                {(maxSegmentMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 3500, label: '3.5s' },
                { val: 4500, label: '4.5s (Chuẩn)' },
                { val: 6000, label: '6.0s' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onMaxSegmentMsChange?.(item.val)}
                  className={cn(
                    'py-1 px-1.5 rounded text-center transition-all border text-[10px]',
                    maxSegmentMs === item.val
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-white font-semibold'
                      : 'bg-white/[0.02] border-white/[0.04] text-white/60 hover:bg-white/[0.05]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[9px] text-white/40 pt-0.5">
            Chạm trần sẽ tự động tìm điểm năng lượng thấp nhất (valley) trong 1s cuối để tách câu
            mượt mà, không xé từ.
          </p>
        </div>
      ) : (
        <div className="pt-1 border-t border-white/[0.05]">
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            {[
              { val: '0.5', label: '0.5s', sub: 'Nhanh dứt khoát' },
              { val: '0.8', label: '0.8s', sub: 'Chuẩn mặc định' },
              { val: '1.2', label: '1.2s', sub: 'Chậm ngắt quãng' },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => onVadThresholdChange(item.val)}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
                  vadThreshold === item.val
                    ? 'bg-violet-600/25 border-violet-500/50 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <span className="text-[11px] font-bold">{item.label}</span>
                <span className="text-[8.5px] opacity-60 leading-tight">{item.sub}</span>
              </button>
            ))}
          </div>
          <p className="text-[9.5px] text-white/40 pt-1">
            Khoảng lặng âm thanh trước khi hệ thống chốt câu và gửi sang bộ phân tích AI.
          </p>
        </div>
      )}
    </div>
  )
}

