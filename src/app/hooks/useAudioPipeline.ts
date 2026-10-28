import { useSyncExternalStore, useMemo, useCallback } from 'react'
import {
  AudioPipelineController,
  type AudioPipelineState,
} from '@/infrastructure/audio/AudioPipelineController'
import { getSavedAudioDeviceId } from '@/services/audio-devices'
import { getEffectiveVadEnergyThreshold } from '@/services/vad-calibration'
import type {
  AudioEngineType,
  AudioMetrics,
  AudioSegment,
  AudioSourceType,
  PipelineStageInfo,
} from '@/core/audio/types'

export type { AudioSourceType, PipelineStageInfo, AudioEngineType, AudioPipelineState }

/**
 * Shared application-level audio pipeline controller singleton.
 * MeetingMode and AudioTest share this single source of truth.
 */
export const audioPipelineController = new AudioPipelineController({
  getSavedDeviceId: getSavedAudioDeviceId,
  getEffectiveThreshold: getEffectiveVadEnergyThreshold,
})

export interface AudioPipelineActions {
  setSourceType: (type: AudioSourceType) => void
  startCapture: (sourceType?: AudioSourceType, options?: { deviceId?: string }) => Promise<void>
  stopCapture: () => void
  switchDevice: (deviceId: string) => Promise<void>
  playBuffer: () => Promise<void>
  stopPlayback: () => void
  clearBuffer: () => void
  downloadWav: (filename?: string) => void
  getWavBlob: () => Blob | null
  getRecentAudioBlob: (seconds?: number) => Blob | null
  getRecentPcmSamples: (seconds?: number) => Int16Array
  getAudioSegmentSince: (fromSample?: number, minDurationSec?: number) => AudioSegment | null
  getRawSamplesSince: (fromSample?: number) => any
  subscribeAudioFrames: (listener: (pcm16: Int16Array, totalSamples: number) => void) => () => void
  pruneBefore: (sampleIndex: number) => void
  getLifecycleStats: () => any
  setVadEnergyThreshold: (threshold: number) => void
  getAudioMetrics: () => AudioMetrics
  getAnalyser: () => AnalyserNode | null
}

export type UseAudioPipelineReturn = {
  state: AudioPipelineState
  actions: AudioPipelineActions
} & AudioPipelineState & AudioPipelineActions

/**
 * useAudioPipeline
 *
 * Lightweight React bridge to the shared AudioPipelineController.
 * Encapsulates full audio lifecycle: Capture -> VAD -> Segmenter -> STT.
 */
export function useAudioPipeline(
  controller: AudioPipelineController = audioPipelineController
): UseAudioPipelineReturn {
  const state = useSyncExternalStore(
    useCallback((onStoreChange) => controller.subscribe(onStoreChange), [controller]),
    useCallback(() => controller.getState(), [controller])
  )

  const actions: AudioPipelineActions = useMemo(
    () => ({
      setSourceType: (type: AudioSourceType) => controller.setSourceType(type),
      startCapture: (sourceType?: AudioSourceType, options?: { deviceId?: string }) =>
        controller.start(sourceType, options),
      stopCapture: () => controller.stop(),
      switchDevice: (deviceId: string) => controller.switchDevice(deviceId),
      playBuffer: () => controller.playBuffer(),
      stopPlayback: () => controller.stopPlayback(),
      clearBuffer: () => controller.clearBuffer(),
      downloadWav: (filename?: string) => controller.downloadWav(filename),
      getWavBlob: () => controller.getWavBlob(),
      getRecentAudioBlob: (seconds?: number) => controller.getRecentAudioBlob(seconds),
      getRecentPcmSamples: (seconds?: number) => controller.getRecentPcmSamples(seconds),
      getAudioSegmentSince: (fromSample?: number, minDurationSec?: number) =>
        controller.getAudioSegmentSince(fromSample, minDurationSec),
      getRawSamplesSince: (fromSample?: number) => controller.getRawSamplesSince(fromSample),
      subscribeAudioFrames: (listener: (pcm16: Int16Array, totalSamples: number) => void) =>
        controller.subscribeAudioFrames(listener),
      pruneBefore: (sampleIndex: number) => controller.pruneBefore(sampleIndex),
      getLifecycleStats: () => controller.getLifecycleStats(),
      setVadEnergyThreshold: (threshold: number) => controller.setVadEnergyThreshold(threshold),
      getAudioMetrics: () => controller.getAudioMetrics(),
      getAnalyser: () => controller.getAnalyser(),
    }),
    [controller]
  )

  return useMemo(
    () => ({
      state,
      actions,
      ...state,
      ...actions,
    }),
    [state, actions]
  )
}
