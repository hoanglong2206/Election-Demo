import { describe, expect, it } from 'bun:test'
import {
  float32ToInt16,
  downsampleTo16kHz,
  encodeWavBlob,
  createTransferablePcmBuffer,
} from '../dsp'

describe('core/audio/dsp', () => {
  describe('float32ToInt16', () => {
    it('converts normalized float32 samples to 16-bit PCM correctly', () => {
      const input = new Float32Array([0, 1.0, -1.0, 0.5, -0.5])
      const output = float32ToInt16(input)

      expect(output.length).toBe(5)
      expect(output[0]).toBe(0)
      expect(output[1]).toBe(32767) // 0x7fff
      expect(output[2]).toBe(-32768) // -0x8000
      expect(output[3]).toBe(Math.floor(0.5 * 32767))
      expect(output[4]).toBe(Math.floor(-0.5 * 32768))
    })

    it('clamps values outside [-1.0, 1.0]', () => {
      const input = new Float32Array([2.5, -3.0])
      const output = float32ToInt16(input)

      expect(output[0]).toBe(32767)
      expect(output[1]).toBe(-32768)
    })
  })

  describe('downsampleTo16kHz', () => {
    it('returns the same instance if input rate is already 16,000 Hz', () => {
      const input = new Float32Array([0.1, 0.2, 0.3])
      const output = downsampleTo16kHz(input, 16000, 16000)
      expect(output).toBe(input)
    })

    it('downsamples from 48,000 Hz to 16,000 Hz (3:1 ratio)', () => {
      // 6 input samples at 48kHz should become 2 samples at 16kHz
      const input = new Float32Array([0.3, 0.3, 0.3, 0.6, 0.6, 0.6])
      const output = downsampleTo16kHz(input, 48000, 16000)

      expect(output.length).toBe(2)
      expect(Math.abs(output[0] - 0.3)).toBeLessThan(0.01)
      expect(Math.abs(output[1] - 0.6)).toBeLessThan(0.01)
    })

    it('handles empty input', () => {
      const input = new Float32Array(0)
      const output = downsampleTo16kHz(input, 44100, 16000)
      expect(output.length).toBe(0)
    })
  })

  describe('encodeWavBlob', () => {
    it('creates a valid WAV blob with 44-byte RIFF/WAVE header and correct byte length', async () => {
      const samples = new Int16Array([1000, -1000, 2000, -2000])
      const blob = encodeWavBlob(samples, 16000)

      expect(blob).toBeDefined()
      expect(blob.type).toBe('audio/wav')
      expect(blob.size).toBe(44 + samples.length * 2)

      const arrayBuffer = await blob.arrayBuffer()
      const view = new DataView(arrayBuffer)

      // Check RIFF header magic bytes
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      )
      expect(riff).toBe('RIFF')

      const wave = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      )
      expect(wave).toBe('WAVE')

      // Check sample rate
      expect(view.getUint32(24, true)).toBe(16000)
      // Check bits per sample
      expect(view.getUint16(34, true)).toBe(16)
    })
  })

  describe('createTransferablePcmBuffer', () => {
    it('returns underlying ArrayBuffer directly if aligned to start', () => {
      const samples = new Int16Array(100)
      const buffer = createTransferablePcmBuffer(samples)
      expect(buffer).toBe(samples.buffer)
    })

    it('returns a sliced standalone ArrayBuffer if subarray with offset', () => {
      const full = new Int16Array(100)
      const sub = full.subarray(10, 30) // offset = 20 bytes, length = 40 bytes
      const buffer = createTransferablePcmBuffer(sub)

      expect(buffer.byteLength).toBe(40)
      expect(buffer).not.toBe(full.buffer)
    })
  })
})
