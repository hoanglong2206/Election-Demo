import { encodeWavBlob } from '../../lib/audioPipeline'
import type {
  AudioChunkLifecycleState,
  AudioChunkMeta,
  AudioLifecycleStats,
  AudioSegment,
  IAudioBufferManager,
} from './types'

export const TARGET_SAMPLE_RATE = 16000
export const CHUNK_SAMPLES = 16000 // 1.0 second chunk @ 16kHz
export const VAD_ENERGY_THRESHOLD = 0.008 // approx -42 dB noise floor
export const DEFAULT_MAX_BUFFERED_SEC = 15.0 // Bounded ring buffer: 15s max audio retained in memory
export const PRE_ROLL_SEC = 2.0 // Retain 2.0s pre-roll for VAD overlap before pruning

interface BoundedBufferItem {
  startSample: number
  data: Int16Array
}

/**
 * AudioBufferManager
 *
 * Implements a bounded sliding-window PCM buffer, eliminating memory leaks
 * in long meetings (60–120+ minutes).
 *
 * Key Architecture:
 * 1. Bounded sliding window: Retains at most `maxBufferedDurationSec` (default 15s / 480KB)
 *    instead of accumulating hours of raw Int16Arrays.
 * 2. Prunes consumed audio chunks prior to `fromSample - PRE_ROLL_SEC`.
 * 3. Lifecycle State Machine for audio chunks: `recording` → `queued` → `processing` → `released`.
 * 4. Zero unbounded memory growth: Memory stays O(1) in bounded range across 60–120 min meetings.
 * 5. GC-friendly: Old typed arrays are dereferenced for natural V8 garbage collection (no manual GC).
 */
export class AudioBufferManager implements IAudioBufferManager {
  private buffers: BoundedBufferItem[] = []
  private _baseSampleIndex = 0 // Absolute sample index of buffers[0]
  private _totalSamples = 0 // Monotonic cumulative samples recorded
  private _retainedSamples = 0 // Current samples held in active buffers
  private chunkIndex = 1
  private maxBufferedSamples: number

  // Pre-allocated typed accumulator for 1.0s STT chunks (eliminates number[] reallocations)
  private chunkBuffer: Int16Array = new Int16Array(CHUNK_SAMPLES)
  private chunkWritePos = 0

  // Chunk lifecycle tracking
  private activeChunks = new Map<string | number, AudioChunkLifecycleState>()
  private recordingCount = 0
  private queuedCount = 0
  private processingCount = 0
  private releasedCount = 0

  // Configurable dynamic VAD energy threshold (calibrated per device or baseline)
  private _vadEnergyThreshold: number = VAD_ENERGY_THRESHOLD

  constructor(maxBufferedDurationSec = DEFAULT_MAX_BUFFERED_SEC) {
    this.maxBufferedSamples = Math.max(
      CHUNK_SAMPLES * 2,
      Math.round(maxBufferedDurationSec * TARGET_SAMPLE_RATE)
    )
  }

  public get vadEnergyThreshold(): number {
    return this._vadEnergyThreshold
  }

  public setVadEnergyThreshold(threshold: number): void {
    if (typeof threshold === 'number' && !isNaN(threshold) && threshold > 0) {
      this._vadEnergyThreshold = threshold
    }
  }

  public getVadEnergyThreshold(): number {
    return this._vadEnergyThreshold
  }

  public get totalSamples(): number {
    return this._totalSamples
  }

  public get durationSec(): number {
    return Math.round((this._totalSamples / TARGET_SAMPLE_RATE) * 10) / 10
  }

  public get bufferedSeconds(): number {
    return Math.round((this._retainedSamples / TARGET_SAMPLE_RATE) * 10) / 10
  }

  public get sizeBytes(): number {
    return this._retainedSamples * 2
  }

  public get estimatedMemoryBytes(): number {
    return this._retainedSamples * 2
  }

