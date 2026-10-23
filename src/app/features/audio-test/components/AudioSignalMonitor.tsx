import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AudioMetrics } from '../../../core/audio/types'

export interface AudioSignalMonitorProps {
  volume?: number
  db?: number
  frequencyBands?: number[]
  isAudioDetected?: boolean
  isCapturing: boolean
  getAudioMetrics?: () => AudioMetrics
  getAnalyser?: () => AnalyserNode | null
}

/**
 * High-Performance Decoupled Audio Signal Monitor & Visualizer
 *
 * Runs an independent 60 FPS requestAnimationFrame canvas rendering loop
 * completely outside React state to maintain buttery smooth visualizer performance
 * without triggering component re-renders or stealing CPU cycles from C++ Whisper STT.
 */
export function AudioSignalMonitor({
  volume = 0,
  db = -60,
  frequencyBands,
  isAudioDetected = false,
  isCapturing,
  getAudioMetrics,
}: AudioSignalMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dbTextRef = useRef<HTMLSpanElement | null>(null)
  const volTextRef = useRef<HTMLSpanElement | null>(null)
  const volBarRef = useRef<HTMLDivElement | null>(null)
  const badgeContainerRef = useRef<HTMLDivElement | null>(null)

  // Stable reference to metrics getter to avoid re-binding rAF loop
  const getAudioMetricsRef = useRef(getAudioMetrics)

  // Stable references to fallback props
  const fallbackPropsRef = useRef({ volume, db, frequencyBands, isAudioDetected })

  useEffect(() => {
    getAudioMetricsRef.current = getAudioMetrics
    fallbackPropsRef.current = { volume, db, frequencyBands, isAudioDetected }
  })

  useEffect(() => {
    let animId: number | null = null
    const canvas = canvasRef.current
    if (!canvas) return

    // Pre-allocated smoothing arrays (0 allocation during rendering loop)
    const BANDS_COUNT = 16
    const smoothBands = new Float32Array(BANDS_COUNT)
    const peakBands = new Float32Array(BANDS_COUNT)
    const peakHoldFrames = new Uint8Array(BANDS_COUNT)
    let frameCounter = 0

    const render = () => {
      // ── 1. Acquire Telemetry without React setState ──────────────────────
      const metrics: AudioMetrics = getAudioMetricsRef.current
        ? getAudioMetricsRef.current()
        : {
            volume: fallbackPropsRef.current.volume,
            db: fallbackPropsRef.current.db,
            frequencyBands:
              fallbackPropsRef.current.frequencyBands || new Array(BANDS_COUNT).fill(0),
            isAudioDetected: fallbackPropsRef.current.isAudioDetected,
          }

      // ── 2. Direct DOM Telemetry (throttled every 6 frames ~10 FPS for readability) ─
      frameCounter++
      if (frameCounter % 6 === 0) {
        if (dbTextRef.current) {
          dbTextRef.current.textContent = `${metrics.db} dBFS`
        }
        if (volTextRef.current) {
          volTextRef.current.textContent = `${metrics.volume}%`
          volTextRef.current.className = cn(
            'font-semibold font-mono',
            metrics.volume > 0 ? 'text-emerald-400' : 'text-white/30'
          )
        }
        if (volBarRef.current) {
          volBarRef.current.style.width = `${Math.min(100, metrics.volume)}%`
          volBarRef.current.className = cn(
            'h-full rounded-full transition-all duration-75',
            metrics.volume > 75
              ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500'
              : metrics.volume > 30
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : 'bg-emerald-500/80'
          )
        }
        if (badgeContainerRef.current) {
          badgeContainerRef.current.style.display = metrics.isAudioDetected
            ? 'inline-flex'
            : 'none'
        }
      }

      // ── 3. High-DPI 60 FPS Canvas Rendering Loop ──────────────────────────
      const minHeight = isCapturing ? 3 : 2
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        const width = rect.width
        const height = rect.height

        const targetW = Math.max(1, Math.floor(width * dpr))
        const targetH = Math.max(1, Math.floor(height * dpr))
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }

        ctx.save()
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        const gap = 3
        const barWidth = Math.max(2, (width - (BANDS_COUNT - 1) * gap) / BANDS_COUNT)

        for (let i = 0; i < BANDS_COUNT; i++) {
          const rawVal = metrics.frequencyBands[i] || 0
          const targetH = isCapturing
            ? Math.max(minHeight, (rawVal / 100) * (height - 3))
            : minHeight

          // Fluid spring interpolation (lerp / gravity)
          if (targetH >= smoothBands[i]) {
            smoothBands[i] += (targetH - smoothBands[i]) * 0.4
          } else {
            smoothBands[i] = Math.max(minHeight, smoothBands[i] - 1.2)
          }

          // Studio peak meter indicator holding
          if (smoothBands[i] >= peakBands[i]) {
            peakBands[i] = smoothBands[i]
            peakHoldFrames[i] = 12 // hold for ~190ms
          } else {
            if (peakHoldFrames[i] > 0) {
              peakHoldFrames[i]--
            } else {
              peakBands[i] = Math.max(smoothBands[i], peakBands[i] - 0.9)
            }
          }

          const x = i * (barWidth + gap)
          const barH = Math.min(height - 1, Math.max(minHeight, smoothBands[i]))
          const y = height - barH

          // Dynamic gradient based on frequency intensity
          const grad = ctx.createLinearGradient(0, height, 0, y)
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)') // Emerald base
          if (rawVal > 60) {
            grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.85)') // Violet body
            grad.addColorStop(1, 'rgba(236, 72, 153, 1)')      // Magenta top
          } else if (rawVal > 25) {
            grad.addColorStop(0.7, 'rgba(52, 211, 153, 0.85)')
            grad.addColorStop(1, 'rgba(52, 211, 153, 1)')
          } else {
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.75)')
          }

          ctx.fillStyle = grad
          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0])
          } else {
            ctx.rect(x, y, barWidth, barH)
          }
          ctx.fill()

          // Peak cap line
          if (peakBands[i] > minHeight + 1) {
            const peakY = Math.max(0, height - peakBands[i] - 1.5)
            ctx.fillStyle = rawVal > 60 ? '#d8b4fe' : '#6ee7b7'
            ctx.fillRect(x, peakY, barWidth, 1.2)
          }
        }

        ctx.restore()
      }

      // Continue animation frame while capturing or during bar decay
      let isAnimating = isCapturing
      if (!isAnimating) {
        for (let i = 0; i < BANDS_COUNT; i++) {
          if (smoothBands[i] > minHeight + 0.5) {
            isAnimating = true
            break
          }
        }
      }

      if (isAnimating) {
        animId = requestAnimationFrame(render)
      } else {
        // Clear when settled
        animId = null
        if (dbTextRef.current) dbTextRef.current.textContent = '-60 dBFS'
        if (volTextRef.current) {
          volTextRef.current.textContent = '0%'
          volTextRef.current.className = 'font-semibold font-mono text-white/30'
        }
        if (volBarRef.current) volBarRef.current.style.width = '0%'
        if (badgeContainerRef.current) badgeContainerRef.current.style.display = 'none'
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
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-white/70 font-medium">
            Tín hiệu âm lượng đầu ra (Output Audio Level)
          </span>
          <div ref={badgeContainerRef} style={{ display: isAudioDetected ? 'inline-flex' : 'none' }}>
            <Badge className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-1.5 py-0 animate-pulse">
              Phát hiện âm thanh YouTube/Call
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span ref={dbTextRef} className="text-white/40">
            {db} dBFS
          </span>
          <span
            ref={volTextRef}
            className={cn('font-semibold', volume > 0 ? 'text-emerald-400' : 'text-white/30')}
          >
            {volume}%
          </span>
        </div>
      </div>

      {/* Volume Bar */}
      <div className="w-full bg-white/[0.05] h-2 rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
        <div
          ref={volBarRef}
          className={cn(
            'h-full rounded-full transition-all duration-75',
            volume > 75
              ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500'
              : volume > 30
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : 'bg-emerald-500/80'
          )}
          style={{ width: `${Math.min(100, volume)}%` }}
        />
      </div>

      {/* 16-band Equalizer Visualizer (Canvas 60 FPS) */}
      <div className="w-full h-8 pt-0.5 px-0.5 bg-black/20 rounded-md overflow-hidden flex items-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>
    </div>
  )
}
