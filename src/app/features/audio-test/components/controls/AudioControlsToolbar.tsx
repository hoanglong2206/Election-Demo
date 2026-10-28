import type { AudioMetrics } from '@/core/audio/types'
import type { AudioDeviceInfo } from '@/services/audioDevices'
import { AudioSourceDeviceSelector } from './AudioSourceDeviceSelector'
import { AudioBufferActions } from './AudioBufferActions'
import { AudioSignalVisualizer } from './AudioSignalVisualizer'

export interface AudioControlsToolbarProps {
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
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 shadow-sm space-y-2.5">
      {/* ── ROW 1: Audio Source & Device Select + Action Controls ── */}
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        <AudioSourceDeviceSelector
          sourceType={sourceType}
          setSourceType={setSourceType}
          isCapturing={isCapturing}
          availableDevices={availableDevices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
        />

        <AudioBufferActions
          isCapturing={isCapturing}
          isStarting={isStarting}
          startCapture={startCapture}
          stopCapture={stopCapture}
          isPlaying={isPlaying}
          playBuffer={playBuffer}
          stopPlayback={stopPlayback}
          hasBuffer={hasBuffer}
          bufferDurationSec={bufferDurationSec}
          downloadWav={downloadWav}
          clearBuffer={clearBuffer}
          onOpenCalibration={onOpenCalibration}
          calibratedDb={calibratedDb}
          onEnterMeeting={onEnterMeeting}
        />
      </div>

      {/* ── ROW 2: High-Performance Visualizer Spectrum & VU Meter ── */}
      <AudioSignalVisualizer
        isCapturing={isCapturing}
        isAudioDetected={isAudioDetected}
        volume={volume}
        db={db}
        frequencyBands={frequencyBands}
        getAudioMetrics={getAudioMetrics}
      />
    </div>
  )
}