  public get estimatedMemoryMb(): number {
    return Math.round(((this._retainedSamples * 2) / (1024 * 1024)) * 100) / 100
  }

  public get hasBuffer(): boolean {
    return this._retainedSamples > 0
  }

  /**
   * Appends newly sampled 16-bit PCM block.
   * Runs in O(samples) with bounded memory eviction.
   * Returns an AudioChunkMeta if a 1.0s window was completed, otherwise null.
   */
  public appendSamples(pcm16: Int16Array): AudioChunkMeta | null {
    if (pcm16.length === 0) return null

    // Clone to preserve the slice since underlying audio buffer might be reused
    const copy = new Int16Array(pcm16)
    this.buffers.push({
      startSample: this._totalSamples,
      data: copy,
    })
    this._totalSamples += copy.length
    this._retainedSamples += copy.length

    // Bounded window eviction: Discard oldest buffers when retaining more than maxBufferedSamples
    this.enforceBoundedCapacity()

    let readyChunk: AudioChunkMeta | null = null

    // Accumulate into chunkBuffer without boxing numbers into JS Array
    let inputOffset = 0
    while (inputOffset < copy.length) {
      const spaceLeft = CHUNK_SAMPLES - this.chunkWritePos
      const toCopy = Math.min(spaceLeft, copy.length - inputOffset)

      this.chunkBuffer.set(
        copy.subarray(inputOffset, inputOffset + toCopy),
        this.chunkWritePos
      )

      this.chunkWritePos += toCopy
      inputOffset += toCopy

      // Emitting 1.0-second chunk
      if (this.chunkWritePos >= CHUNK_SAMPLES) {
        readyChunk = this.createChunkMetadata(this.chunkBuffer)
        this.chunkWritePos = 0
      }
    }

    return readyChunk
  }

  /**
   * Enforces bounded memory capacity by pruning the oldest buffers.
   */
  private enforceBoundedCapacity(): void {
    while (this._retainedSamples > this.maxBufferedSamples && this.buffers.length > 1) {
      const evicted = this.buffers.shift()
      if (evicted) {
        this._retainedSamples -= evicted.data.length
        this._baseSampleIndex = this.buffers[0]?.startSample ?? this._totalSamples
        // Dereferenced typed array is now immediately reclaimable by V8 GC
      }
    }
  }

  /**
   * Prunes buffers containing samples older than sampleIndex.
   * Retains buffer continuity while freeing consumed audio memory.
   */
  public pruneBefore(sampleIndex: number): void {
    if (sampleIndex <= this._baseSampleIndex || this.buffers.length === 0) {
      return
    }

    let pruneCount = 0
    for (let i = 0; i < this.buffers.length; i++) {
      const bufEnd = this.buffers[i].startSample + this.buffers[i].data.length
      if (bufEnd <= sampleIndex) {
        this._retainedSamples -= this.buffers[i].data.length
        pruneCount++
      } else {
        break
      }
    }

    if (pruneCount > 0) {
      this.buffers.splice(0, pruneCount)
      this._baseSampleIndex = this.buffers[0]?.startSample ?? this._totalSamples
    }
  }

