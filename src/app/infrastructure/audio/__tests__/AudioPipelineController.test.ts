import { describe, expect, it, mock, beforeEach } from 'bun:test'
import {
  AudioPipelineController,
  type AudioPipelineState,
} from '../AudioPipelineController'
import type {
  IAudioCaptureService,
  IAudioBufferManager,
  IAudioPlaybackService,
  AudioSourceType,
} from '@/core/audio/types'

describe('AudioPipelineController', () => {
  let mockCaptureService: IAudioCaptureService
  let mockBufferManager: IAudioBufferManager
  let mockPlaybackService: IAudioPlaybackService
  let mockAudioProcessCallback: ((pcm16: Int16Array) => void) | null = null

  beforeEach(() => {
    mockAudioProcessCallback = null

    mockCaptureService = {
      isCapturing: false,
      engineType: 'audio_worklet',
      sampleRate: 16000,
      start: mock(async (_sourceType: AudioSourceType, onAudioProcess: (pcm16: Int16Array) => void) => {
        ;(mockCaptureService as any).isCapturing = true
        mockAudioProcessCallback = onAudioProcess
      }),
      stop: mock(() => {
        ;(mockCaptureService as any).isCapturing = false
      }),
      switchDevice: mock(async (_deviceId: string) => {}),
      getMetrics: mock(() => ({
        volume: 45,
        db: -18,
        frequencyBands: new Array(16).fill(20),
        isAudioDetected: true,
      })),
      getAnalyser: mock(() => null),
    }

    mockBufferManager = {
      totalSamples: 0,
      durationSec: 0,
      sizeBytes: 0,
      hasBuffer: false,
      bufferedSeconds: 0,
      estimatedMemoryBytes: 0,
      estimatedMemoryMb: 0,
      appendSamples: mock((_pcm16: Int16Array) => ({
        id: 1,
        index: 1,
        timestamp: '00:01',
        durationSec: 1.0,
        sizeBytes: 32000,
        sampleCount: 16000,
        rmsDb: -20,
      })),
      getAudioSegmentSince: mock(() => null),
      getRecentAudioBlob: mock(() => null),
      getFullWavBlob: mock(() => new Blob(['RIFF...fake'], { type: 'audio/wav' })),
      pruneBefore: mock((_sampleIndex: number) => {}),
      markChunkQueued: mock(() => {}),
      markChunkProcessing: mock(() => {}),
      markChunkReleased: mock(() => {}),
      vadEnergyThreshold: 0.015,
      setVadEnergyThreshold: mock((_thresh: number) => {}),
      clear: mock(() => {}),
    }

    mockPlaybackService = {
      isPlaying: false,
      play: mock(async (_blob: Blob, onEnd?: () => void) => {
        ;(mockPlaybackService as any).isPlaying = true
        setTimeout(() => {
          ;(mockPlaybackService as any).isPlaying = false
          onEnd?.()
        }, 10)
      }),
      stop: mock(() => {
        ;(mockPlaybackService as any).isPlaying = false
      }),
    }
  })

  it('initializes with default idle state and 6 pipeline stages', () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'default-mic',
      getEffectiveThreshold: () => 0.015,
    })

    const state = controller.getState()
    expect(state.lifecycleState).toBe('idle')
    expect(state.isCapturing).toBe(false)
    expect(state.isStarting).toBe(false)
    expect(state.pipelineStages.length).toBe(6)
    expect(state.pipelineStages[0].name).toBe('System audio')
  })

  it('handles full lifecycle: start -> capturing -> frame processed -> stop', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'default-mic',
      getEffectiveThreshold: () => 0.02,
    })

    const states: AudioPipelineState[] = []
    controller.subscribe((s) => states.push(s))

    await controller.start('system')

    expect(controller.getState().lifecycleState).toBe('capturing')
    expect(controller.getState().isCapturing).toBe(true)
    expect(mockCaptureService.start).toHaveBeenCalled()
    expect(mockBufferManager.setVadEnergyThreshold).toHaveBeenCalledWith(0.02)

    // Simulate incoming audio PCM frame
    let frameEmitted = false
    controller.subscribeAudioFrames((_pcm16, _total) => {
      frameEmitted = true
    })

    const fakeFrame = new Int16Array(2048)
    mockAudioProcessCallback!(fakeFrame)

    expect(mockBufferManager.appendSamples).toHaveBeenCalledWith(fakeFrame)
    expect(frameEmitted).toBe(true)
    expect(controller.getState().chunks.length).toBe(1)

    // Stop capture
    controller.stop()
    expect(controller.getState().lifecycleState).toBe('idle')
    expect(controller.getState().isCapturing).toBe(false)
    expect(mockCaptureService.stop).toHaveBeenCalled()

    controller.destroy()
  })

  it('safely handles rapid start -> stop -> start toggling without corruption', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'default-mic',
      getEffectiveThreshold: () => 0.015,
    })

    // Start 1
    const p1 = controller.start('mic')
    // Stop immediately
    controller.stop()
    await p1

    // Start 2
    await controller.start('system')
    expect(controller.getState().lifecycleState).toBe('capturing')
    expect(controller.getState().sourceType).toBe('system')

    controller.destroy()
  })

  it('switches device on the fly and updates VAD threshold', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'mic-1',
      getEffectiveThreshold: (devId) => (devId === 'mic-2' ? 0.035 : 0.015),
    })

    await controller.start('mic')
    await controller.switchDevice('mic-2')

    expect(mockCaptureService.switchDevice).toHaveBeenCalledWith('mic-2')
    expect(controller.getState().vadEnergyThreshold).toBe(0.035)

    controller.destroy()
  })

  it('detects external disconnect and transitions safely to idle', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'mic-1',
      getEffectiveThreshold: () => 0.015,
    })

    await controller.start('mic')
    expect(controller.getState().isCapturing).toBe(true)

    // Simulate hardware disconnect
    ;(mockCaptureService as any).isCapturing = false

    // Wait for presence check interval
    await new Promise((resolve) => setTimeout(resolve, 450))

    expect(controller.getState().lifecycleState).toBe('idle')
    expect(controller.getState().isCapturing).toBe(false)

    controller.destroy()
  })

  it('manages buffer clearing, WAV export and playback lifecycle', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
      getSavedDeviceId: () => 'mic-1',
      getEffectiveThreshold: () => 0.015,
    })

    // Playback
    await controller.playBuffer()
    expect(controller.getState().isPlaying).toBe(true)
    expect(mockPlaybackService.play).toHaveBeenCalled()

    controller.stopPlayback()
    expect(controller.getState().isPlaying).toBe(false)

    // Clear buffer
    controller.clearBuffer()
    expect(mockBufferManager.clear).toHaveBeenCalled()

    // WAV blob
    const blob = controller.getWavBlob()
    expect(blob).not.toBeNull()

    controller.destroy()
  })

  it('isolates capture ownership between meeting and audio-test and ignores mismatched stop calls', async () => {
    const controller = new AudioPipelineController({
      captureService: mockCaptureService,
      bufferManager: mockBufferManager,
      playbackService: mockPlaybackService,
    })

    // 1. Start meeting capture
    await controller.start('system', { owner: 'meeting' })
    expect(controller.getState().isCapturing).toBe(true)
    expect(controller.getState().captureOwner).toBe('meeting')
    expect(controller.isOwnedCapture('meeting')).toBe(true)
    expect(controller.isOwnedCapture('audio-test')).toBe(false)

    // 2. Audio-test calls stop('audio-test') on unmount: should NOT stop meeting!
    controller.stop('audio-test')
    expect(controller.getState().isCapturing).toBe(true)
    expect(controller.getState().captureOwner).toBe('meeting')

    // 3. Meeting stops its own session
    controller.stop('meeting')
    expect(controller.getState().isCapturing).toBe(false)
    expect(controller.getState().captureOwner).toBeNull()

    // 4. Start audio-test capture
    await controller.start('mic', { owner: 'audio-test' })
    expect(controller.getState().isCapturing).toBe(true)
    expect(controller.getState().captureOwner).toBe('audio-test')
    expect(controller.isOwnedCapture('audio-test')).toBe(true)
    expect(controller.isOwnedCapture('meeting')).toBe(false)

    // 5. Meeting unmount/exit calling stop('meeting') must NOT stop audio-test!
    controller.stop('meeting')
    expect(controller.getState().isCapturing).toBe(true)
    expect(controller.getState().captureOwner).toBe('audio-test')

    controller.destroy()
  })
})
