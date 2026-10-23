import type { VisionSamplePreset } from '../types'
import type { CapturedImageInfo } from '../../../services/screen-capture/types'

/**
 * Renders a code/technical question snippet into a crisp PNG Data URL using HTML5 Canvas.
 */
export function generateSampleCanvasImage(sample: VisionSamplePreset): CapturedImageInfo {
  const canvas = document.createElement('canvas')
  const width = 1100
  const lineHeight = 28
  const padding = 36
  const height = Math.max(500, padding * 2 + (sample.textToDraw.length + 4) * lineHeight)

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }

  // Dark background matching IDE dark theme
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, width, height)

  // Top window frame simulating a code editor / browser tab
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, width, 44)

  // Window dots
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(24, 22, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(44, 22, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  ctx.arc(64, 22, 6, 0, Math.PI * 2)
  ctx.fill()

  // Window title
  ctx.fillStyle = '#94a3b8'
  ctx.font = '13px "JetBrains Mono", Consolas, monospace'
  ctx.fillText(sample.title, 88, 27)

  // Subtle border separator
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 44)
  ctx.lineTo(width, 44)
  ctx.stroke()

  // Render text lines with syntax-like coloring
  ctx.font = '15px "JetBrains Mono", Menlo, Consolas, monospace'
  let y = 44 + padding

  for (const line of sample.textToDraw) {
    if (line.startsWith('LeetCode') || line.startsWith('System Architecture') || line.startsWith('FATAL:')) {
      ctx.fillStyle = '#38bdf8' // bright cyan title
      ctx.font = 'bold 16px "JetBrains Mono", Consolas, monospace'
    } else if (line.startsWith('Difficulty:') || line.startsWith('Requirements:') || line.startsWith('DETAIL:')) {
      ctx.fillStyle = '#fbbf24' // amber
      ctx.font = '15px "JetBrains Mono", Consolas, monospace'
    } else if (line.startsWith('Example') || line.startsWith('Constraints:') || line.startsWith('HINT:')) {
      ctx.fillStyle = '#a78bfa' // violet
      ctx.font = 'bold 15px "JetBrains Mono", Consolas, monospace'
    } else if (line.trim().startsWith('-') || line.trim().startsWith('Input:') || line.trim().startsWith('Output:')) {
      ctx.fillStyle = '#4ade80' // emerald
      ctx.font = '15px "JetBrains Mono", Consolas, monospace'
    } else {
      ctx.fillStyle = '#e2e8f0' // light gray text
      ctx.font = '15px "JetBrains Mono", Consolas, monospace'
    }

    ctx.fillText(line, padding, y)
    y += lineHeight
  }

  const dataUrl = canvas.toDataURL('image/png')
  return {
    dataUrl,
    width,
    height,
    source: 'browser_display_media',
    capturedAt: Date.now(),
  }
}
