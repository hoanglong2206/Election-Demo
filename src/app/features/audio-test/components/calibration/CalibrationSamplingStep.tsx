import { useEffect, useRef } from 'react'
import type { AudioMetrics } from '@/core/audio/types'

export interface CalibrationSamplingStepProps {
  samplingProgress: number
  getAudioMetrics: () => AudioMetrics
}

export function CalibrationSamplingStep({
  samplingProgress,
  getAudioMetrics,
}: CalibrationSamplingStepProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const currentDbSpanRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    let animFrameId: number | null = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isRunning = true

    const render = () => {
      if (!isRunning) return

      const metrics = getAudioMetrics()
      if (currentDbSpanRef.current) {
        currentDbSpanRef.current.textContent = `${metrics.db} dBFS`
      }

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      // Background subtle grid
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)'
      ctx.fillRect(0, 0, width, height)

      // Frequency bands
      const bands = metrics.frequencyBands || []
      const barWidth = width / Math.max(1, bands.length)

      for (let i = 0; i < bands.length; i++) {
        const val = (bands[i] || 0) / 100
        const barHeight = Math.max(2, val * (height - 10))
        const x = i * barWidth
        const y = height - barHeight

        const grad = ctx.createLinearGradient(0, height, 0, 0)
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.4)')
        grad.addColorStop(0.5, 'rgba(129, 140, 248, 0.8)')
        grad.addColorStop(1, val > 0.6 ? 'rgba(244, 63, 94, 0.9)' : 'rgba(168, 85, 247, 0.9)')

        ctx.fillStyle = grad
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
      }

      animFrameId = requestAnimationFrame(render)
    }

    animFrameId = requestAnimationFrame(render)

    return () => {
      isRunning = false
      if (animFrameId) {
        cancelAnimationFrame(animFrameId)
      }
    }
  }, [getAudioMetrics])

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70 font-medium flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          Đang thu mẫu tiếng ồn nền (Vui lòng không nói)...
        </span>
        <span ref={currentDbSpanRef} className="font-mono font-bold text-violet-400 text-sm">
          -60.0 dBFS
        </span>
      </div>

      {/* Waveform Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-inner">
        <canvas ref={canvasRef} width={460} height={90} className="w-full h-[90px] block" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-white/40">
          Live 50ms Frames
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-white/50">
          <span>Tiến độ phân tích</span>
          <span className="font-mono text-white/80">{samplingProgress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-75 ease-out rounded-full"
            style={{ width: `${samplingProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
