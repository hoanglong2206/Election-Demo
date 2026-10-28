import { Volume2, Sliders, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CalibrationIdleStepProps {
  safetyMarginDb: number
  onSelectSafetyMarginDb: (margin: number) => void
}

export function CalibrationIdleStep({
  safetyMarginDb,
  onSelectSafetyMarginDb,
}: CalibrationIdleStepProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/70 space-y-2">
        <p className="font-medium text-white/90 flex items-center gap-1.5 text-[13px]">
          <Volume2 className="w-4 h-4 text-violet-400" />
          Nguyên lý hoạt động:
        </p>
        <p>
          Hệ thống sẽ ghi âm <strong className="text-white">3 giây</strong> trong trạng thái hoàn toàn yên tĩnh để đo đạc phổ ồn nền của phòng và độ nhạy riêng của microphone này.
        </p>
        <ul className="list-disc list-inside space-y-1 text-white/60 text-[11.5px] pl-1">
          <li>Tự động loại bỏ tiếng gõ phím, click chuột đột ngột bằng thuật toán phân vị IQR.</li>
          <li>Tính toán ngưỡng kích hoạt câu nói tối ưu, ngăn ngừa mất âm đầu câu hoặc kích hoạt nhầm khi im lặng.</li>
          <li>Lưu cấu hình riêng theo mã phần cứng của microphone này.</li>
        </ul>
      </div>

      {/* Safety Margin Config */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            Độ lệch an toàn (Safety Margin):
          </label>
          <span className="text-[12px] font-mono text-violet-300 font-semibold">
            +{safetyMarginDb} dB
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Nhạy cao (+3 dB)', val: 3.0, desc: 'Phòng rất yên tĩnh' },
            { label: 'Cân bằng (+6 dB)', val: 6.0, desc: 'Khuyên dùng' },
            { label: 'Chống ồn (+9 dB)', val: 9.0, desc: 'Phòng nhiều tạp âm' },
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => onSelectSafetyMarginDb(item.val)}
              className={cn(
                'px-2.5 py-2 rounded-xl text-left border transition-all text-[11px] flex flex-col justify-between',
                safetyMarginDb === item.val
                  ? 'bg-violet-600/25 border-violet-500/50 text-white shadow-sm'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.05] hover:text-white/80'
              )}
            >
              <span className="font-medium text-white/90">{item.label}</span>
              <span className="text-[10px] text-white/40 mt-0.5">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/80">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Trước khi ấn Bắt đầu, vui lòng <strong>ngừng nói chuyện</strong> và giữ căn phòng trong trạng thái im lặng bình thường như khi bạn lắng nghe đối tác.
        </span>
      </div>
    </div>
  )
}
