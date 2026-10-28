import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAudioPipeline } from '@/hooks/useAudioPipeline'
import type { AudioTestProps } from './types'
import { AudioTestHeader } from './components/header'
import { AudioControlsToolbar } from './components/controls'
import { STTPreviewPanel } from './components/stt-preview'
import { PipelineStagesCard } from './components/pipeline'
import { VADCalibrationModal } from './components/calibration'
import { useAudioDeviceSelection, useAudioTestSTT } from './hooks'

export function AudioTest({ onViewChange }: AudioTestProps = {}) {
  const {
    isCapturing,
    captureOwner,
    isStarting,
    sourceType,
    setSourceType,
    volume,
    db,
    frequencyBands,
    isAudioDetected,
    error,
    startCapture,
    stopCapture,
    switchDevice,
    bufferDurationSec,
    bufferSizeBytes,
    chunks,
    hasBuffer,
    isPlaying,
    playBuffer,
    stopPlayback,
    clearBuffer,
    downloadWav,
    getAudioSegmentSince,
    pipelineStages,
    inputSampleRateHz,
    getAudioMetrics,
    engineType,
    getRecentPcmSamples,
    setVadEnergyThreshold,
  } = useAudioPipeline()

  // Phân quyền thu âm: AudioTest chỉ kích hoạt khi captureOwner là 'audio-test'
  const isAudioTestRecording = isCapturing && captureOwner === 'audio-test'
  const isMeetingRecording = isCapturing && captureOwner === 'meeting'

  // ── UI States ──
  const [showTip, setShowTip] = useState(true)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [dismissedError, setDismissedError] = useState(false)
  const sttScrollRef = useRef<HTMLDivElement>(null)

  // ── Device & Calibration Hook ──
  const {
    selectedDeviceId,
    availableDevices,
    calibratedRecord,
    activeDeviceName,
    handleSelectDevice,
    setCalibratedRecord,
  } = useAudioDeviceSelection({
    isCapturing: isAudioTestRecording,
    sourceType,
    switchDevice,
    setVadEnergyThreshold,
  })

  const handleStartAudioTestCapture = useCallback(async () => {
    await startCapture(sourceType, { owner: 'audio-test', deviceId: selectedDeviceId })
  }, [startCapture, sourceType, selectedDeviceId])

  // ── Speech-to-Text Integration Hook ──
  const {
    selectedSTT,
    setSelectedSTT,
    availableSTTEngines,
    currentSTTEngine,
    sttLang,
    setSttLang,
    sttLines,
    isTranscribing,
    isSimulatingSTT,
    queueMetrics,
    handleSimulateSTT,
    handleClearSTT,
  } = useAudioTestSTT({
    isCapturing: isAudioTestRecording,
    captureOwner,
    sourceType,
    getAudioSegmentSince,
  })

  // Reset dismissed error state if a new error occurs
  const prevErrorRef = useRef(error)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setDismissedError(false)
    }
    prevErrorRef.current = error
  }, [error])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3.5 animate-fade-in custom-scrollbar">
      {/* Header and Layout Switcher */}
      <AudioTestHeader
        showTip={showTip}
        setShowTip={setShowTip}
        engineType={engineType}
        sourceType={sourceType}
        activeDeviceName={activeDeviceName}
      />

      {/* Capture or Permission Error Banner */}
      {error && !dismissedError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start justify-between gap-3 text-rose-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-rose-300 block">Lỗi kết nối âm thanh / microphone:</span>
              <p className="text-rose-200/90 leading-relaxed">{error}</p>
              <p className="text-[11px] text-white/50">
                Gợi ý: Vui lòng kiểm tra quyền truy cập microphone trên trình duyệt hoặc cắm lại thiết bị micro.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedError(true)}
            className="text-rose-300/60 hover:text-rose-200 p-0.5 rounded transition-colors"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Meeting Recording Active Notice */}
      {isMeetingRecording && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3 text-amber-200 animate-fade-in">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="font-semibold text-amber-300 block">
                Phiên họp đang thu âm trong nền (Meeting Copilot)
              </span>
              <p className="text-amber-200/80 text-[11px]">
                Audio Test đang ở chế độ chờ để không can thiệp vào cuộc họp. Bấm &quot;Bắt đầu thu âm&quot; bên dưới nếu bạn muốn chuyển mic sang Audio Test.
              </p>
            </div>
          </div>
          {onViewChange && (
            <button
              type="button"
              onClick={() => onViewChange('meeting')}
              className="rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/30 px-3 py-1.5 text-xs text-amber-100 font-medium transition-colors shrink-0 cursor-pointer"
            >
              Quay lại cuộc họp
            </button>
          )}
        </div>
      )}

      {/* Unified Studio Audio Console (Controls & Integrated Real-time Signal Monitor) */}
      <AudioControlsToolbar
        sourceType={sourceType}
        setSourceType={setSourceType}
        isCapturing={isAudioTestRecording}
        isStarting={isStarting}
        isAudioDetected={isAudioTestRecording ? isAudioDetected : false}
        startCapture={handleStartAudioTestCapture}
        stopCapture={stopCapture}
        isPlaying={isPlaying}
        playBuffer={playBuffer}
        stopPlayback={stopPlayback}
        hasBuffer={hasBuffer}
        bufferDurationSec={bufferDurationSec}
        downloadWav={downloadWav}
        clearBuffer={clearBuffer}
        onOpenCalibration={() => setIsCalibrating(true)}
        calibratedDb={calibratedRecord?.speechThresholdDbfs}
        availableDevices={availableDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={handleSelectDevice}
        onEnterMeeting={onViewChange ? () => onViewChange('meeting') : undefined}
        volume={isAudioTestRecording ? volume : 0}
        db={isAudioTestRecording ? db : -60}
        frequencyBands={isAudioTestRecording ? frequencyBands : new Array(16).fill(0)}
        getAudioMetrics={getAudioMetrics}
      />

      {/* Live STT Preview & Audio Pipeline Stages in 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <div className="lg:col-span-7">
          <STTPreviewPanel
            isCapturing={isAudioTestRecording}
            isSimulatingSTT={isSimulatingSTT}
            isTranscribing={isTranscribing}
            queueMetrics={queueMetrics}
            currentSTTEngine={currentSTTEngine}
            availableSTTEngines={availableSTTEngines}
            selectedSTT={selectedSTT}
            onSelectSTTEngine={setSelectedSTT}
            sttLang={sttLang}
            onSelectSTTLang={setSttLang}
            sttLines={sttLines}
            onSimulateSTT={handleSimulateSTT}
            onClearSTT={handleClearSTT}
            scrollRef={sttScrollRef}
          />
        </div>

        <div className="lg:col-span-5 space-y-3.5">
          <PipelineStagesCard
            pipelineStages={pipelineStages}
            bufferDurationSec={bufferDurationSec}
            bufferSizeBytes={bufferSizeBytes}
            chunks={chunks}
            queueMetrics={queueMetrics}
            isCapturing={isCapturing}
            isStarting={isStarting}
            sourceType={sourceType}
            isAudioDetected={isAudioDetected}
            captureError={error}
            inputSampleRateHz={inputSampleRateHz}
          />
        </div>
      </div>

      {/* Interactive VAD Noise Floor Calibration Modal */}
      <VADCalibrationModal
        isOpen={isCalibrating}
        onClose={() => setIsCalibrating(false)}
        activeDeviceId={selectedDeviceId}
        activeDeviceName={activeDeviceName}
        getAudioMetrics={getAudioMetrics}
        startCapture={startCapture}
        stopCapture={stopCapture}
        isCapturing={isCapturing}
        sourceType={sourceType}
        setSourceType={setSourceType}
        getRecentPcmSamples={getRecentPcmSamples}
        setVadEnergyThreshold={setVadEnergyThreshold}
        onCalibrated={(record) => setCalibratedRecord(record)}
      />
    </div>
  )
}
