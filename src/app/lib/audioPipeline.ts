// ── High Performance Audio Pipeline Utilities & DSP ──────────────────────────

export type {
  AudioChunkMeta,
  AudioSourceType,
  PipelineStageInfo,
} from '../core/audio/types'

/**
 * Converts Float32Array [-1.0, 1.0] samples to 16-bit Linear PCM (Int16Array).
 * Standard format for Whisper, Google Speech-to-Text, and Deepgram.
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const len = float32.length
  const int16 = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

/**
 * Resamples Float32 audio samples to target sample rate (default 16,000 Hz).
 * Uses linear interpolation downsampling with fast bypass when sample rates match.
 */
export function downsampleTo16kHz(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return input
  }

  const ratio = inputSampleRate / targetSampleRate
  const newLength = Math.round(input.length / ratio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accum += input[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }

  return result
}

/**
 * Helper to write ASCII string to DataView for WAV header
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Packages 16-bit Linear PCM mono samples into a playable WAV Blob (16,000 Hz, 16-bit, 1-ch).
 * Single ArrayBuffer allocation with efficient DataView header writing.
 */
export function encodeWavBlob(
  samples: Int16Array,
  sampleRate: number = 16000
): Blob {
  const byteLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + byteLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + byteLength, true)
  writeString(view, 8, 'WAVE')

  // FMT sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true) // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true) // SampleRate (16000)
  view.setUint32(28, sampleRate * 2, true) // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true) // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true) // BitsPerSample (16 bits)

  // DATA sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, byteLength, true)

  // Fast write PCM samples directly into buffer via Int16Array view
  const pcmView = new Int16Array(buffer, 44, samples.length)
  pcmView.set(samples)

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Creates a standalone Transferable ArrayBuffer from Int16Array or Float32Array
 * for zero-copy transmission across Web Worker or IPC boundaries without memory cloning.
 */
export function createTransferablePcmBuffer(samples: Int16Array | Float32Array): ArrayBuffer {
  if (samples.byteOffset === 0 && samples.byteLength === samples.buffer.byteLength) {
    return samples.buffer as ArrayBuffer
  }
  return samples.buffer.slice(samples.byteOffset, samples.byteOffset + samples.byteLength) as ArrayBuffer
}

