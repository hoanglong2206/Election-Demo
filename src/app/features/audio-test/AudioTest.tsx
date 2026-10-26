import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAudioPipeline } from '../../hooks/useAudioPipeline'
import {
  getSavedSTTEngineId,
  getAvailableSTTEngines,
  LOCAL_WHISPER_BASE_ENGINE,
} from '../../services/ai-model/aiModels'
import {
  sttJobQueue,
  type STTJob,
  type STTQueueMetrics,
  whisperPromptBuilder,
} from '../../services/ai-model/stt'
import { getSavedMeetingContext } from '../../services/meetingContext'
import { YOUTUBE_STT_SAMPLES } from './constants'
import type { STTLang, STTPreviewLine } from './types'
import { AudioTestHeader } from './components/AudioTestHeader'
import { AudioControlsToolbar } from './components/AudioControlsToolbar'
import { STTPreviewPanel } from './components/STTPreviewPanel'
import { PipelineStagesCard } from './components/PipelineStagesCard'
import { VADCalibrationModal } from './components/VADCalibrationModal'
import {
  getVADCalibration,
  getEffectiveVadEnergyThreshold,
  type VADCalibrationRecord,
} from '../../services/vad-calibration'
import {
  getSavedAudioDeviceId,
  saveAudioDeviceId,
  enumerateSystemAudioDevices,
  type AudioDeviceInfo,
} from '../../services/audioDevices'

interface AudioTestProps {
  onViewChange?: (view: 'home' | 'meeting' | 'audio-test' | 'ai-diagnostic' | 'history' | 'settings') => void
}

