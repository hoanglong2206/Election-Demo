import { ShieldAlert } from 'lucide-react'

export interface CalibrationErrorStepProps {
  errorMessage: string | null
}

export function CalibrationErrorStep({ errorMessage }: CalibrationErrorStepProps) {
  return (
    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-rose-300">Không thể hiệu chuẩn VAD</h4>
          <p className="text-[11.5px] text-rose-200/80 mt-1 leading-relaxed">
            {errorMessage || 'Môi trường phòng không đáp ứng điều kiện đo độ ồn nền.'}
          </p>
        </div>
      </div>

      <div className="text-[11px] text-white/50 bg-black/30 p-2.5 rounded-lg border border-white/5 space-y-1">
        <span className="font-medium text-white/70 block">Gợi ý khắc phục:</span>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Không nói chuyện hoặc tằng hắng trong 3 giây hiệu chuẩn.</li>
          <li>Nếu phòng có quạt gió hướng thẳng vào mic, hãy quay micro ra hướng khác.</li>
          <li>Kiểm tra xem microphone có bị boost volume quá mức trong Windows Sound Settings không.</li>
        </ul>
      </div>
    </div>
  )
}
