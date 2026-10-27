import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  AudioBufferManager,
} from '../core/audio/AudioBufferManager'
import { WebAudioCaptureService } from '../infrastructure/audio/WebAudioCaptureService'
import { AudioPlaybackService } from '../infrastructure/audio/AudioPlaybackService'
import type {
  AudioChunkMeta,
  AudioEngineType,
  AudioMetrics,
  AudioSegment,
  AudioSourceType,
  PipelineStageInfo,
} from '../core/audio/types'
import { getSavedAudioDeviceId } from '../services/audioDevices'
import { getEffectiveVadEnergyThreshold } from '../services/vad-calibration'

export type { AudioSourceType, PipelineStageInfo, AudioEngineType }

export function useAudioPipeline() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [sourceType, setSourceType] = useState<AudioSourceType>('system')
  const [volume, setVolume] = useState(0) // 0 - 100
  const [db, setDb] = useState(-60)
  const [frequencyBands, setFrequencyBands] = useState<number[]>(() => new Array(16).fill(0))
  const [isAudioDetected, setIsAudioDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Buffer stats
  const [bufferDurationSec, setBufferDurationSec] = useState(0)
  const [bufferSizeBytes, setBufferSizeBytes] = useState(0)
  const [totalSamples, setTotalSamples] = useState(0)
  const [bufferedSeconds, setBufferedSeconds] = useState(0)
  const [estimatedMemoryMb, setEstimatedMemoryMb] = useState(0)
  const [chunks, setChunks] = useState<AudioChunkMeta[]>([])

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasBuffer, setHasBuffer] = useState(false)

  // Service singletons managed across hook lifetime
  const [bufferManager] = useState(() => new AudioBufferManager())
  const [captureService] = useState(() => new WebAudioCaptureService())
  const [playbackService] = useState(() => new AudioPlaybackService())

  const presenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastStatsUpdateRef = useRef<number>(0)
  const isStartingRef = useRef(false)
  const audioFrameListenersRef = useRef<Set<(pcm16: Int16Array, totalSamples: number) => void>>(new Set())

  const subscribeAudioFrames = useCallback((listener: (pcm16: Int16Array, totalSamples: number) => void) => {
    audioFrameListenersRef.current.add(listener)
    return () => {
      audioFrameListenersRef.current.delete(listener)
    }
  }, [])

  // ── High-performance direct access to audio metrics & analyser (outside React state) ─
  const getAudioMetrics = useCallback((): AudioMetrics => {
    return captureService.getMetrics()
  }, [captureService])

  const getAnalyser = useCallback((): AnalyserNode | null => {
    return captureService.getAnalyser ? captureService.getAnalyser() : null
  }, [captureService])

  // ── Sync buffer stats to React state (throttled to avoid re-render thrashing) ─
  const syncBufferStats = useCallback(
    (force = false) => {
      const now = performance.now()
      if (!force && now - lastStatsUpdateRef.current < 200) {
        return
      }
      lastStatsUpdateRef.current = now

      setTotalSamples(bufferManager.totalSamples)
      setBufferSizeBytes(bufferManager.sizeBytes)
      setBufferDurationSec(bufferManager.durationSec)
      setBufferedSeconds(bufferManager.bufferedSeconds)
      setEstimatedMemoryMb(bufferManager.estimatedMemoryMb)
      setHasBuffer(bufferManager.hasBuffer)
    },
    [bufferManager]
  )

  // ── Stop Capture ────────────────────────────────────────────────────────────
  const stopCapture = useCallback(() => {
    if (presenceTimerRef.current) {
      clearInterval(presenceTimerRef.current)
      presenceTimerRef.current = null
    }

    captureService.stop()

    setIsCapturing(false)
    setIsStarting(false)
    isStartingRef.current = false
    setIsAudioDetected(false)
    setVolume(0)
    setDb(-60)
    setFrequencyBands(new Array(16).fill(0))

    syncBufferStats(true)
  }, [captureService, syncBufferStats])

  // ── Start Capture ───────────────────────────────────────────────────────────
  const startCapture = useCallback(async () => {
    if (isStartingRef.current) return
    isStartingRef.current = true
    setIsStarting(true)
    setError(null)
    stopCapture()

    try {
      bufferManager.clear()
      setChunks([])
      syncBufferStats(true)

      const savedDeviceId = getSavedAudioDeviceId()
      bufferManager.setVadEnergyThreshold(getEffectiveVadEnergyThreshold(savedDeviceId))

      await captureService.start(
        sourceType,
        (pcm16) => {
          const currentTotal = bufferManager.totalSamples
          const readyChunk = bufferManager.appendSamples(pcm16)

          if (readyChunk) {
            setChunks((prev) => [readyChunk, ...prev.slice(0, 7)]) // keep last 8 chunks
          }

          syncBufferStats(false)

          // Immediately notify real-time frame consumers (e.g. SpeechSegmenter in MeetingMode)
          for (const listener of audioFrameListenersRef.current) {
            try {
              listener(pcm16, currentTotal)
            } catch (err) {
              console.error('[AudioPipeline] Frame listener error:', err)
            }
          }
        },
        { deviceId: savedDeviceId }
      )

      setIsCapturing(true)

      // Low-frequency presence check (every 400ms, outside 60fps render loop)
      // Only updates React state when presence boolean actually changes!
      presenceTimerRef.current = setInterval(() => {
        if (!captureService.isCapturing) {
          // Hardware/stream was terminated or disconnected externally (e.g. mic unplugged)
          stopCapture()
          return
        }
        const detected = captureService.getMetrics().isAudioDetected
        setIsAudioDetected((prev) => (prev !== detected ? detected : prev))
      }, 400)
    } catch (err: unknown) {
      console.error('[AudioPipeline] Start Capture failed:', err)
      const message =
        err instanceof Error
          ? err.message
          : 'Lỗi không xác định khi mở âm thanh hệ thống'
      setError(message)
      stopCapture()
      throw err
    } finally {
      isStartingRef.current = false
      setIsStarting(false)
    }
  }, [captureService, bufferManager, sourceType, stopCapture, syncBufferStats])

  // ── Switch Audio Input Device ───────────────────────────────────────────────
  const switchDevice = useCallback(
    async (deviceId: string) => {
      try {
        setError(null)
        await captureService.switchDevice(deviceId)
        bufferManager.setVadEnergyThreshold(getEffectiveVadEnergyThreshold(deviceId))
      } catch (err: unknown) {
        console.error('[AudioPipeline] switchDevice failed:', err)
        const message =
          err instanceof Error ? err.message : 'Lỗi khi chuyển đổi thiết bị microphone'
        setError(message)
        throw err
      }
    },
    [captureService, bufferManager]
  )

  // ── Play Captured Buffer ────────────────────────────────────────────────────
  const playBuffer = useCallback(async () => {
    const blob = bufferManager.getFullWavBlob()
    if (!blob) return

    try {
      setIsPlaying(true)
      await playbackService.play(blob, () => {
        setIsPlaying(false)
      })
    } catch (err) {
      console.error('[AudioPipeline] Playback failed:', err)
      setIsPlaying(false)
    }
  }, [bufferManager, playbackService])

  const stopPlayback = useCallback(() => {
    playbackService.stop()
    setIsPlaying(false)
  }, [playbackService])

  // ── Clear Buffer ────────────────────────────────────────────────────────────
  const clearBuffer = useCallback(() => {
    stopPlayback()
    bufferManager.clear()
    setChunks([])
    syncBufferStats(true)
  }, [stopPlayback, bufferManager, syncBufferStats])

  // ── Download WAV ────────────────────────────────────────────────────────────
  const downloadWav = useCallback(() => {
    const blob = bufferManager.getFullWavBlob()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-audio-capture-16khz-${Date.now()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }, [bufferManager])

  // ── Get Full Recorded WAV Blob ──────────────────────────────────────────────
  const getWavBlob = useCallback((): Blob | null => {
    return bufferManager.getFullWavBlob()
  }, [bufferManager])

  // ── Get Recent Audio Window Blob (last N seconds) ───────────────────────────
  const getRecentAudioBlob = useCallback(
    (seconds = 4): Blob | null => {
      return bufferManager.getRecentAudioBlob(seconds)
    },
    [bufferManager]
  )

  // ── Get Audio Segment Since sample offset ────────────────────────────────────
  const getAudioSegmentSince = useCallback(
    (fromSample = 0, minDurationSec = 1.8): AudioSegment | null => {
      return bufferManager.getAudioSegmentSince(fromSample, minDurationSec)
    },
    [bufferManager]
  )

  // ── Get Raw PCM Samples Since sample offset ──────────────────────────────────
  const getRawSamplesSince = useCallback(
    (fromSample = 0) => {
      return bufferManager.getRawSamplesSince(fromSample)
    },
    [bufferManager]
  )

  // Clean up on unmount: stop capture, stop playback, clear presence timer and wipe all buffers
  useEffect(() => {
    return () => {
      if (presenceTimerRef.current) {
        clearInterval(presenceTimerRef.current)
        presenceTimerRef.current = null
      }
      captureService.stop()
      playbackService.stop()
      bufferManager.clear()
    }
  }, [captureService, playbackService, bufferManager])

  // Build pipeline step details (memoized for presentation stability)
  const pipelineStages: PipelineStageInfo[] = useMemo(
    () => [
      {
        stage: 1,
        name: 'System audio',
        status: isCapturing ? 'active' : 'idle',
        detail:
          sourceType === 'system'
            ? 'Loopback stream (YouTube / Calls)'
            : 'Microphone stream',
        subDetail: isCapturing
          ? isAudioDetected
            ? 'Đang có tín hiệu âm thanh'
            : 'Chờ phát âm thanh...'
          : 'Sẵn sàng bắt đầu',
      },
      {
        stage: 2,
        name: 'Decode thành PCM',
        status: isCapturing ? 'processing' : 'idle',
        detail: isCapturing
          ? captureService.engineType === 'audio_worklet'
            ? 'Web Audio Worklet (Dedicated Audio Thread)'
            : 'Web Audio API Float32Array [-1.0, 1.0]'
          : 'Chờ luồng âm thanh',
        subDetail: isCapturing
          ? captureService.engineType === 'audio_worklet'
            ? 'AudioWorkletNode · 2048 samples · Zero-copy'
            : 'ScriptProcessorNode · 4096 samples'
          : undefined,
      },
      {
        stage: 3,
        name: 'Chuẩn hóa sample rate / channel',
        status: isCapturing ? 'processing' : 'idle',
        detail: '16,000 Hz · 1-ch (Mono) · 16-bit PCM',
        subDetail: 'Int16Array (256 kbps bitrate)',
      },
      {
        stage: 4,
        name: 'Audio buffer (Bounded Window)',
        status: hasBuffer ? 'ready' : isCapturing ? 'active' : 'idle',
        detail: `${bufferedSeconds}s buffer (${(bufferSizeBytes / 1024).toFixed(1)} KB) · Total ${bufferDurationSec}s`,
        subDetail: `RAM: ${estimatedMemoryMb} MB · Bounded sliding window`,
      },
      {
        stage: 5,
        name: 'Audio chunks',
        status: chunks.length > 0 ? 'ready' : isCapturing ? 'active' : 'idle',
        detail: `${chunks.length > 0 ? chunks[0]?.index : 0} chunks tạo ra (1.0s / 32 KB)`,
        subDetail: 'Sẵn sàng đóng gói gửi STT',
      },
      {
        stage: 6,
        name: 'Speech-to-Text',
        status: isAudioDetected ? 'active' : hasBuffer ? 'ready' : 'idle',
        detail: 'STT Ready (Whisper / Deepgram format)',
        subDetail: isAudioDetected
          ? 'Phát hiện giọng nói / âm thanh'
          : 'Hàng đợi sẵn sàng',
      },
    ],
    [
      isCapturing,
      sourceType,
      isAudioDetected,
      hasBuffer,
      bufferedSeconds,
      bufferSizeBytes,
      bufferDurationSec,
      estimatedMemoryMb,
      chunks,
      captureService.engineType,
    ]
  )

  const pruneBefore = useCallback(
    (sampleIndex: number) => {
      bufferManager.pruneBefore(sampleIndex)
      syncBufferStats(false)
    },
    [bufferManager, syncBufferStats]
  )

  const getLifecycleStats = useCallback(() => {
    return bufferManager.getLifecycleStats()
  }, [bufferManager])

  const setVadEnergyThreshold = useCallback(
    (threshold: number) => {
      bufferManager.setVadEnergyThreshold(threshold)
    },
    [bufferManager]
  )

  const getRecentPcmSamples = useCallback(
    (seconds = 3): Int16Array => {
      return bufferManager.getRecentPcmSamples(seconds)
    },
    [bufferManager]
  )

  return {
    isCapturing,
    isStarting,
    sourceType,
    setSourceType,
    volume,
    db,
    frequencyBands,
    isAudioDetected,
    getAudioMetrics,
    getAnalyser,
    error,
    startCapture,
    stopCapture,
    // Buffer & Chunks
    bufferDurationSec,
    bufferSizeBytes,
    totalSamples,
    bufferedSeconds,
    estimatedMemoryMb,
    chunks,
    hasBuffer,
    // Playback & Export
    isPlaying,
    playBuffer,
    stopPlayback,
    clearBuffer,
    downloadWav,
    getWavBlob,
    getRecentAudioBlob,
    getRecentPcmSamples,
    getAudioSegmentSince,
    getRawSamplesSince,
    subscribeAudioFrames,
    pruneBefore,
    getLifecycleStats,
    pipelineStages,
    // Engine Info & Device Switching
    engineType: captureService.engineType,
    inputSampleRateHz: captureService.isCapturing ? captureService.sampleRate : null,
    switchDevice,
    // VAD Dynamic Calibration
    vadEnergyThreshold: bufferManager.vadEnergyThreshold,
    setVadEnergyThreshold,
  }
}
