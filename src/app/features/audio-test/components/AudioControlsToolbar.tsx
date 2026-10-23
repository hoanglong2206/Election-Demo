import { useState, useEffect, useRef } from 'react'
import {
  Radio,
  Mic,
  Play,
  Square,
  Volume2,
  VolumeX,
  Download,
  RotateCcw,
  Sparkles,
  Loader2,
  ArrowRight,
  ChevronDown,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AudioMetrics } from '@/core/audio/types'
import type { AudioDeviceInfo } from '@/services/audioDevices'

interface AudioControlsToolbarProps {
  sourceType: 'mic' | 'system'
  setSourceType: (type: 'mic' | 'system') => void
  isCapturing: boolean
  isStarting?: boolean
  isAudioDetected?: boolean
  startCapture: () => Promise<void> | void
  stopCapture: () => void
  isPlaying: boolean
  playBuffer: () => void
  stopPlayback: () => void
  hasBuffer: boolean
  bufferDurationSec: number
  downloadWav: () => void
  clearBuffer: () => void
  onOpenCalibration?: () => void
  calibratedDb?: number | null
  availableDevices?: AudioDeviceInfo[]
  selectedDeviceId?: string
  onSelectDevice?: (deviceId: string) => void
  onEnterMeeting?: () => void
  // Integrated live audio metrics
  volume?: number
  db?: number
  frequencyBands?: number[]
  getAudioMetrics?: () => AudioMetrics
}

