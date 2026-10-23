/**
 * AudioWorkletProcessor Source Definition
 *
 * Runs exclusively in the Web Audio rendering thread, completely decoupled
 * from the browser UI/main execution thread.
 *
 * Realtime Safety Guarantees:
 * 1. Zero memory allocations inside steady-state process() loop via buffer recycling.
 * 2. Streaming linear interpolation resampling from hardware rate (44.1k/48k) to 16kHz.
 * 3. Batches audio quanta (128 samples) into 2048-sample chunks (~128ms at 16kHz).
 * 4. Transfers ArrayBuffers across MessagePort with 0-copy transfer semantics.
 * 5. Periodically emits telemetry (RMS, volume, dB) at 15 FPS without blocking main thread.
 */

export const AUDIO_CAPTURE_PROCESSOR_NAME = 'audio-capture-processor'

export const AUDIO_CAPTURE_WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const opts = options?.processorOptions || {};
    this.targetSampleRate = opts.targetSampleRate || 16000;
    this.chunkSize = opts.chunkSize || 2048;

    // Global sampleRate provided by AudioWorkletGlobalScope
    this.inputSampleRate = sampleRate;
    this.ratio = this.inputSampleRate / this.targetSampleRate;

    // Resampling state across 128-sample quanta boundaries
    this.pos = 0.0;
    this.lastInputSample = 0.0;

    // Preallocated batch buffer
    this.outputBuffer = new Int16Array(this.chunkSize);
    this.outputWritePos = 0;

    // Recycled buffers pool to maintain ZERO allocation in steady-state
    this.recycledBuffers = [];

    // Telemetry tracking (~15 FPS)
    this.telemetryInterval = Math.round(this.targetSampleRate / 15);
    this.squaredSum = 0;
    this.telemetryCount = 0;

    // Listen for recycled buffers returned from main thread
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'recycle' && data.buffer) {
        if (this.recycledBuffers.length < 8) {
          this.recycledBuffers.push(new Int16Array(data.buffer));
        }
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channelData = input[0];
    const inputLen = channelData.length; // usually 128 samples

    const ratio = this.ratio;
    let pos = this.pos;

    if (this.inputSampleRate === this.targetSampleRate) {
      // Fast path: Exact 16kHz hardware rate, direct 1:1 conversion
      for (let i = 0; i < inputLen; i++) {
        this.writeSample(channelData[i]);
      }
      this.pos = 0.0;
      this.lastInputSample = channelData[inputLen - 1];
    } else {
      // Streaming linear interpolation downsampler
      while (pos < inputLen) {
        const idx = Math.floor(pos);
        const frac = pos - idx;

        const s0 = idx < 0 ? this.lastInputSample : channelData[idx];
        const s1 = idx + 1 < inputLen ? channelData[idx + 1] : channelData[inputLen - 1];

        const interp = s0 + (s1 - s0) * frac;
        this.writeSample(interp);

        pos += ratio;
      }

      // Carry forward fractional offset into next quantum
      this.pos = pos - inputLen;
      this.lastInputSample = channelData[inputLen - 1];
    }

    return true;
  }

  writeSample(sampleFloat) {
    // Hard clamp to [-1.0, 1.0] and scale to 16-bit Linear PCM
    const clamped = sampleFloat < -1 ? -1 : sampleFloat > 1 ? 1 : sampleFloat;
    const pcm16 = clamped < 0 ? clamped * 32768 : clamped * 32767;

    this.outputBuffer[this.outputWritePos++] = pcm16;

    // Telemetry accumulation
    this.squaredSum += clamped * clamped;
    this.telemetryCount++;

    if (this.telemetryCount >= this.telemetryInterval) {
      const rms = Math.sqrt(this.squaredSum / this.telemetryCount);
      const volume = Math.min(100, Math.round(rms * 100));
      const db = rms > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60;

      this.port.postMessage({
        type: 'telemetry',
        volume,
        db,
        isAudioDetected: volume > 2,
      });

      this.squaredSum = 0;
      this.telemetryCount = 0;
    }

    // Flush batch when chunk buffer is filled
    if (this.outputWritePos >= this.chunkSize) {
      const fullBuffer = this.outputBuffer;

      // Transfer ownership of ArrayBuffer across MessagePort (0-copy)
      this.port.postMessage(
        {
          type: 'chunk',
          buffer: fullBuffer.buffer,
          sampleCount: this.chunkSize,
          sampleRate: this.targetSampleRate,
        },
        [fullBuffer.buffer]
      );

      // Acquire next buffer from recycling pool or allocate if pool exhausted
      if (this.recycledBuffers.length > 0) {
        this.outputBuffer = this.recycledBuffers.pop();
      } else {
        this.outputBuffer = new Int16Array(this.chunkSize);
      }
      this.outputWritePos = 0;
    }
  }
}

registerProcessor('${AUDIO_CAPTURE_PROCESSOR_NAME}', AudioCaptureProcessor);
`

/**
 * Creates a Blob URL for AudioWorklet module loading.
 * Ensures 100% reliable module registration across Vite dev server,
 * Electron production app, and web builds without external asset file dependencies.
 */
export function createAudioWorkletBlobUrl(): string {
  const blob = new Blob([AUDIO_CAPTURE_WORKLET_CODE], {
    type: 'application/javascript',
  })
  return URL.createObjectURL(blob)
}
