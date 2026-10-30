import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { ElectronLlmService } from '../services/llm/llmService'

describe('ElectronLlmService: transcribeGroq', () => {
  const originalFetch = globalThis.fetch
  let mockCredentialStore: any

  beforeEach(() => {
    mockCredentialStore = {
      getDecryptedKey: (provider: string) => (provider === 'groq' ? 'gsk_test_key_123' : null),
      normalizeProvider: (p: string) => p,
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('strips data:audio/wav;base64, prefix and correctly sends RIFF audio to Groq STT', async () => {
    let capturedBody: FormData | null = null
    let capturedHeaders: any = null

    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as FormData
      capturedHeaders = init?.headers as Record<string, string>
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: 'This is a test transcription.' }),
      } as any
    }) as any

    const service = new ElectronLlmService(mockCredentialStore)

    // A valid minimal WAV with 100 samples (244 bytes) encoded with data URL prefix
    const wavBytes = Buffer.alloc(244)
    wavBytes.write('RIFF', 0, 'ascii')
    wavBytes.writeUInt32LE(236, 4)
    wavBytes.write('WAVEfmt ', 8, 'ascii')
    wavBytes.writeUInt32LE(16, 16)
    wavBytes.writeUInt16LE(1, 20)
    wavBytes.writeUInt16LE(1, 22)
    wavBytes.writeUInt32LE(16000, 24)
    wavBytes.writeUInt32LE(32000, 28)
    wavBytes.writeUInt16LE(2, 32)
    wavBytes.writeUInt16LE(16, 34)
    wavBytes.write('data', 36, 'ascii')
    wavBytes.writeUInt32LE(200, 40)

    const base64WithPrefix = `data:audio/wav;base64,${wavBytes.toString('base64')}`

    const result = await service.transcribeGroq(base64WithPrefix, 'whisper-large-v3-turbo', 'en', 'context prompt')

    expect(result).not.toBeNull()
    expect(result!.text).toBe('This is a test transcription.')
    expect(capturedHeaders?.Authorization).toBe('Bearer gsk_test_key_123')

    expect(capturedBody).not.toBeNull()
    const file = capturedBody!.get('file') as File
    expect(file).not.toBeNull()
    expect(file.name).toBe('audio.wav')
    expect(file.type).toBe('audio/wav')

    // Inspect the actual bytes received by the File to ensure no prefix corruption
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    expect(fileBuffer.toString('ascii', 0, 4)).toBe('RIFF')
    expect(fileBuffer.toString('ascii', 8, 12)).toBe('WAVE')
  })

  it('skips API call and returns empty text when audio is empty or only header (<= 44 bytes)', async () => {
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return { ok: true, status: 200, json: async () => ({ text: '' }) } as any
    }) as any

    const service = new ElectronLlmService(mockCredentialStore)

    // Only 44-byte WAV header without actual samples
    const headerOnly = Buffer.alloc(44)
    headerOnly.write('RIFF', 0, 'ascii')
    headerOnly.write('WAVE', 8, 'ascii')

    const res = await service.transcribeGroq(headerOnly.toString('base64'), 'whisper-large-v3-turbo')

    expect(res).toEqual({ text: '', latencyMs: 0 })
    expect(fetchCalled).toBe(false)
  })

  it('handles empty or whitespace base64 string gracefully without calling Groq API', async () => {
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return { ok: true, status: 200, json: async () => ({ text: '' }) } as any
    }) as any

    const service = new ElectronLlmService(mockCredentialStore)

    const res = await service.transcribeGroq('   ', 'whisper-large-v3-turbo')
    expect(res).toEqual({ text: '', latencyMs: 0 })
    expect(fetchCalled).toBe(false)
  })

  it('detects WebM magic bytes and formats FormData as audio.webm', async () => {
    let capturedBody: FormData | null = null
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as FormData
      return { ok: true, status: 200, json: async () => ({ text: 'WebM transcript' }) } as any
    }) as any

    const service = new ElectronLlmService(mockCredentialStore)

    // WebM magic bytes: 0x1A 0x45 0xDF 0xA3 + dummy payload
    const webmBytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04])
    const res = await service.transcribeGroq(webmBytes.toString('base64'), 'whisper-large-v3-turbo')

    expect(res?.text).toBe('WebM transcript')
    const file = capturedBody!.get('file') as File
    expect(file.name).toBe('audio.webm')
    expect(file.type).toBe('audio/webm')
  })
})
