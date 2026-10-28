import '@/test/setupDom'
import { describe, expect, it, mock } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useAudioPipeline } from '../useAudioPipeline'
import { AudioPipelineController } from '@/infrastructure/audio/AudioPipelineController'
import type {
  IAudioCaptureService,
  IAudioBufferManager,
  IAudioPlaybackService,
} from '@/core/audio/types'

describe('useAudioPipeline', () => {
  it('connects to AudioPipelineController and reflects its state and actions', async () => {
    const mockCapture: IAudioCaptureService = {
      isCapturing: false,
      engineType: 'audio_worklet',
      sampleRate: 16000,
      start: mock(async () => {
        ;(mockCapture as any).isCapturing = true
      }),
      stop: mock(() => {
        ;(mockCapture as any).isCapturing = false
      }),
      switchDevice: mock(async () => {}),
      getMetrics: mock(() => ({
        volume: 0,
        db: -60,
        frequencyBands: new Array(16).fill(0),
        isAudioDetected: false,
      })),
    }

    const mockBuffer: IAudioBufferManager = {
      totalSamples: 0,
      durationSec: 0,
      sizeBytes: 0,
      hasBuffer: false,
      bufferedSeconds: 0,
      estimatedMemoryBytes: 0,
      estimatedMemoryMb: 0,
      appendSamples: mock(() => null),
      getAudioSegmentSince: mock(() => null),
      getRecentAudioBlob: mock(() => null),
      getFullWavBlob: mock(() => null),
      pruneBefore: mock(() => {}),
      markChunkQueued: mock(() => {}),
      markChunkProcessing: mock(() => {}),
      markChunkReleased: mock(() => {}),
      clear: mock(() => {}),
    }

    const mockPlayback: IAudioPlaybackService = {
      isPlaying: false,
      play: mock(async () => {}),
      stop: mock(() => {}),
    }

    const testController = new AudioPipelineController({
      captureService: mockCapture,
      bufferManager: mockBuffer,
      playbackService: mockPlayback,
      getSavedDeviceId: () => 'mic-1',
      getEffectiveThreshold: () => 0.015,
    })

    const { result } = renderHook(() => useAudioPipeline(testController))

    // Check state shape
    expect(result.current.state).toBeDefined()
    expect(result.current.actions).toBeDefined()
    expect(result.current.isCapturing).toBe(false)
    expect(result.current.state.lifecycleState).toBe('idle')

    // Test action triggers
    await act(async () => {
      await result.current.startCapture('system')
    })

    expect(result.current.isCapturing).toBe(true)
    expect(result.current.state.lifecycleState).toBe('capturing')
    expect(mockCapture.start).toHaveBeenCalled()

    // Test stop
    act(() => {
      result.current.stopCapture()
    })

    expect(result.current.isCapturing).toBe(false)
    expect(result.current.state.lifecycleState).toBe('idle')
    expect(mockCapture.stop).toHaveBeenCalled()

    act(() => {
      testController.destroy()
    })
  })
})