export function AudioControlsToolbar({
  sourceType,
  setSourceType,
  isCapturing,
  isStarting = false,
  isAudioDetected = false,
  startCapture,
  stopCapture,
  isPlaying,
  playBuffer,
  stopPlayback,
  hasBuffer,
  bufferDurationSec,
  downloadWav,
  clearBuffer,
  onOpenCalibration,
  calibratedDb,
  availableDevices = [],
  selectedDeviceId,
  onSelectDevice,
  onEnterMeeting,
  volume = 0,
  db = -60,
  frequencyBands,
  getAudioMetrics,
}: AudioControlsToolbarProps) {
  // ── Microphone Device Dropdown Popover State ─────────────────────────────
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false)
  const deviceMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setIsDeviceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedDevice =
    availableDevices.find((d) => d.deviceId === selectedDeviceId) || availableDevices[0]

  // ── High-Performance 60 FPS Visualizer Canvas Loop ──────────────────────
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

      const minHeight = isCapturing ? 2.5 : 1.5
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

        const gap = 2.5
        const barWidth = Math.max(2, (width - (BANDS_COUNT - 1) * gap) / BANDS_COUNT)

        for (let i = 0; i < BANDS_COUNT; i++) {
          const rawVal = metrics.frequencyBands[i] || 0
          const targetH = isCapturing
            ? Math.max(minHeight, (rawVal / 100) * (height - 2))
            : minHeight

          if (targetH >= smoothBands[i]) {
            smoothBands[i] += (targetH - smoothBands[i]) * 0.45
          } else {
            smoothBands[i] = Math.max(minHeight, smoothBands[i] - 1.2)
          }

          if (smoothBands[i] >= peakBands[i]) {
            peakBands[i] = smoothBands[i]
            peakHoldFrames[i] = 12
          } else {
            if (peakHoldFrames[i] > 0) {
              peakHoldFrames[i]--
            } else {
              peakBands[i] = Math.max(smoothBands[i], peakBands[i] - 0.8)
            }
          }

          const x = i * (barWidth + gap)
          const barH = Math.min(height - 1, Math.max(minHeight, smoothBands[i]))
          const y = height - barH

          const grad = ctx.createLinearGradient(0, height, 0, y)
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.4)')
          if (rawVal > 60) {
            grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.85)')
            grad.addColorStop(1, 'rgba(236, 72, 153, 1)')
          } else if (rawVal > 25) {
            grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.85)')
            grad.addColorStop(1, 'rgba(52, 211, 153, 1)')
          } else {
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.85)')
          }

          ctx.fillStyle = grad
          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barH, [1.5, 1.5, 0, 0])
          } else {
            ctx.rect(x, y, barWidth, barH)
          }
          ctx.fill()

          if (peakBands[i] > minHeight + 1) {
            const peakY = Math.max(0, height - peakBands[i] - 1)
            ctx.fillStyle = rawVal > 60 ? '#f472b6' : '#6ee7b7'
            ctx.fillRect(x, peakY, barWidth, 1)
          }
        }

        ctx.restore()
      }

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
        animId = null
        if (dbTextRef.current) dbTextRef.current.textContent = '-60 dBFS'
        if (volTextRef.current) {
          volTextRef.current.textContent = '0% Vol'
          volTextRef.current.className = 'font-semibold font-mono text-[10.5px] tabular-nums inline-block w-[50px] text-left text-white/30'
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
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 shadow-sm space-y-2.5">
      {/* ── ROW 1: Audio Controls & Actions (Fixed non-wrapping flex row) ── */}
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        {/* Left: Source switcher with integrated Microphone device selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/[0.08] shadow-inner">
            {/* System Audio Toggle */}
            <button
              type="button"
              id="btn-source-system"
              onClick={() => !isCapturing && setSourceType('system')}
              disabled={isCapturing}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
                sourceType === 'system'
                  ? 'bg-violet-600/35 text-violet-200 border border-violet-500/40 shadow-sm font-semibold'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
              )}
              title="Thu âm loopback từ video YouTube, cuộc gọi hoặc âm thanh hệ thống"
            >
              <Radio className="w-3.5 h-3.5 text-violet-400" />
              <span>System Audio</span>
            </button>

            {/* Microphone Toggle with integrated Device Select Popover */}
            <div className="relative flex items-center" ref={deviceMenuRef}>
              <button
                type="button"
                id="btn-source-mic"
                onClick={() => {
                  if (!isCapturing) {
                    setSourceType('mic')
                  }
                }}
                disabled={isCapturing}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
                  sourceType === 'mic'
                    ? 'bg-emerald-600/35 text-emerald-200 border border-emerald-500/40 shadow-sm font-semibold'
                    : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                )}
                title={
                  selectedDevice
                    ? `Microphone: ${selectedDevice.label} (Bấm mũi tên để đổi thiết bị)`
                    : 'Thu âm trực tiếp từ microphone'
                }
              >
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>Microphone</span>

                {availableDevices.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsDeviceMenuOpen(!isDeviceMenuOpen)
                    }}
                    className="ml-0.5 p-0.5 hover:text-emerald-200 text-emerald-400/70 transition-colors"
                    title="Đổi thiết bị microphone"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform duration-200',
                        isDeviceMenuOpen && 'rotate-180'
                      )}
                    />
                  </span>
                )}
              </button>

              {/* Clean Microphone Selector Dropdown */}
              {isDeviceMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[220px] max-w-[280px] space-y-0.5 animate-fade-in">
                  <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider flex items-center justify-between">
                    <span>Chọn Microphone</span>
                    <span className="text-[9px] text-white/20 font-mono">
                      {availableDevices.length} thiết bị
                    </span>
                  </div>
                  {availableDevices.map((dev) => (
                    <button
                      key={dev.deviceId}
                      type="button"
                      onClick={() => {
                        onSelectDevice?.(dev.deviceId)
                        setIsDeviceMenuOpen(false)
                      }}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors',
                        selectedDeviceId === dev.deviceId
                          ? 'bg-emerald-500/20 text-emerald-200 font-medium'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span className="truncate">{dev.label}</span>
                      {selectedDeviceId === dev.deviceId && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Primary Capture CTA & Fixed-width Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Main Record CTA Button with fixed width to eliminate layout shift */}
          {!isCapturing ? (
            <Button
              id="btn-start-capture"
              onClick={() => {
                const res = startCapture()
                if (res && typeof (res as Promise<void>).catch === 'function') {
                  ;(res as Promise<void>).catch(() => {})
                }
              }}
              disabled={isStarting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11.5px] h-8 w-[122px] justify-center gap-1.5 shadow-sm font-semibold transition-all disabled:opacity-50 shrink-0"
            >
              {isStarting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white" />
              )}
              <span>{isStarting ? 'Đang mở...' : 'Start Capture'}</span>
            </Button>
          ) : (
            <Button
              id="btn-stop-capture"
              onClick={stopCapture}
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-500 text-white text-[11.5px] h-8 w-[122px] justify-center gap-1.5 shadow-sm font-semibold transition-all animate-pulse shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop Capture</span>
            </Button>
          )}

          {/* Auto Calibrate VAD Button */}
          {onOpenCalibration && (
            <Button
              id="btn-auto-calibrate-vad"
              type="button"
              onClick={onOpenCalibration}
              variant="outline"
              size="sm"
              title="Đo độ ồn nền & tự động hiệu chuẩn ngưỡng VAD"
              className="h-8 px-2.5 text-[11px] border-violet-500/40 text-violet-300 hover:bg-violet-500/15 gap-1.5 transition-all shadow-sm bg-violet-500/5 font-medium shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Auto Calibrate</span>
              {calibratedDb != null && (
                <span className="text-[10px] bg-violet-500/25 px-1.5 py-0.5 rounded font-mono text-violet-200 border border-violet-500/30">
                  {calibratedDb}dB
                </span>
              )}
            </Button>
          )}

          {/* Fixed-layout Playback & Buffer Tools (Zero Width Jump) */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
            {isPlaying ? (
              <Button
                onClick={stopPlayback}
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-[11px] text-amber-300 hover:bg-amber-500/15 gap-1 shrink-0"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Dừng</span>
              </Button>
            ) : (
              <Button
                id="btn-play-buffer"
                onClick={playBuffer}
                disabled={!hasBuffer}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-[11px] gap-1 transition-all shrink-0',
                  hasBuffer
                    ? 'text-white/90 hover:bg-white/10'
                    : 'text-white/30 cursor-not-allowed'
                )}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Nghe ({bufferDurationSec ? `${bufferDurationSec}s` : '0s'})</span>
              </Button>
            )}

            <Button
              onClick={downloadWav}
              disabled={!hasBuffer}
              variant="ghost"
              size="icon"
              title="Tải file WAV 16kHz"
              className={cn(
                'w-7 h-7 rounded text-white/60 hover:text-white',
                !hasBuffer &&
                  'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-white/60'
              )}
            >
              <Download className="w-3 h-3" />
            </Button>

            <Button
              onClick={clearBuffer}
              disabled={!hasBuffer}
              variant="ghost"
              size="icon"
              title="Xóa bộ đệm âm thanh"
              className={cn(
                'w-7 h-7 rounded text-white/40 hover:text-rose-400',
                !hasBuffer &&
                  'opacity-25 cursor-not-allowed hover:bg-transparent hover:text-white/40'
              )}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>

          {/* Enter Meeting Button */}
          {onEnterMeeting && (
            <Button
              id="btn-enter-meeting"
              type="button"
              onClick={onEnterMeeting}
              className="bg-violet-600 hover:bg-violet-500 text-white text-[11.5px] h-8 px-3 gap-1.5 shadow-sm font-medium transition-all shrink-0"
              title="Bắt đầu phiên họp với microphone và ngưỡng VAD đã hiệu chuẩn"
            >
              <span>Vào phòng họp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── ROW 2: Stable Integrated Live Visualizer & Signal Meter (Zero Jitter) ── */}
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
    </div>
  )
}
