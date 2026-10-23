import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sparkles,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Sliders,
  ShieldAlert,
  Info,
  X,
  Mic,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AudioMetrics } from '../../../core/audio/types'
import {
  analyzeCalibrationAudio,
  saveVADCalibration,
  VADCalibrationGuardError,
  type EnvironmentQuality,
  type VADCalibrationRecord,
  type VADCalibrationResult,
} from '../../../services/vad-calibration'
import { getSavedAudioDeviceId } from '../../../services/audioDevices'

type CalibrationStep = 'idle' | 'countdown' | 'sampling' | 'analyzed' | 'guard_error'

interface VADCalibrationModalProps {
  isOpen: boolean
  onClose: () => void
  activeDeviceId?: string
  activeDeviceName?: string
  getAudioMetrics: () => AudioMetrics
  startCapture: () => Promise<void>
  stopCapture: () => void
  isCapturing: boolean
  sourceType: 'mic' | 'system'
  setSourceType: (type: 'mic' | 'system') => void
  getRecentPcmSamples: (seconds?: number) => Int16Array
  setVadEnergyThreshold: (threshold: number) => void
  onCalibrated?: (record: VADCalibrationRecord) => void
}

export function VADCalibrationModal({
  isOpen,
  onClose,
  activeDeviceId,
  activeDeviceName,
  getAudioMetrics,
  startCapture,
  stopCapture,
  isCapturing,
  sourceType,
  setSourceType,
  getRecentPcmSamples,
  setVadEnergyThreshold,
  onCalibrated,
}: VADCalibrationModalProps) {
  const [step, setStep] = useState<CalibrationStep>('idle')
  const [countdown, setCountdown] = useState(3)
  const [samplingProgress, setSamplingProgress] = useState(0) // 0 to 100
  const [safetyMarginDb, setSafetyMarginDb] = useState<number>(6.0) // Configurable safety margin
  const [calibrationResult, setCalibrationResult] = useState<VADCalibrationResult | null>(null)
  const [guardErrorMessage, setGuardErrorMessage] = useState<string | null>(null)

  // Real-time animation canvas & DOM telemetry
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const currentDbSpanRef = useRef<HTMLSpanElement | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const samplingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const wasCapturingBeforeCalibrationRef = useRef(false)
  const CALIBRATION_DURATION_SEC = 3.0

  const deviceId = activeDeviceId || getSavedAudioDeviceId() || 'default-mic'
  const deviceDisplayName = activeDeviceName || (deviceId.includes('default') ? 'Microphone mặc định' : deviceId)

  // Clean up all timers & animations on close
  const cleanupTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    if (samplingTimerRef.current) {
      clearInterval(samplingTimerRef.current)
      samplingTimerRef.current = null
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
  }, [])

  const handleModalClose = useCallback(() => {
    cleanupTimers()
    if (!wasCapturingBeforeCalibrationRef.current && isCapturing) {
      stopCapture()
    }
    onClose()
  }, [cleanupTimers, isCapturing, stopCapture, onClose])

  useEffect(() => {
    if (isOpen) {
      wasCapturingBeforeCalibrationRef.current = isCapturing
    } else {
      cleanupTimers()
      setTimeout(() => {
        setStep('idle')
        setSamplingProgress(0)
        setGuardErrorMessage(null)
      }, 0)
    }
  }, [isOpen, cleanupTimers, isCapturing])

  // ── 60 FPS Canvas Visualizer during Sampling ─────────────────────────────────
  useEffect(() => {
    if (step !== 'sampling') {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
        animFrameIdRef.current = null
      }
      return
    }

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

      // Draw real-time ambient noise wave
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      // Background subtle grid
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)'
      ctx.fillRect(0, 0, width, height)

      // Frequency bands or simulated energy bar
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

      animFrameIdRef.current = requestAnimationFrame(render)
    }

    animFrameIdRef.current = requestAnimationFrame(render)

    return () => {
      isRunning = false
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
        animFrameIdRef.current = null
      }
    }
  }, [step, getAudioMetrics])

  // ── Start Calibration Flow ──────────────────────────────────────────────────
  const handleBeginCalibration = async () => {
    cleanupTimers()
    setGuardErrorMessage(null)
    setCalibrationResult(null)
    setStep('countdown')
    setCountdown(3)

    // Ensure audio pipeline is switched to microphone and capturing
    if (sourceType !== 'mic') {
      setSourceType('mic')
    }
    if (!isCapturing) {
      try {
        await startCapture()
      } catch (err) {
        console.error('[VADCalibrationModal] Failed to start audio capture:', err)
        setGuardErrorMessage('Không thể mở microphone để đo âm thanh. Vui lòng cấp quyền micro.')
        setStep('guard_error')
        return
      }
    }

    // 3-second countdown
    let remaining = 3
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
        }
        startSampling()
      }
    }, 1000)
  }

  // ── Analyze Audio & Outlier Detection ───────────────────────────────────────
  const finishSamplingAndAnalyze = useCallback(() => {
    try {
      // Extract exact 16kHz PCM samples recorded during the 3.0s window
      const pcm16 = getRecentPcmSamples(CALIBRATION_DURATION_SEC)

      const result = analyzeCalibrationAudio(pcm16, deviceId, deviceDisplayName, {
        durationSec: CALIBRATION_DURATION_SEC,
        safetyMarginDb,
      })

      setCalibrationResult(result)
      setStep('analyzed')
    } catch (err: unknown) {
      console.warn('[VADCalibrationModal] Guard triggered:', err)
      if (err instanceof VADCalibrationGuardError) {
        setGuardErrorMessage(err.message)
      } else {
        setGuardErrorMessage(
          err instanceof Error
            ? err.message
            : 'Đã xảy ra lỗi không xác định khi phân tích âm thanh nền.'
        )
      }
      setStep('guard_error')
    }
  }, [getRecentPcmSamples, deviceId, deviceDisplayName, safetyMarginDb])

  // ── Sampling 3.0 Seconds ────────────────────────────────────────────────────
  const startSampling = useCallback(() => {
    setStep('sampling')
    setSamplingProgress(0)
    startTimeRef.current = performance.now()

    samplingTimerRef.current = setInterval(() => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      const progress = Math.min(100, Math.round((elapsed / CALIBRATION_DURATION_SEC) * 100))
      setSamplingProgress(progress)

      if (elapsed >= CALIBRATION_DURATION_SEC) {
        cleanupTimers()
        finishSamplingAndAnalyze()
      }
    }, 50)
  }, [cleanupTimers, finishSamplingAndAnalyze])

  // ── Accept & Apply Calibrated Threshold ──────────────────────────────────────
  const handleAcceptCalibration = () => {
    if (!calibrationResult) return

    // 1. Persist calibration keyed by deviceId
    const record = saveVADCalibration(calibrationResult)

    // 2. Set dynamic threshold on audio pipeline immediately
    setVadEnergyThreshold(calibrationResult.speechThresholdRms)

    // 3. Callback parent
    onCalibrated?.(record)

    cleanupTimers()
    onClose()
  }

  if (!isOpen) return null

  const getQualityBadge = (quality: EnvironmentQuality) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                Tự Động Cân Chỉnh VAD
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono border border-violet-500/20">
                  Noise Floor Auto-Calibration
                </span>
              </h3>
              <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                <Mic className="w-3 h-3 text-white/40" />
                Thiết bị: <span className="text-white/80 font-medium truncate max-w-[220px]">{deviceDisplayName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* ── STEP: IDLE ──────────────────────────────────────────────────────── */}
          {step === 'idle' && (
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
                      onClick={() => setSafetyMarginDb(item.val)}
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
          )}

          {/* ── STEP: COUNTDOWN ──────────────────────────────────────────────────── */}
          {step === 'countdown' && (
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
          )}

          {/* ── STEP: SAMPLING ──────────────────────────────────────────────────── */}
          {step === 'sampling' && (
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
          )}

          {/* ── STEP: ANALYZED ──────────────────────────────────────────────────── */}
          {step === 'analyzed' && calibrationResult && (
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
          )}

          {/* ── STEP: GUARD ERROR ────────────────────────────────────────────────── */}
          {step === 'guard_error' && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-rose-300">Không thể hiệu chuẩn VAD</h4>
                  <p className="text-[11.5px] text-rose-200/80 mt-1 leading-relaxed">
                    {guardErrorMessage || 'Môi trường phòng không đáp ứng điều kiện đo độ ồn nền.'}
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
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          {step === 'idle' && (
            <>
              <Button
                variant="ghost"
                onClick={handleModalClose}
                className="text-white/60 hover:text-white hover:bg-white/5 text-xs h-9 px-4"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleBeginCalibration}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-9 px-5 gap-2 shadow-lg shadow-violet-600/20 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bắt đầu đo độ ồn (3s)</span>
              </Button>
            </>
          )}

          {(step === 'countdown' || step === 'sampling') && (
            <div className="w-full flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  cleanupTimers()
                  if (!wasCapturingBeforeCalibrationRef.current && isCapturing) {
                    stopCapture()
                  }
                  setStep('idle')
                }}
                className="text-xs border-white/10 text-white/60 hover:bg-white/5 h-8 px-3"
              >
                Hủy đo
              </Button>
            </div>
          )}

          {step === 'analyzed' && (
            <>
              <Button
                variant="outline"
                onClick={handleBeginCalibration}
                className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-3 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đo lại</span>
              </Button>
              <Button
                onClick={handleAcceptCalibration}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-5 gap-2 font-medium shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Áp dụng cấu hình</span>
              </Button>
            </>
          )}

          {step === 'guard_error' && (
            <>
              <Button
                variant="ghost"
                onClick={handleModalClose}
                className="text-white/60 hover:text-white hover:bg-white/5 text-xs h-9 px-4"
              >
                Đóng
              </Button>
              <Button
                onClick={handleBeginCalibration}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-9 px-4 gap-1.5 font-medium shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