  /**
   * Computes RMS and constructs metadata for a ready chunk with lifecycle state.
   */
  private createChunkMetadata(samples: Int16Array): AudioChunkMeta {
    let sumSq = 0
    const len = samples.length
    for (let i = 0; i < len; i++) {
      const norm = samples[i] / 32768
      sumSq += norm * norm
    }
    const rms = Math.sqrt(sumSq / len)
    const rmsDb = rms > 0 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const ms = Math.floor(now.getMilliseconds() / 100)
    const timestamp = `${hh}:${mm}:${ss}.${ms}`

    const chunkId = `chunk_${this.chunkIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    this.activeChunks.set(chunkId, 'recording')
    this.recordingCount++

    // Enforce bounded capacity on activeChunks map to prevent linear memory growth in long sessions (60-120m)
    while (this.activeChunks.size > 50) {
      const oldestKey = this.activeChunks.keys().next().value
      if (oldestKey === undefined) break
      const prevState = this.activeChunks.get(oldestKey)
      this.activeChunks.delete(oldestKey)
      if (prevState === 'recording') this.recordingCount = Math.max(0, this.recordingCount - 1)
      else if (prevState === 'queued') this.queuedCount = Math.max(0, this.queuedCount - 1)
      else if (prevState === 'processing') this.processingCount = Math.max(0, this.processingCount - 1)
      this.releasedCount++
    }

    return {
      id: chunkId,
      index: this.chunkIndex++,
      timestamp,
      durationSec: 1.0,
      sizeBytes: CHUNK_SAMPLES * 2,
      sampleCount: CHUNK_SAMPLES,
      rmsDb,
      state: 'recording',
    }
  }

  // ── Chunk Lifecycle State Transitions ───────────────────────────────────────
  public markChunkQueued(chunkId: string | number): void {
    const prev = this.activeChunks.get(chunkId)
    if (prev === 'recording') this.recordingCount = Math.max(0, this.recordingCount - 1)
    this.activeChunks.set(chunkId, 'queued')
    this.queuedCount++
  }

  public markChunkProcessing(chunkId: string | number): void {
    const prev = this.activeChunks.get(chunkId)
    if (prev === 'queued') this.queuedCount = Math.max(0, this.queuedCount - 1)
    this.activeChunks.set(chunkId, 'processing')
    this.processingCount++
  }

  public markChunkReleased(chunkId: string | number): void {
    const prev = this.activeChunks.get(chunkId)
    if (prev === 'processing') this.processingCount = Math.max(0, this.processingCount - 1)
    else if (prev === 'queued') this.queuedCount = Math.max(0, this.queuedCount - 1)
    else if (prev === 'recording') this.recordingCount = Math.max(0, this.recordingCount - 1)

    // Remove from active map to bound metadata size
    this.activeChunks.delete(chunkId)
    this.releasedCount++
  }

  public getLifecycleStats(): AudioLifecycleStats {
    return {
      recordingChunks: this.recordingCount,
      queuedChunks: this.queuedCount,
      processingChunks: this.processingCount,
      releasedChunks: this.releasedCount,
      bufferedSeconds: this.bufferedSeconds,
      estimatedMemoryBytes: this.estimatedMemoryBytes,
      estimatedMemoryMb: this.estimatedMemoryMb,
    }
  }

  /**
   * Merges all currently retained buffers in the sliding window.
   */
  private mergeRetainedBuffers(): Int16Array {
    if (this._retainedSamples === 0) return new Int16Array(0)
    const merged = new Int16Array(this._retainedSamples)
    let offset = 0
    for (const b of this.buffers) {
      merged.set(b.data, offset)
      offset += b.data.length
    }
    return merged
  }

  /**
   * Retrieves currently buffered audio as WAV blob.
   */
  public getFullWavBlob(): Blob | null {
    if (this._retainedSamples === 0) return null
    return encodeWavBlob(this.mergeRetainedBuffers(), TARGET_SAMPLE_RATE)
  }

  /**
   * Extracts recent N seconds of audio from the bounded sliding window.
   */
  public getRecentAudioBlob(seconds = 4): Blob | null {
    if (this._retainedSamples === 0) return null

    const targetSamples = seconds * TARGET_SAMPLE_RATE
    let collectedSamples = 0
    const neededBuffers: Int16Array[] = []

    // Collect backwards O(buffers) without shifting array
    for (let i = this.buffers.length - 1; i >= 0; i--) {
      const buf = this.buffers[i].data
      neededBuffers.push(buf)
      collectedSamples += buf.length
      if (collectedSamples >= targetSamples) break
    }

    if (neededBuffers.length === 0) return null

    // Reverse to chronological order in O(neededBuffers)
    neededBuffers.reverse()

    const merged = new Int16Array(collectedSamples)
    let offset = 0
    for (const b of neededBuffers) {
      merged.set(b, offset)
      offset += b.length
    }

    return encodeWavBlob(merged, TARGET_SAMPLE_RATE)
  }

  /**
   * Extracts recent N seconds of raw PCM 16-bit samples from the sliding window.
   */
  public getRecentPcmSamples(seconds = 3): Int16Array {
    if (this._retainedSamples === 0) return new Int16Array(0)

    const targetSamples = Math.round(seconds * TARGET_SAMPLE_RATE)
    let collectedSamples = 0
    const neededBuffers: Int16Array[] = []

    for (let i = this.buffers.length - 1; i >= 0; i--) {
      const buf = this.buffers[i].data
      neededBuffers.push(buf)
      collectedSamples += buf.length
      if (collectedSamples >= targetSamples) break
    }

    if (neededBuffers.length === 0) return new Int16Array(0)

    neededBuffers.reverse()

    const merged = new Int16Array(collectedSamples)
    let offset = 0
    for (const b of neededBuffers) {
      merged.set(b, offset)
      offset += b.length
    }

    if (merged.length > targetSamples) {
      return merged.subarray(merged.length - targetSamples)
    }

    return merged
  }

  /**
   * Slices segment of audio since given sample offset.
   * Performs VAD and RMS checks in a single linear pass.
   * Auto-prunes older consumed audio prior to (effectiveFromSample - preRoll) to free memory.
   */
  public getAudioSegmentSince(
    fromSample = 0,
    minDurationSec = 1.8
  ): AudioSegment | null {
    if (this._totalSamples === 0 || this._totalSamples <= fromSample) {
      return null
    }

    // Handle case where requested fromSample is older than sliding window base
    const effectiveFromSample = Math.max(fromSample, this._baseSampleIndex)
    const sampleCount = this._totalSamples - effectiveFromSample
    const minSamples = Math.floor(minDurationSec * TARGET_SAMPLE_RATE)
    if (sampleCount < minSamples) {
      return null
    }

    const merged = new Int16Array(sampleCount)
    let writeOffset = 0
    let sumSq = 0

    for (const item of this.buffers) {
      const bufStart = item.startSample
      const bufEnd = item.startSample + item.data.length

      if (bufEnd <= effectiveFromSample) continue

      const sliceStart = Math.max(0, effectiveFromSample - bufStart)
      const sliceEnd = item.data.length

      for (let i = sliceStart; i < sliceEnd && writeOffset < sampleCount; i++) {
        const val = item.data[i]
        merged[writeOffset++] = val
        const norm = val / 32768
        sumSq += norm * norm
      }
    }

    // Auto-prune consumed buffers older than (effectiveFromSample - preRoll)
    const preRollSamples = Math.round(PRE_ROLL_SEC * TARGET_SAMPLE_RATE)
    const pruneThreshold = Math.max(0, effectiveFromSample - preRollSamples)
    this.pruneBefore(pruneThreshold)

    const rms = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0
    const hasAudio = rms > this._vadEnergyThreshold

    return {
      blob: encodeWavBlob(merged.subarray(0, writeOffset), TARGET_SAMPLE_RATE),
      endSample: this._totalSamples,
      sampleCount: writeOffset,
      hasAudio,
    }
  }

  /**
   * Resets all buffers, indices, and lifecycle tracking.
   */
  public clear(): void {
    // Explicitly unreference all buffer items for V8 GC
    this.buffers.length = 0
    this._baseSampleIndex = 0
    this._totalSamples = 0
    this._retainedSamples = 0
    this.chunkIndex = 1
    this.chunkWritePos = 0
    this.activeChunks.clear()
    this.recordingCount = 0
    this.queuedCount = 0
    this.processingCount = 0
    this.releasedCount = 0
  }
}
