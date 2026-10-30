import { Buffer } from 'node:buffer'

/**
 * High-performance In-Memory WAV Header & PCM Audio Formatter
 * Formats Float32Array, Int16Array, Uint8Array, Buffer, or ArrayBuffer into standard
 * 16,000 Hz 16-bit Mono Linear PCM WAV format with a 44-byte RIFF header.
 * Eliminates all disk writes and temporary file creation on the main process.
 */

export const TARGET_SAMPLE_RATE = 16000
export const BITS_PER_SAMPLE = 16
export const CHANNELS = 1
export const BYTES_PER_SAMPLE = 2
export const WAV_HEADER_SIZE = 44

/**
 * Creates a standard 44-byte RIFF/WAVE header for linear PCM audio.
 */
export function writeWavHeader(buffer: Buffer, pcmByteLength: number, sampleRate = TARGET_SAMPLE_RATE): void {
  // 1. RIFF Chunk Descriptor
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + pcmByteLength, 4) // ChunkSize: 36 + SubChunk2Size
  buffer.write('WAVE', 8, 'ascii')

  // 2. fmt Sub-chunk
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16) // Subchunk1Size: 16 for PCM
  buffer.writeUInt16LE(1, 20) // AudioFormat: 1 = Linear PCM
  buffer.writeUInt16LE(CHANNELS, 22) // NumChannels: 1 = Mono
  buffer.writeUInt32LE(sampleRate, 24) // SampleRate: 16000
  buffer.writeUInt32LE(sampleRate * CHANNELS * BYTES_PER_SAMPLE, 28) // ByteRate
  buffer.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32) // BlockAlign: 2 bytes
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34) // BitsPerSample: 16 bits

  // 3. data Sub-chunk
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(pcmByteLength, 40) // Subchunk2Size
}

/**
 * Creates and returns a standalone 44-byte WAV header Buffer.
 */
export function createWavHeader(
  dataLength: number,
  sampleRate = TARGET_SAMPLE_RATE,
  _channels = CHANNELS,
  _bitsPerSample = BITS_PER_SAMPLE
): Buffer {
  const buf = Buffer.alloc(WAV_HEADER_SIZE)
  writeWavHeader(buf, dataLength, sampleRate)
  return buf
}

/**
 * Converts Float32Array audio samples (range [-1.0, 1.0]) to 16-bit signed PCM Buffer.
 */
export function float32ToPcmBuffer(float32: Float32Array): Buffer {
  const pcmBuffer = Buffer.alloc(float32.length * 2)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    const val = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
    pcmBuffer.writeInt16LE(val, i * 2)
  }
  return pcmBuffer
}

/**
 * Checks if a buffer already starts with a valid RIFF/WAVE 44-byte header.
 */
export function hasWavHeader(buf: Buffer): boolean {
  if (buf.length < WAV_HEADER_SIZE) return false
  return (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE' &&
    buf.toString('ascii', 12, 16) === 'fmt '
  )
}

export type RawAudioInput =
  | Buffer
  | ArrayBuffer
  | Uint8Array
  | Int16Array
  | Float32Array
  | string // Base64 string or data URL

/**
 * Converts any audio input (Float32, Int16, Buffer, ArrayBuffer, base64) into
 * a valid, playable 16kHz 16-bit Mono WAV Buffer in memory.
 * If audio is too short (< 500 bytes), pads with 1s of silence to avoid whisper crash.
 */
export function createWavBuffer(input: RawAudioInput, sampleRate = TARGET_SAMPLE_RATE): Buffer {
  let pcmBytes: Buffer

  if (typeof input === 'string') {
    const cleanBase64 = input.replace(/^data:[^;]+;base64,/, '').trim()
    const rawBuffer = Buffer.from(cleanBase64, 'base64')
    if (hasWavHeader(rawBuffer)) {
      return rawBuffer
    }
    pcmBytes = rawBuffer
  } else if (input instanceof Float32Array) {
    pcmBytes = float32ToPcmBuffer(input)
  } else if (input instanceof Int16Array) {
    pcmBytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
  } else if (Buffer.isBuffer(input)) {
    if (hasWavHeader(input)) {
      return input
    }
    pcmBytes = input
  } else if (input instanceof ArrayBuffer) {
    const raw = Buffer.from(input)
    if (hasWavHeader(raw)) {
      return raw
    }
    pcmBytes = raw
  } else if (input instanceof Uint8Array) {
    const raw = Buffer.from(input.buffer, input.byteOffset, input.byteLength)
    if (hasWavHeader(raw)) {
      return raw
    }
    pcmBytes = raw
  } else {
    throw new Error('Unsupported audio input format')
  }

  // If buffer is too short, pad with 1 second of silence (16000 samples = 32000 bytes)
  if (pcmBytes.length < 500) {
    const silentSamples = sampleRate * 1 // 1 second
    const silentBytes = silentSamples * 2
    const totalWav = Buffer.alloc(WAV_HEADER_SIZE + silentBytes)
    writeWavHeader(totalWav, silentBytes, sampleRate)
    totalWav.fill(0, WAV_HEADER_SIZE)
    return totalWav
  }

  const wavBuffer = Buffer.alloc(WAV_HEADER_SIZE + pcmBytes.length)
  writeWavHeader(wavBuffer, pcmBytes.length, sampleRate)
  pcmBytes.copy(wavBuffer, WAV_HEADER_SIZE)
  return wavBuffer
}

/**
 * Generates an in-memory 1-second silence WAV buffer (useful for pre-warming Whisper).
 */
export function createSilentWavBuffer(seconds = 1, sampleRate = TARGET_SAMPLE_RATE): Buffer {
  const samples = sampleRate * seconds
  const byteLength = samples * 2
  const buf = Buffer.alloc(WAV_HEADER_SIZE + byteLength)
  writeWavHeader(buf, byteLength, sampleRate)
  buf.fill(0, WAV_HEADER_SIZE)
  return buf
}

export const buildWavBufferFromPcm = createWavBuffer
