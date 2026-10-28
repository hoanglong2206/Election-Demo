import { describe, it, expect } from 'bun:test'
import { computePipelineOverview } from '../pipelineStagesHelper'
import type { STTQueueMetrics } from '@/services/ai-model/stt'

describe('pipelineStagesHelper: computePipelineOverview', () => {
  const baseMetrics: STTQueueMetrics = {
    provider: 'Local',
    queueDepth: 0,
    processingJobs: 0,
    completedJobs: 0,
    concurrency: 1,
    averageWaitTime: 0,
    droppedJobs: 0,
    succeededJobs: 0,
    failedJobs: 0,
    enqueuedJobs: 0,
    isPaused: false,
    workerState: 'READY',
  }

  it('reports capture error when captureError is present', () => {
    const res = computePipelineOverview({
      pipelineStages: [{ stage: 1, name: 'Audio capture', status: 'idle', detail: '' }],
      bufferDurationSec: 0,
      bufferSizeBytes: 0,
      chunks: [],
      queueMetrics: baseMetrics,
      isCapturing: false,
      isStarting: false,
      sourceType: 'mic',
      isAudioDetected: false,
      captureError: 'Microphone not permitted',
      inputSampleRateHz: null,
    })

    expect(res.overallLabel).toBe('Không mở được nguồn âm thanh')
    expect(res.adviceTone).toBe('error')
    expect(res.advice).toContain('Microphone not permitted')
    expect(res.stages[0].status).toBe('error')
  })

  it('reports idle state when not capturing', () => {
    const res = computePipelineOverview({
      pipelineStages: [{ stage: 1, name: 'Audio capture', status: 'idle', detail: '' }],
      bufferDurationSec: 0,
      bufferSizeBytes: 0,
      chunks: [],
      queueMetrics: baseMetrics,
      isCapturing: false,
      isStarting: false,
      sourceType: 'system',
      isAudioDetected: false,
      captureError: null,
      inputSampleRateHz: null,
    })

    expect(res.overallLabel).toBe('Chưa bắt đầu thu âm')
    expect(res.advice).toBeNull()
    expect(res.stages[0].status).toBe('idle')
  })

  it('reports active capture without detected signal', () => {
    const res = computePipelineOverview({
      pipelineStages: [
        { stage: 1, name: 'Capture', status: 'idle', detail: '' },
        { stage: 4, name: 'Buffer', status: 'idle', detail: '' },
      ],
      bufferDurationSec: 2.5,
      bufferSizeBytes: 80000,
      chunks: [],
      queueMetrics: baseMetrics,
      isCapturing: true,
      isStarting: false,
      sourceType: 'mic',
      isAudioDetected: false,
      captureError: null,
      inputSampleRateHz: 48000,
    })

    expect(res.overallLabel).toBe('Đang thu nhưng chưa phát hiện tín hiệu')
    expect(res.advice).toContain('Nói gần micro')
    expect(res.stages[0].status).toBe('active')
    expect(res.stages[1].status).toBe('ready')
  })

  it('reports worker failure when workerState is FAILED', () => {
    const metrics: STTQueueMetrics = {
      ...baseMetrics,
      workerState: 'FAILED',
    }
    const res = computePipelineOverview({
      pipelineStages: [{ stage: 6, name: 'STT', status: 'idle', detail: '' }],
      bufferDurationSec: 0,
      bufferSizeBytes: 0,
      chunks: [],
      queueMetrics: metrics,
      isCapturing: true,
      isStarting: false,
      sourceType: 'mic',
      isAudioDetected: true,
      captureError: null,
      inputSampleRateHz: 48000,
    })

    expect(res.overallLabel).toBe('STT gặp lỗi')
    expect(res.adviceTone).toBe('error')
    expect(res.advice).toContain('Local Whisper worker không sẵn sàng')
    expect(res.stages[0].status).toBe('error')
  })

  it('reports active pipeline with successful chunks and chunks formatting', () => {
    const metrics: STTQueueMetrics = {
      ...baseMetrics,
      succeededJobs: 5,
      enqueuedJobs: 5,
    }
    const mockChunks = [
      { id: 'c1', index: 5, durationSec: 1.2, rmsDb: -28.5 },
      { id: 'c0', index: 4, durationSec: 1.0, rmsDb: -32.0 },
    ] as any

    const res = computePipelineOverview({
      pipelineStages: [
        { stage: 5, name: 'Chunks', status: 'idle', detail: '' },
        { stage: 6, name: 'STT', status: 'idle', detail: '' },
      ],
      bufferDurationSec: 5.0,
      bufferSizeBytes: 160000,
      chunks: mockChunks,
      queueMetrics: metrics,
      isCapturing: true,
      isStarting: false,
      sourceType: 'system',
      isAudioDetected: true,
      captureError: null,
      inputSampleRateHz: 44100,
    })

    expect(res.overallLabel).toContain('5 chunk STT thành công')
    expect(res.stages[0].status).toBe('ready')
    expect(res.stages[0].detail).toContain('5 chunk đã tạo')
    expect(res.stages[1].status).toBe('ready')
  })
})
