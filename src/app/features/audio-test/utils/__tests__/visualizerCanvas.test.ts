import { describe, it, expect, mock } from 'bun:test'
import { renderSpectrumFrame } from '../visualizerCanvas'

describe('visualizerCanvas: renderSpectrumFrame', () => {
  it('returns false when 2d context is not supported', () => {
    const canvas = {
      getContext: () => null,
      width: 300,
      height: 20,
      getBoundingClientRect: () => ({ width: 300, height: 20 }),
    } as unknown as HTMLCanvasElement

    const res = renderSpectrumFrame({
      canvas,
      metricsBands: [],
      smoothBands: new Float32Array(24),
      peakBands: new Float32Array(24),
      peakHoldFrames: new Uint8Array(24),
      isCapturing: false,
    })

    expect(res).toBe(false)
  })

  it('draws spectrum bars and returns true when capturing', () => {
    const mockCtx = {
      save: mock(() => {}),
      restore: mock(() => {}),
      scale: mock(() => {}),
      clearRect: mock(() => {}),
      createLinearGradient: mock(() => ({
        addColorStop: mock(() => {}),
      })),
      beginPath: mock(() => {}),
      roundRect: mock(() => {}),
      rect: mock(() => {}),
      fill: mock(() => {}),
      fillRect: mock(() => {}),
    }

    const canvas = {
      getContext: () => mockCtx,
      width: 300,
      height: 20,
      getBoundingClientRect: () => ({ width: 300, height: 20 }),
    } as unknown as HTMLCanvasElement

    const smoothBands = new Float32Array(24)
    const peakBands = new Float32Array(24)
    const peakHoldFrames = new Uint8Array(24)
    const metricsBands = [50, 75, 20, 10]

    const res = renderSpectrumFrame({
      canvas,
      metricsBands,
      smoothBands,
      peakBands,
      peakHoldFrames,
      isCapturing: true,
    })

    expect(res).toBe(true)
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 300, 20)
    expect(mockCtx.fill).toHaveBeenCalled()
    expect(smoothBands[0]).toBeGreaterThan(0)
  })
})
