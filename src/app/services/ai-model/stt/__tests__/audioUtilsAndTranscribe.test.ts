import { describe, expect, it, mock } from 'bun:test'
import { base64ToBlob, blobToBase64 } from '../audioUtils'
import { transcribeAudio } from '../transcribe'

describe('audioUtils & transcribeAudio Groq STT', () => {
  it('blobToBase64 produces clean base64 without data URL prefix', async () => {
    const rawBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69])
    const blob = new Blob([rawBytes], { type: 'audio/wav' })
    const base64 = await blobToBase64(blob)

    expect(base64.startsWith('data:')).toBe(false)
    expect(base64).toBe('UklGRiQAAABXQVZF')
  })

  it('base64ToBlob handles strings with data: URL prefix safely', async () => {
    const dataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZF'
    const blob = base64ToBlob(dataUrl)
    expect(blob.size).toBe(12)
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    expect(bytes[0]).toBe(82) // 'R'
    expect(bytes[1]).toBe(73) // 'I'
    expect(bytes[2]).toBe(70) // 'F'
    expect(bytes[3]).toBe(70) // 'F'
  })

  it('base64ToBlob handles plain base64 strings without prefix', async () => {
    const plain = 'UklGRiQAAABXQVZF'
    const blob = base64ToBlob(plain)
    expect(blob.size).toBe(12)
  })

  it('transcribeAudio with Groq engine strips data URL prefix and sends clean base64', async () => {
    let capturedBase64 = ''
    const originalWindow = (globalThis as any).window

    try {
      ;(globalThis as any).window = {
        api: {
          credentials: {
            transcribeGroq: mock(async (audioBase64: string) => {
              capturedBase64 = audioBase64
              return { text: 'Hello world', latencyMs: 50 }
            }),
          },
        },
      }

      const rawBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69])
      const blob = new Blob([rawBytes], { type: 'audio/wav' })

      const res = await transcribeAudio(blob, 'whisper-large-v3-turbo', 'en')

      expect(res.success).toBe(true)
      expect(res.text).toBe('Hello world')
      expect(capturedBase64.startsWith('data:')).toBe(false)
      expect(capturedBase64).toBe('UklGRiQAAABXQVZF')
    } finally {
      ;(globalThis as any).window = originalWindow
    }
  })

  it('transcribeAudio encodes Int16Array PCM into a valid WAV header for Groq engine', async () => {
    let capturedBase64 = ''
    const originalWindow = (globalThis as any).window

    try {
      ;(globalThis as any).window = {
        api: {
          credentials: {
            transcribeGroq: mock(async (audioBase64: string) => {
              capturedBase64 = audioBase64
              return { text: 'Speech detected', latencyMs: 60 }
            }),
          },
        },
      }

      // 160 samples of Int16Array (10ms of 16kHz audio)
      const pcmSamples = new Int16Array(160)
      pcmSamples.fill(1000)

      const res = await transcribeAudio(pcmSamples, 'whisper-large-v3-turbo', 'en')

      expect(res.success).toBe(true)
      expect(res.text).toBe('Speech detected')
      expect(capturedBase64.length).toBeGreaterThan(0)

      // Decode captured base64 and check WAV RIFF header
      const buffer = Buffer.from(capturedBase64, 'base64')
      expect(buffer.toString('ascii', 0, 4)).toBe('RIFF')
      expect(buffer.toString('ascii', 8, 12)).toBe('WAVE')
      expect(buffer.length).toBe(44 + 160 * 2)
    } finally {
      ;(globalThis as any).window = originalWindow
    }
  })

  it('transcribeAudio handles empty transcription text from Groq without IPC required error', async () => {
    const originalWindow = (globalThis as any).window

    try {
      ;(globalThis as any).window = {
        api: {
          credentials: {
            transcribeGroq: mock(async () => {
              return { text: '', latencyMs: 40 }
            }),
          },
        },
      }

      const rawBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69])
      const blob = new Blob([rawBytes], { type: 'audio/wav' })

      const res = await transcribeAudio(blob, 'whisper-large-v3-turbo', 'auto')

      expect(res.success).toBe(true)
      expect(res.text).toBe('')
      expect(res.error).toBeUndefined()
    } finally {
      ;(globalThis as any).window = originalWindow
    }
  })
})
