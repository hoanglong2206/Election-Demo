import { describe, expect, it } from 'bun:test'
import { buildWavBufferFromPcm, createSilentWavBuffer, createWavHeader } from '../whisper'


describe('WAV Header Builder', () => {
  it('should generate a valid 44-byte standard RIFF/WAVE header', () => {
    const dataLength = 32000 // 1 second of 16kHz 16-bit mono
    const header = createWavHeader(dataLength, 16000, 1, 16)

    expect(header.length).toBe(44)
    // RIFF identifier
    expect(header.toString('ascii', 0, 4)).toBe('RIFF')
    // File size - 8
    expect(header.readUInt32LE(4)).toBe(36 + dataLength)
    // WAVE identifier
    expect(header.toString('ascii', 8, 12)).toBe('WAVE')
    // fmt chunk
    expect(header.toString('ascii', 12, 16)).toBe('fmt ')
    expect(header.readUInt32LE(16)).toBe(16) // Subchunk1Size (16 for PCM)
    expect(header.readUInt16LE(20)).toBe(1) // AudioFormat (1 = PCM)
    expect(header.readUInt16LE(22)).toBe(1) // NumChannels (1 = Mono)
    expect(header.readUInt32LE(24)).toBe(16000) // SampleRate
    expect(header.readUInt32LE(28)).toBe(32000) // ByteRate (16000 * 1 * 2)
    expect(header.readUInt16LE(32)).toBe(2) // BlockAlign (1 * 2)
    expect(header.readUInt16LE(34)).toBe(16) // BitsPerSample
    // data chunk
    expect(header.toString('ascii', 36, 40)).toBe('data')
    expect(header.readUInt32LE(40)).toBe(dataLength)
  })

  it('should assemble a WAV buffer from Int16Array PCM', () => {
    const pcm = new Int16Array(1600) // 100ms
    pcm[0] = 500
    pcm[1] = -500

    const wav = buildWavBufferFromPcm(pcm)
    expect(wav.length).toBe(44 + 3200)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readInt16LE(44)).toBe(500)
    expect(wav.readInt16LE(46)).toBe(-500)
  })

  it('should convert Float32Array PCM (-1.0 to 1.0) to 16-bit PCM WAV', () => {
    const floatPcm = new Float32Array(300)
    floatPcm[0] = 0.0
    floatPcm[1] = 0.5
    floatPcm[2] = -0.5

    const wav = buildWavBufferFromPcm(floatPcm)

    expect(wav.length).toBe(44 + 600)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')

    // 0.5 * 32767 ≈ 16383
    expect(wav.readInt16LE(46)).toBeCloseTo(16383, -1)
    // -0.5 * 32768 = -16384
    expect(wav.readInt16LE(48)).toBeCloseTo(-16384, -1)
  })

  it('should pad small chunks to avoid Whisper C++ crashes on underflow', () => {
    const tinyPcm = new Int16Array(10) // 20 bytes
    const wav = buildWavBufferFromPcm(tinyPcm)

    // Underflow protection: pads with at least 500 bytes (or 1s silence)
    expect(wav.length).toBeGreaterThanOrEqual(44 + 500)
    expect(wav.readUInt32LE(40)).toBeGreaterThanOrEqual(500)
  })

  it('should create 1-second silence WAV buffer for pre-warming', () => {
    const silence = createSilentWavBuffer(1.0)
    expect(silence.length).toBe(44 + 32000)
    expect(silence.readUInt32LE(24)).toBe(16000)
    expect(silence.readUInt32LE(40)).toBe(32000)
  })

  it('should handle already-encoded WAV buffers without re-wrapping', () => {
    const originalWav = createSilentWavBuffer(0.5)
    const passedThrough = buildWavBufferFromPcm(originalWav)
    expect(passedThrough.length).toBe(originalWav.length)
  })
})
