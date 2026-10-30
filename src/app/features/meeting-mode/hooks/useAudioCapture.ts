import { useState, useEffect, useRef, useCallback } from 'react'
import { useAudioPipeline } from '@/hooks/useAudioPipeline'
import {
  type AudioState,
  transitionAudioState,
} from '../machines/audioStateMachine'
import { chunkProducer, type ChunkDispatchContext } from '../controllers/chunkProducer'
import { sttJobQueue } from '@/services/ai-model/stt'
import { whisperPort } from '@/infrastructure/ipc'
import {
  getEffectiveVadEnergyThreshold,
  getVADCalibration,
} from '@/services/vad-calibration'
import { settingsManager } from '@/services/settings/settingsManager'
import { getSavedSTTEngineId } from '@/services/ai-model/aiModels'
import type { AppMode } from '@/types/electron.d'

export interface UseAudioCaptureProps {
  mode: AppMode
  sessionId: string
  sttLang: string
  activeKeywords?: string[]
  fallbackPrompt?: string
  selectedDeviceId?: string
  onStoppedListening?: () => Promise<void> | void
}

export interface UseAudioCaptureReturn {
  audioState: AudioState
  isListening: boolean
  isCapturing: boolean
  sourceType: 'mic' | 'system'
  handleToggleListening: () => Promise<void>
  handleSwitchSource: (newType: 'mic' | 'system') => Promise<void>
}

