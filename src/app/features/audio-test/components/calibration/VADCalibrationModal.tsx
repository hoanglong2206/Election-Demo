import { Sparkles, RotateCcw, X, Mic, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AudioMetrics } from '@/core/audio/types'
import type { VADCalibrationRecord } from '@/services/vad-calibration'
import { useVADCalibration } from '../../hooks/useVADCalibration'
import { CalibrationIdleStep } from './CalibrationIdleStep'
import { CalibrationCountdownStep } from './CalibrationCountdownStep'
import { CalibrationSamplingStep } from './CalibrationSamplingStep'
import { CalibrationResultStep } from './CalibrationResultStep'
import { CalibrationErrorStep } from './CalibrationErrorStep'

export interface VADCalibrationModalProps {
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

export function VADCalibrationModal(props: VADCalibrationModalProps) {
  const {
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
  } = props

  const {
    state,
    beginCalibration,
    cancelCalibration,
    closeModal,
    acceptCalibration,
    setSafetyMarginDb,
  } = useVADCalibration({
    isOpen,
    activeDeviceId,
    activeDeviceName,
    isCapturing,
    sourceType,
    setSourceType,
    startCapture,
    stopCapture,
    getRecentPcmSamples,
    setVadEnergyThreshold,
    onCalibrated,
    onClose,
  })

  if (!isOpen) return null

  const deviceDisplayName =
    activeDeviceName || (activeDeviceId?.includes('default') ? 'Microphone mặc định' : activeDeviceId || 'Microphone')

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
            onClick={closeModal}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {state.step === 'idle' && (
            <CalibrationIdleStep
              safetyMarginDb={state.safetyMarginDb}
              onSelectSafetyMarginDb={setSafetyMarginDb}
            />
          )}

          {state.step === 'countdown' && (
            <CalibrationCountdownStep countdown={state.countdown} />
          )}

          {state.step === 'sampling' && (
            <CalibrationSamplingStep
              samplingProgress={state.samplingProgress}
              getAudioMetrics={getAudioMetrics}
            />
          )}

          {state.step === 'analyzed' && state.calibrationResult && (
            <CalibrationResultStep calibrationResult={state.calibrationResult} />
          )}

          {state.step === 'guard_error' && (
            <CalibrationErrorStep errorMessage={state.guardErrorMessage} />
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          {state.step === 'idle' && (
            <>
              <Button
                variant="ghost"
                onClick={closeModal}
                className="text-white/60 hover:text-white hover:bg-white/5 text-xs h-9 px-4"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={beginCalibration}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-9 px-5 gap-2 shadow-lg shadow-violet-600/20 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bắt đầu đo độ ồn (3s)</span>
              </Button>
            </>
          )}

          {(state.step === 'countdown' || state.step === 'sampling') && (
            <div className="w-full flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelCalibration}
                className="text-xs border-white/10 text-white/60 hover:bg-white/5 h-8 px-3"
              >
                Hủy đo
              </Button>
            </div>
          )}

          {state.step === 'analyzed' && (
            <>
              <Button
                variant="outline"
                onClick={beginCalibration}
                className="border-white/10 text-white/70 hover:bg-white/5 text-xs h-9 px-3 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đo lại</span>
              </Button>
              <Button
                onClick={acceptCalibration}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-5 gap-2 font-medium shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Áp dụng cấu hình</span>
              </Button>
            </>
          )}

          {state.step === 'guard_error' && (
            <>
              <Button
                variant="ghost"
                onClick={closeModal}
                className="text-white/60 hover:text-white hover:bg-white/5 text-xs h-9 px-4"
              >
                Đóng
              </Button>
              <Button
                onClick={beginCalibration}
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