export function AudioTest({ onViewChange }: AudioTestProps = {}) {
  const {
    isCapturing,
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

  // ── Microphone Devices & VAD Calibration State ──
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => getSavedAudioDeviceId())
  const [availableDevices, setAvailableDevices] = useState<AudioDeviceInfo[]>([])
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibratedRecord, setCalibratedRecord] = useState<VADCalibrationRecord | null>(() =>
    getVADCalibration(selectedDeviceId)
  )
  const [dismissedError, setDismissedError] = useState(false)

  // Enumerate audio input devices
  useEffect(() => {
    let isMounted = true
    enumerateSystemAudioDevices().then((devs) => {
      if (isMounted) {
        const mics = devs.filter((d) => d.kind === 'audioinput' || d.deviceId.includes('mic'))
        setAvailableDevices(mics.length > 0 ? mics : devs)
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  // Sync calibrated record when selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId) {
      const rec = getVADCalibration(selectedDeviceId)
      setTimeout(() => setCalibratedRecord(rec), 0)
    }
  }, [selectedDeviceId])

  // Reset dismissed error state if a new error occurs
  useEffect(() => {
    if (error) {
      setTimeout(() => setDismissedError(false), 0)
    }
  }, [error])

  const handleSelectDevice = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId)
    saveAudioDeviceId(newDeviceId)
    setCalibratedRecord(getVADCalibration(newDeviceId))
    const effectiveThreshold = getEffectiveVadEnergyThreshold(newDeviceId)
    setVadEnergyThreshold(effectiveThreshold)

    if (isCapturing && sourceType === 'mic') {
      try {
        await switchDevice(newDeviceId)
      } catch (err) {
        console.warn('[AudioTest] switchDevice error:', err)
      }
    }
  }

  const [showTip, setShowTip] = useState(true)

  // ── STT Engine Integration State ──
  const [selectedSTT, setSelectedSTT] = useState(getSavedSTTEngineId)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const availableSTTEngines = getAvailableSTTEngines()
  const currentSTTEngine =
    availableSTTEngines.find((e) => e.id === selectedSTT) ||
    availableSTTEngines[0] ||
    LOCAL_WHISPER_BASE_ENGINE

  // Revert sttJobQueue provider & concurrency back to settings configuration when leaving AudioTest
  useEffect(() => {
    return () => {
      sttJobQueue.handleProviderSwitch(getSavedSTTEngineId())
    }
  }, [])

  const [sttLines, setSttLines] = useState<STTPreviewLine[]>([])
  const [isSimulatingSTT, setIsSimulatingSTT] = useState(false)
  const [queueMetrics, setQueueMetrics] = useState<STTQueueMetrics>(() => sttJobQueue.getMetrics())
  const sequenceIdRef = useRef<number>(1)
  const [initialSessionId] = useState(() => 'audiotest_' + Date.now())
  const sessionIdRef = useRef<string>(initialSessionId)
  const sttScrollRef = useRef<HTMLDivElement>(null)

  const [sttLang, setSttLang] = useState<STTLang>('auto')
  const sttLangRef = useRef<STTLang>('auto')
  const lastProcessedSampleRef = useRef<number>(0)
  const selectedSTTRef = useRef<string>(selectedSTT)
  const sourceTypeRef = useRef<string>(sourceType)

  useEffect(() => {
    sttLangRef.current = sttLang
    selectedSTTRef.current = selectedSTT
    sourceTypeRef.current = sourceType
  }, [sttLang, selectedSTT, sourceType])

  // Reset sample pointer when capture state toggles
  useEffect(() => {
    if (isCapturing) {
      lastProcessedSampleRef.current = 0
    }
  }, [isCapturing])

  // ── Sync STT provider & concurrency limit ──────────────────────────────────
  useEffect(() => {
    sttJobQueue.handleProviderSwitch(selectedSTT)
  }, [selectedSTT])

  // ── Subscribe to STTJobQueue metrics & TranscriptAssembler monotonic commits ─
  useEffect(() => {
    const unsubMetrics = sttJobQueue.subscribe((m) => {
      setQueueMetrics(m)
      setIsTranscribing(m.processingJobs > 0 || m.queueDepth > 0)
    })

    const unsubCommit = sttJobQueue.assembler.onCommit((commit) => {
      const { result, speakerLabel, timestampStr } = commit
      if (result.success && result.text.trim()) {
        const newLine: STTPreviewLine = {
          id: Date.now() + Math.random(),
          timestamp: timestampStr || '00:00',
          originalEn: result.text,
          translatedVi: result.translatedVi || result.text,
          confidence: result.confidence || 98,
          latencyMs: result.latencyMs,
          speaker: speakerLabel || 'Audio Stream',
          engineBadge: `${result.engineName.split(' (')[0]}`,
          isReal: true,
        }

        setSttLines((prev) => {
          if (
            prev.length > 0 &&
            prev[prev.length - 1].originalEn.trim().toLowerCase() === result.text.trim().toLowerCase()
          ) {
            return prev
          }
          return [...prev, newLine]
        })
      }
    })

    return () => {
      unsubMetrics()
      unsubCommit()
    }
  }, [])

  // ── Real-Time Automatic Speech-to-Text Queue Producer Loop ──────────────────
  useEffect(() => {
    if (!isCapturing) {
      sttJobQueue.pause()
      return
    }

    sttJobQueue.resume()

    const intervalTimer = setInterval(() => {
      // Extract new audio segment since lastProcessedSample (fast 1.2s phrase window)
      const segment = getAudioSegmentSince(lastProcessedSampleRef.current, 1.2)
      if (!segment) return

      // Advance pointer
      lastProcessedSampleRef.current = segment.endSample

      const seqId = sequenceIdRef.current++
      const now = new Date()
      const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

      const job: STTJob = {
        jobId: `stt_${sessionIdRef.current}_${seqId}_${Date.now()}`,
        sessionId: sessionIdRef.current,
        sequenceId: seqId,
        audioBuffer: segment.blob,
        hasSpeech: segment.hasAudio, // VAD: drop silence chunks early without wasting STT compute
        createdAt: Date.now(),
        priority: segment.hasAudio ? 1 : 0,
        engineId: selectedSTTRef.current,
        language: sttLangRef.current,
        sourceType: sourceTypeRef.current as 'system' | 'mic',
        speakerLabel: sourceTypeRef.current === 'system' ? 'YouTube / Loopback' : 'Microphone Speaker',
        timestampStr: timeStr,
        prompt: whisperPromptBuilder.buildPrompt(getSavedMeetingContext().keywords || []) || undefined,
      }

      sttJobQueue.enqueue(job)
    }, 1000)

    return () => {
      clearInterval(intervalTimer)
      sttJobQueue.pause()
    }
  }, [isCapturing, getAudioSegmentSince])

  // Auto scroll STT container
  useEffect(() => {
    if (sttScrollRef.current) {
      sttScrollRef.current.scrollTop = sttScrollRef.current.scrollHeight
    }
  }, [sttLines])

  const handleSimulateSTT = () => {
    setIsSimulatingSTT(true)
    if (sttLines.length === 0) {
      const first = YOUTUBE_STT_SAMPLES[0]
      setSttLines([
        {
          id: Date.now(),
          timestamp: '00:04',
          originalEn: first.originalEn,
          translatedVi: first.translatedVi,
          confidence: first.confidence,
          latencyMs: first.latencyMs,
          speaker: 'YouTube / Audio Stream',
          engineBadge: `${currentSTTEngine.name.split(' (')[0]}`,
        },
      ])
    } else {
      const idx = sttLines.length % YOUTUBE_STT_SAMPLES.length
      const sample = YOUTUBE_STT_SAMPLES[idx]
      setSttLines((prev) => [
        ...prev,
        {
          id: Date.now(),
          timestamp: `00:${String((prev.length + 1) * 4).padStart(2, '0')}`,
          originalEn: sample.originalEn,
          translatedVi: sample.translatedVi,
          confidence: sample.confidence,
          latencyMs: sample.latencyMs,
          speaker: sourceType === 'system' ? 'YouTube / Audio Stream' : 'Microphone Speaker',
          engineBadge: `${currentSTTEngine.name.split(' (')[0]}`,
        },
      ])
    }
  }

  const handleClearSTT = () => {
    setSttLines([])
    setIsSimulatingSTT(false)
    sequenceIdRef.current = 1
    sessionIdRef.current = 'audiotest_' + Date.now()
    lastProcessedSampleRef.current = 0
    sttJobQueue.reset(sessionIdRef.current)
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3.5 animate-fade-in custom-scrollbar">
      {/* Header and Layout Switcher */}
      <AudioTestHeader
        showTip={showTip}
        setShowTip={setShowTip}
        engineType={engineType}
        sourceType={sourceType}
        activeDeviceName={availableDevices.find((d) => d.deviceId === selectedDeviceId)?.label}
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

      {/* Unified Studio Audio Console (Controls & Integrated Real-time Signal Monitor) */}
      <AudioControlsToolbar
        sourceType={sourceType}
        setSourceType={setSourceType}
        isCapturing={isCapturing}
        isStarting={isStarting}
        isAudioDetected={isAudioDetected}
        startCapture={startCapture}
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
        volume={volume}
        db={db}
        frequencyBands={frequencyBands}
        getAudioMetrics={getAudioMetrics}
      />

      {/* Live STT Preview & Audio Pipeline Stages in 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        <div className="lg:col-span-7">
          <STTPreviewPanel
            isCapturing={isCapturing}
            isSimulatingSTT={isSimulatingSTT}
            isTranscribing={isTranscribing}
            queueMetrics={queueMetrics}
            currentSTTEngine={currentSTTEngine}
            availableSTTEngines={availableSTTEngines}
            selectedSTT={selectedSTT}
            onSelectSTTEngine={(engineId) => {
              setSelectedSTT(engineId)
              sttJobQueue.handleProviderSwitch(engineId)
            }}
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
        activeDeviceName={availableDevices.find((d) => d.deviceId === selectedDeviceId)?.label}
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
