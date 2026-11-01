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
    return {
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      width,
      height,
      source: 'browser_display_media',
      capturedAt: Date.now(),
    }
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

  // Horizontal separator below window frame
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 44)
  ctx.lineTo(width, 44)
  ctx.stroke()

  // Render code/question lines
  ctx.font = '15px "JetBrains Mono", Consolas, monospace'
  let currentY = 44 + padding

  for (let i = 0; i < sample.textToDraw.length; i++) {
    const line = sample.textToDraw[i]

    // Line number in left gutter
    ctx.fillStyle = '#475569'
    ctx.fillText(String(i + 1).padStart(3, ' '), padding, currentY)

    // Code / description text
    if (line.startsWith('LeetCode') || line.startsWith('System') || line.startsWith('FATAL')) {
      ctx.fillStyle = '#38bdf8' // bright cyan highlight for title lines
    } else if (line.includes('Difficulty') || line.includes('DETAIL') || line.includes('HINT')) {
      ctx.fillStyle = '#fbbf24' // amber for metadata
    } else if (line.trim().startsWith('-') || line.trim().startsWith('Input:') || line.trim().startsWith('Output:')) {
      ctx.fillStyle = '#34d399' // emerald for I/O & bullets
    } else {
      ctx.fillStyle = '#e2e8f0' // light gray for standard code
    }

    ctx.fillText(line, padding + 48, currentY)
    currentY += lineHeight
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
    source: 'browser_display_media',
    capturedAt: Date.now(),
  }
}
