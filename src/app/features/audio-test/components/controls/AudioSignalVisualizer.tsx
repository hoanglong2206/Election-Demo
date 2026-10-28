import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { AudioMetrics } from '@/core/audio/types'
import { renderSpectrumFrame } from '../../utils/visualizerCanvas'

export interface AudioSignalVisualizerProps {
  isCapturing: boolean
  isAudioDetected?: boolean
  volume?: number
  db?: number
  frequencyBands?: number[]
  getAudioMetrics?: () => AudioMetrics
}

export function AudioSignalVisualizer({
  isCapturing,
  isAudioDetected = false,
  volume = 0,
  db = -60,
  frequencyBands,
  getAudioMetrics,
}: AudioSignalVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dbTextRef = useRef<HTMLSpanElement | null>(null)
  const volTextRef = useRef<HTMLSpanElement | null>(null)
  const volBarRef = useRef<HTMLDivElement | null>(null)

  const getAudioMetricsRef = useRef(getAudioMetrics)
  const fallbackPropsRef = useRef({ volume, db, frequencyBands, isAudioDetected })

  useEffect(() => {
    getAudioMetricsRef.current = getAudioMetrics
    fallbackPropsRef.current = { volume, db, frequencyBands, isAudioDetected }
  })

  useEffect(() => {
    let animId: number | null = null
    const canvas = canvasRef.current
    if (!canvas) return

    const BANDS_COUNT = 24
    const smoothBands = new Float32Array(BANDS_COUNT)
    const peakBands = new Float32Array(BANDS_COUNT)
    const peakHoldFrames = new Uint8Array(BANDS_COUNT)
    let frameCounter = 0

    const render = () => {
      const metrics: AudioMetrics = getAudioMetricsRef.current
        ? getAudioMetricsRef.current()
        : {
            volume: fallbackPropsRef.current.volume,
            db: fallbackPropsRef.current.db,
            frequencyBands:
              fallbackPropsRef.current.frequencyBands || new Array(BANDS_COUNT).fill(0),
            isAudioDetected: fallbackPropsRef.current.isAudioDetected,
          }

      frameCounter++
      if (frameCounter % 5 === 0) {
        if (dbTextRef.current) {
          dbTextRef.current.textContent = `${metrics.db} dBFS`
        }
        if (volTextRef.current) {
          volTextRef.current.textContent = `${metrics.volume}% Vol`
          volTextRef.current.className = cn(
            'font-semibold font-mono text-[10.5px] tabular-nums inline-block w-[50px] text-left',
            metrics.volume > 0 ? 'text-emerald-400' : 'text-white/30'
          )
        }
        if (volBarRef.current) {
          volBarRef.current.style.width = `${Math.min(100, metrics.volume)}%`
          volBarRef.current.className = cn(
            'h-full rounded-full transition-all duration-75',
            metrics.volume > 70
              ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500'
              : metrics.volume > 25
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
              : 'bg-emerald-500/80'
          )
        }
      }

      const isAnimating = renderSpectrumFrame({
        canvas,
        metricsBands: metrics.frequencyBands,
        smoothBands,
        peakBands,
        peakHoldFrames,
        isCapturing,
        bandsCount: BANDS_COUNT,
      })

      if (isAnimating) {
        animId = requestAnimationFrame(render)
      } else {
        animId = null
        if (dbTextRef.current) dbTextRef.current.textContent = '-60 dBFS'
        if (volTextRef.current) {
          volTextRef.current.textContent = '0% Vol'
          volTextRef.current.className =
            'font-semibold font-mono text-[10.5px] tabular-nums inline-block w-[50px] text-left text-white/30'
        }
        if (volBarRef.current) volBarRef.current.style.width = '0%'
      }
    }

    animId = requestAnimationFrame(render)

    return () => {
      if (animId) {
        cancelAnimationFrame(animId)
        animId = null
      }
    }
  }, [isCapturing])

  return (
    <div className="bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 flex items-center justify-between gap-3 shadow-inner">
      {/* Left Status & Engine Badges with strictly fixed text width */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-2 h-2 rounded-full transition-colors shrink-0',
              isCapturing
                ? isAudioDetected
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-amber-400'
                : 'bg-white/20'
            )}
          />
          <span
            className={cn(
              'text-[11px] font-medium w-[105px] truncate select-none',
              isCapturing
                ? isAudioDetected
                  ? 'text-emerald-300 font-semibold'
                  : 'text-amber-200/90'
                : 'text-white/70'
            )}
          >
            {isCapturing
              ? isAudioDetected
                ? 'Đang có âm thanh'
                : 'Chờ âm thanh...'
              : 'Sẵn sàng thu'}
          </span>
        </div>
      </div>

      {/* Center: Live 60 FPS Visualizer Spectrum & Volume VU bar */}
      <div className="flex-1 max-w-2xl mx-1 flex flex-col gap-1 min-w-[100px]">
        {/* Canvas Spectrum Visualizer */}
        <div className="w-full h-5 overflow-hidden flex items-center">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* VU Volume Track */}
        <div className="w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
          <div
            ref={volBarRef}
            className="h-full rounded-full bg-emerald-400 transition-all duration-75"
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Right: Real-time Telemetry Readout with fixed tabular-nums width */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 font-mono text-[11px] w-[130px] text-right">
        <span ref={dbTextRef} className="text-white/45 tabular-nums inline-block w-[60px] text-right">
          {db} dBFS
        </span>
        <span className="text-white/20">•</span>
        <span
          ref={volTextRef}
          className={cn(
            'font-semibold text-[10.5px] tabular-nums inline-block w-[50px] text-left',
            volume > 0 ? 'text-emerald-400' : 'text-white/30'
          )}
        >
          {volume}% Vol
        </span>
      </div>
    </div>
  )
}
