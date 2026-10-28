export interface CalibrationCountdownStepProps {
  countdown: number
}

export function CalibrationCountdownStep({ countdown }: CalibrationCountdownStepProps) {
  return (
    <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-violet-600/20 border-2 border-violet-500/40 flex items-center justify-center shadow-lg shadow-violet-500/10 animate-pulse">
        <span className="text-4xl font-extrabold text-violet-300 font-mono tracking-tighter">
          {countdown}
        </span>
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-white">Chuẩn bị giữ im lặng</h4>
        <p className="text-xs text-white/50 max-w-xs mx-auto">
          Quá trình đo độ ồn nền 3 giây sẽ bắt đầu sau giây lát...
        </p>
      </div>
    </div>
  )
}
