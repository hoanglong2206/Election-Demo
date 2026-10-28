export interface SpectrumRenderParams {
  canvas: HTMLCanvasElement
  metricsBands: number[]
  smoothBands: Float32Array
  peakBands: Float32Array
  peakHoldFrames: Uint8Array
  isCapturing: boolean
  bandsCount?: number
}

/**
 * Pure 2D canvas drawing function for frequency spectrum with peak hold.
 * Returns true if animation should continue, false if completely idle.
 */
export function renderSpectrumFrame(params: SpectrumRenderParams): boolean {
  const {
    canvas,
    metricsBands,
    smoothBands,
    peakBands,
    peakHoldFrames,
    isCapturing,
    bandsCount = 24,
  } = params

  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const rect = canvas.getBoundingClientRect()
  const width = rect.width || canvas.width || 300
  const height = rect.height || canvas.height || 20

  const targetW = Math.max(1, Math.floor(width * dpr))
  const targetH = Math.max(1, Math.floor(height * dpr))
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }

  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const minHeight = isCapturing ? 2.5 : 1.5
  const gap = 2.5
  const barWidth = Math.max(2, (width - (bandsCount - 1) * gap) / bandsCount)

  for (let i = 0; i < bandsCount; i++) {
    const rawVal = metricsBands[i] || 0
    const targetHVal = isCapturing
      ? Math.max(minHeight, (rawVal / 100) * (height - 2))
      : minHeight

    if (targetHVal >= smoothBands[i]) {
      smoothBands[i] += (targetHVal - smoothBands[i]) * 0.45
    } else {
      smoothBands[i] = Math.max(minHeight, smoothBands[i] - 1.2)
    }

    if (smoothBands[i] >= peakBands[i]) {
      peakBands[i] = smoothBands[i]
      peakHoldFrames[i] = 12
    } else {
      if (peakHoldFrames[i] > 0) {
        peakHoldFrames[i]--
      } else {
        peakBands[i] = Math.max(smoothBands[i], peakBands[i] - 0.8)
      }
    }

    const x = i * (barWidth + gap)
    const barH = Math.min(height - 1, Math.max(minHeight, smoothBands[i]))
    const y = height - barH

    const grad = ctx.createLinearGradient(0, height, 0, y)
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.4)')
    if (rawVal > 60) {
      grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.85)')
      grad.addColorStop(1, 'rgba(236, 72, 153, 1)')
    } else if (rawVal > 25) {
      grad.addColorStop(0.7, 'rgba(56, 189, 248, 0.85)')
      grad.addColorStop(1, 'rgba(52, 211, 153, 1)')
    } else {
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.85)')
    }

    ctx.fillStyle = grad
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, barWidth, barH, [1.5, 1.5, 0, 0])
    } else {
      ctx.rect(x, y, barWidth, barH)
    }
    ctx.fill()

    if (peakBands[i] > minHeight + 1) {
      const peakY = Math.max(0, height - peakBands[i] - 1)
      ctx.fillStyle = rawVal > 60 ? '#f472b6' : '#6ee7b7'
      ctx.fillRect(x, peakY, barWidth, 1)
    }
  }

  ctx.restore()

  if (isCapturing) return true
  for (let i = 0; i < bandsCount; i++) {
    if (smoothBands[i] > minHeight + 0.5) {
      return true
    }
  }
  return false
}