export function useAudioCapture({
  mode,
  sessionId,
  sttLang,
  activeKeywords,
  fallbackPrompt,
  selectedDeviceId,
  onStoppedListening,
}: UseAudioCaptureProps): UseAudioCaptureReturn {
  const isMountedRef = useRef(true)
  const isTogglingRef = useRef(false)
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [audioState, setAudioState] = useState<AudioState>('idle')

  const {
    isCapturing,
    captureOwner,
    sourceType,
    setSourceType,
    startCapture,
    stopCapture,
    subscribeAudioFrames,
    switchDevice,
    setVadEnergyThreshold,
  } = useAudioPipeline()

  const isMeetingActive = isCapturing && (captureOwner === 'meeting' || captureOwner === null)
  const isListening = (audioState === 'listening' || audioState === 'switching') && isMeetingActive

  // Context for chunk producer dispatch
  const getDispatchContext = useCallback((): ChunkDispatchContext => {
    return {
      sessionId,
      mode,
      sourceType,
      sttLang,
      activeKeywords,
      fallbackPrompt,
    }
  }, [sessionId, mode, sourceType, sttLang, activeKeywords, fallbackPrompt])

  // Sync initial audio source type based on selected audio device
  useEffect(() => {
    if (selectedDeviceId) {
      const devId = selectedDeviceId.toLowerCase()
      if (devId.includes('mic') || devId.includes('input')) {
        setSourceType('mic')
      } else {
        setSourceType('system')
      }
    }
  }, [selectedDeviceId, setSourceType])

  // Synchronize calibrated VAD speech threshold
  useEffect(() => {
    if (selectedDeviceId) {
      const effectiveThreshold = getEffectiveVadEnergyThreshold(selectedDeviceId)
      setVadEnergyThreshold(effectiveThreshold)
      const calib = getVADCalibration(selectedDeviceId)
      if (calib) {
        console.log(
          `[useAudioCapture] Loaded calibrated VAD threshold for device "${selectedDeviceId}": ${calib.speechThresholdDbfs} dBFS`
        )
      }
    }
  }, [selectedDeviceId, setVadEnergyThreshold])

  // Dynamically switch microphone device on the fly
  useEffect(() => {
    if (isCapturing && sourceType === 'mic' && selectedDeviceId) {
      switchDevice(selectedDeviceId).catch((err) =>
        console.warn('[useAudioCapture] switchDevice on the fly error:', err)
      )
    }
  }, [selectedDeviceId, isCapturing, sourceType, switchDevice])

  // Synchronize state if capture stops externally (e.g. mic unplugged) or owner changes
  useEffect(() => {
    const isOwnerLost = !isCapturing || (Boolean(captureOwner) && captureOwner !== 'meeting')
    if (isOwnerLost && (audioState === 'listening' || audioState === 'starting') && !isTogglingRef.current) {
      setAudioState((prev) => transitionAudioState(prev, { type: 'STOP' }))
      setAudioState((prev) => transitionAudioState(prev, { type: 'STOPPED' }))
    }
  }, [isCapturing, captureOwner, audioState])

  // Connect Audio Frames loop to ChunkProducer
  useEffect(() => {
    if (!isCapturing || !isListening) {
      sttJobQueue.pause()
      return
    }

    // Initialize STT queue and chunk producer aligned to this meeting session
    chunkProducer.resetAll(sessionId)
    sttJobQueue.resume()

    const currentSettings = settingsManager.getSettings()
    const silenceEndMs = currentSettings.audio.silenceEndMs || 400
    const maxSegmentMs = currentSettings.audio.maxSegmentMs || 4500
    const effectiveVadRms = getEffectiveVadEnergyThreshold(selectedDeviceId)

    chunkProducer.initSegmenter({
      sampleRate: 16000,
      silenceEndMs,
      maxSegmentMs,
      vadThresholdRms: effectiveVadRms,
    })

    const unsubFrames = subscribeAudioFrames((pcm16, totalSamples) => {
      if (!isMountedRef.current || !isCapturing || !isListening) return
      chunkProducer.feedPcmFrames(pcm16, totalSamples, getDispatchContext())
    })

    return () => {
      unsubFrames()
      chunkProducer.flush(getDispatchContext())
      chunkProducer.reset()
      sttJobQueue.pause()
    }
  }, [isCapturing, isListening, sessionId, selectedDeviceId, subscribeAudioFrames, getDispatchContext])

  const handleToggleListening = useCallback(async () => {
    if (isTogglingRef.current) return
    isTogglingRef.current = true

    try {
      if (isListening || isCapturing) {
        setAudioState((prev) => transitionAudioState(prev, { type: 'STOP' }))
        stopCapture()
        chunkProducer.flush(getDispatchContext())
        setAudioState((prev) => transitionAudioState(prev, { type: 'STOPPED' }))

        if (onStoppedListening) {
          await onStoppedListening()
        }
      } else {
        // Pre-flight health check if using native local whisper
        const engineId = getSavedSTTEngineId()
        if (engineId?.includes('local') && whisperPort.isAvailable) {
          try {
            const health = await whisperPort.healthCheck(engineId)
            if (!health.healthy) {
              console.warn('[useAudioCapture] Pre-flight STT health check warning:', health.error)
            }
          } catch (err) {
            console.warn('[useAudioCapture] Health check error:', err)
          }
        }

        setAudioState((prev) => transitionAudioState(prev, { type: 'START' }))
        try {
          await startCapture(sourceType, { owner: 'meeting', deviceId: selectedDeviceId })
          if (isMountedRef.current) {
            setAudioState((prev) => transitionAudioState(prev, { type: 'CAPTURE_READY' }))
          }
        } catch (err) {
          console.warn('[useAudioCapture] Could not start capture:', err)
          if (isMountedRef.current) {
            setAudioState((prev) => transitionAudioState(prev, { type: 'START_FAILED' }))
          }
        }
      }
    } finally {
      isTogglingRef.current = false
    }
  }, [isListening, isCapturing, stopCapture, startCapture, getDispatchContext, onStoppedListening, selectedDeviceId, sourceType])

  const handleSwitchSource = useCallback(
    async (newType: 'mic' | 'system') => {
      if (sourceType === newType) return

      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current)
        switchTimerRef.current = null
      }

      setAudioState((prev) => transitionAudioState(prev, { type: 'SWITCH_SOURCE' }))

      // Flush in-progress speech segment before switching source
      chunkProducer.flush(getDispatchContext())
      chunkProducer.reset()

      setSourceType(newType)

      if (isCapturing) {
        stopCapture()
        switchTimerRef.current = setTimeout(async () => {
          if (!isMountedRef.current) return
          try {
            await startCapture(newType, { owner: 'meeting', deviceId: selectedDeviceId })
            setAudioState((prev) => transitionAudioState(prev, { type: 'SWITCH_COMPLETED' }))
          } catch (err) {
            console.warn('[useAudioCapture] restart capture on switch error:', err)
            setAudioState((prev) => transitionAudioState(prev, { type: 'STOPPED' }))
          }
        }, 150)
      } else {
        setAudioState((prev) => transitionAudioState(prev, { type: 'SWITCH_COMPLETED' }))
      }
    },
    [sourceType, isCapturing, setSourceType, stopCapture, startCapture, getDispatchContext, selectedDeviceId]
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current)
      }
    }
  }, [])

  return {
    audioState,
    isListening,
    isCapturing,
    sourceType,
    handleToggleListening,
    handleSwitchSource,
  }
}
