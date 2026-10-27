import { encodeWavBlob } from '../../lib/audioPipeline'
import type {
  SpeechSegment,
  SpeechSegmentCloseReason,
  SpeechSegmenterConfig,
} from './types'

export const DEFAULT_SEGMENTER_CONFIG: SpeechSegmenterConfig = {
  sampleRate: 16000,
  frameSizeSamples: 320, // 20ms at 16kHz
  vadThresholdRms: 0.008, // Approx -42 dBFS baseline noise floor
  hysteresisFactor: 0.65, // Exit speech threshold = 0.65 * enter threshold (~ -3.7 dB)
  silenceEndMs: 400, // Continuous silence to seal sentence
  maxSegmentMs: 4500, // Hard ceiling before valley split
  minSpeechMs: 250, // Minimum active speech to reject transients/coughs
  preRollMs: 200, // Pre-roll to protect initial consonants
  postRollMs: 150, // Post-roll to preserve trailing fricatives
  valleyWindowMs: 1000, // Lookback window for energy dip when hitting maxSegmentMs
}

export type SegmenterState = 'IDLE' | 'SPEAKING' | 'TRAILING'

interface FrameMeta {
  data: Int16Array
  rms: number
}

/**
 * SpeechSegmenter
 *
 * Pure, deterministic, frame-by-frame audio sentence boundary segmenter.
 * Replaces hard fixed-interval chunking with dynamic sentence segmentation:
 *
 * 1. State Machine: IDLE → SPEAKING → TRAILING.
 * 2. Hysteresis VAD: Higher threshold to enter speech, lower threshold to exit,
 *    eliminating chattering around voice/noise boundaries.
 * 3. Pre-roll & Post-roll: Guarantees initial plosives and trailing fricatives are kept.
 * 4. Valley Splitting: When speaking continuously past maxSegmentMs (4.5s), splits
 *    at the lowest-energy frame in the trailing 1.0s window, carries over the remainder,
 *    and tags the next segment with continuation = true.
 * 5. Transient Rejection: Discards non-continuous speech < minSpeechMs (clicks, coughs).
 * 6. Flush support: Immediately commits in-progress utterance on stop/switch/unmount.
 */
export class SpeechSegmenter {
  private config: SpeechSegmenterConfig
  private state: SegmenterState = 'IDLE'

  // Rolling circular pre-roll buffer in IDLE state
  private preRollQueue: FrameMeta[] = []
  private maxPreRollFrames: number

  // In-progress segment state
  private activeFrames: FrameMeta[] = []
  private speechFramesCount = 0
  private silenceFramesCount = 0
  private segmentStartSample = 0
  private currentIsContinuation = false
  private lastSpokenTimestampMs = 0

  // Frame assembly accumulator for arbitrary input chunk sizes
  private pendingPcm: Int16Array = new Int16Array(0)
  private totalSamplesProcessed = 0

  constructor(userConfig?: Partial<SpeechSegmenterConfig>) {
    this.config = { ...DEFAULT_SEGMENTER_CONFIG, ...userConfig }
    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    this.maxPreRollFrames = Math.max(1, Math.round(this.config.preRollMs / frameMs))
  }

  public getConfig(): SpeechSegmenterConfig {
    return { ...this.config }
  }

  public updateConfig(patch: Partial<SpeechSegmenterConfig>): void {
    this.config = { ...this.config, ...patch }
    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    this.maxPreRollFrames = Math.max(1, Math.round(this.config.preRollMs / frameMs))
  }

  public updateVadThreshold(thresholdRms: number): void {
    if (typeof thresholdRms === 'number' && Number.isFinite(thresholdRms) && thresholdRms > 0) {
      this.config.vadThresholdRms = thresholdRms
    }
  }

  public getState(): SegmenterState {
    return this.state
  }

  public isContinuationActive(): boolean {
    return this.currentIsContinuation
  }

  public getBufferedSegmentDurationMs(): number {
    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    return this.activeFrames.length * frameMs
  }

  /**
   * Primary entry point: feeds raw 16-bit PCM samples into the segmenter.
   * Input chunk size can be arbitrary (e.g. 128, 2048, or larger).
   * Returns any completed speech segments produced during this feed.
   */
  public feed(pcm16: Int16Array, globalSampleOffset?: number): SpeechSegment[] {
    if (!pcm16 || pcm16.length === 0) return []

    // Sync global sample counter if provided
    if (typeof globalSampleOffset === 'number' && Number.isFinite(globalSampleOffset)) {
      this.totalSamplesProcessed = globalSampleOffset
    }

    // Merge with any leftover partial frame
    let combined: Int16Array
    if (this.pendingPcm.length > 0) {
      combined = new Int16Array(this.pendingPcm.length + pcm16.length)
      combined.set(this.pendingPcm, 0)
      combined.set(pcm16, this.pendingPcm.length)
    } else {
      combined = pcm16
    }

    const frameSize = this.config.frameSizeSamples
    const completedSegments: SpeechSegment[] = []
    let offset = 0

    while (offset + frameSize <= combined.length) {
      const frameData = combined.slice(offset, offset + frameSize)
      const frameMeta: FrameMeta = {
        data: frameData,
        rms: this.calculateRms(frameData),
      }

      const segment = this.processFrame(frameMeta)
      if (segment) {
        completedSegments.push(segment)
      }

      offset += frameSize
      this.totalSamplesProcessed += frameSize
    }

    // Retain any remaining partial frame
    if (offset < combined.length) {
      this.pendingPcm = combined.slice(offset)
    } else {
      this.pendingPcm = new Int16Array(0)
    }

    return completedSegments
  }

  /**
   * Processes a single standardized frame through the VAD state machine.
   */
  private processFrame(frame: FrameMeta): SpeechSegment | null {
    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    const enterThreshold = this.config.vadThresholdRms
    const exitThreshold = this.config.vadThresholdRms * this.config.hysteresisFactor

    const isSpeechFrame = frame.rms >= (this.state === 'IDLE' ? enterThreshold : exitThreshold)

    switch (this.state) {
      case 'IDLE': {
        if (!isSpeechFrame) {
          // Accumulate rolling pre-roll
          this.preRollQueue.push(frame)
          if (this.preRollQueue.length > this.maxPreRollFrames) {
            this.preRollQueue.shift()
          }
          return null
        }

        // Voice started! Transition to SPEAKING
        this.state = 'SPEAKING'
        this.lastSpokenTimestampMs = Date.now()
        this.segmentStartSample = Math.max(
          0,
          this.totalSamplesProcessed - this.preRollQueue.length * this.config.frameSizeSamples
        )

        // Include pre-roll frames in active segment
        this.activeFrames = [...this.preRollQueue, frame]
        this.preRollQueue = []
        this.speechFramesCount = 1
        this.silenceFramesCount = 0
        return null
      }

      case 'SPEAKING': {
        this.activeFrames.push(frame)

        if (isSpeechFrame) {
          this.speechFramesCount++
          this.silenceFramesCount = 0
          this.lastSpokenTimestampMs = Date.now()
        } else {
          // Energy dropped below exit threshold -> Enter TRAILING silence
          this.state = 'TRAILING'
          this.silenceFramesCount = 1
        }

        // Check if segment reached hard maximum duration
        const durationMs = this.activeFrames.length * frameMs
        if (durationMs >= this.config.maxSegmentMs) {
          return this.splitAtEnergyValley()
        }
        return null
      }

      case 'TRAILING': {
        this.activeFrames.push(frame)

        if (frame.rms >= enterThreshold) {
          // Voice resumed before silence timeout! Transition back to SPEAKING
          this.state = 'SPEAKING'
          this.speechFramesCount += this.silenceFramesCount + 1
          this.silenceFramesCount = 0
          this.lastSpokenTimestampMs = Date.now()
        } else {
          // Continuous silence continues
          this.silenceFramesCount++
          const silenceDurationMs = this.silenceFramesCount * frameMs

          if (silenceDurationMs >= this.config.silenceEndMs) {
            // Sentence boundary sealed by natural silence!
            return this.closeSentenceSegment('silence')
          }
        }

        // Check if segment reached hard maximum duration even while trailing
        const durationMs = this.activeFrames.length * frameMs
        if (durationMs >= this.config.maxSegmentMs) {
          return this.splitAtEnergyValley()
        }
        return null
      }
    }
  }

  /**
   * Seals sentence segment when silence duration reaches silenceEndMs.
   */
  private closeSentenceSegment(reason: SpeechSegmentCloseReason): SpeechSegment | null {
    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    const speechDurationMs = this.speechFramesCount * frameMs

    // Transient rejection: Discard clicks/coughs unless this is a continuation segment
    if (speechDurationMs < this.config.minSpeechMs && !this.currentIsContinuation && reason !== 'flush') {
      this.resetActiveState()
      return null
    }

    // Trim trailing silence beyond postRollMs to avoid feeding empty room noise to Whisper
    let framesToEmit = this.activeFrames
    if (reason === 'silence') {
      const postRollFrames = Math.max(1, Math.round(this.config.postRollMs / frameMs))
      const excessSilenceFrames = Math.max(0, this.silenceFramesCount - postRollFrames)
      if (excessSilenceFrames > 0 && excessSilenceFrames < framesToEmit.length) {
        framesToEmit = framesToEmit.slice(0, framesToEmit.length - excessSilenceFrames)
      }
    }

    const mergedPcm = this.mergeFrames(framesToEmit)
    const endSample = this.segmentStartSample + mergedPcm.length
    const finalDurationMs = Math.round((mergedPcm.length / this.config.sampleRate) * 1000)
    const wasContinuation = this.currentIsContinuation

    const segment: SpeechSegment = {
      samples: mergedPcm,
      blob: encodeWavBlob(mergedPcm, this.config.sampleRate),
      startSample: this.segmentStartSample,
      endSample,
      durationMs: finalDurationMs,
      speechDurationMs: Math.round(speechDurationMs),
      closeReason: reason,
      continuation: wasContinuation,
      hasSpeech: speechDurationMs >= 100 || wasContinuation,
      endOfSpeechTimestampMs: this.lastSpokenTimestampMs || Date.now(),
    }

    this.resetActiveState()
    this.currentIsContinuation = false
    return segment
  }

  /**
   * Valley Splitting: When active speech exceeds maxSegmentMs (4.5s),
   * finds the minimum energy point in the trailing window, splits smoothly,
   * emits the first part, and carries over the remainder with continuation = true.
   */
  private splitAtEnergyValley(): SpeechSegment | null {
    if (this.activeFrames.length === 0) return null

    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    const windowFrames = Math.min(
      Math.max(5, Math.round(this.config.valleyWindowMs / frameMs)),
      Math.floor(this.activeFrames.length * 0.4) // Look within trailing 40% of segment
    )

    const searchStartIndex = Math.max(0, this.activeFrames.length - windowFrames)
    // Avoid splitting in the very last 4 frames (80ms)
    const searchEndIndex = Math.max(searchStartIndex + 1, this.activeFrames.length - 4)

    let minRms = Infinity
    let splitIndex = searchEndIndex

    for (let i = searchStartIndex; i < searchEndIndex; i++) {
      const frameRms = this.activeFrames[i].rms
      if (frameRms < minRms) {
        minRms = frameRms
        splitIndex = i
      }
    }

    // Split point chosen: splitIndex + 1 is the first carry-over frame
    const framesToEmit = this.activeFrames.slice(0, splitIndex + 1)
    const carryOverFrames = this.activeFrames.slice(splitIndex + 1)

    const mergedPcm = this.mergeFrames(framesToEmit)
    const endSample = this.segmentStartSample + mergedPcm.length
    const durationMs = Math.round((mergedPcm.length / this.config.sampleRate) * 1000)
    const wasContinuation = this.currentIsContinuation

    const segment: SpeechSegment = {
      samples: mergedPcm,
      blob: encodeWavBlob(mergedPcm, this.config.sampleRate),
      startSample: this.segmentStartSample,
      endSample,
      durationMs,
      speechDurationMs: durationMs,
      closeReason: 'max-length',
      continuation: wasContinuation,
      hasSpeech: true,
      endOfSpeechTimestampMs: Date.now(),
    }

    // Setup next segment state with carry-over frames
    this.currentIsContinuation = true
    this.activeFrames = carryOverFrames
    this.segmentStartSample = endSample
    this.speechFramesCount = carryOverFrames.length
    this.silenceFramesCount = 0
    this.state = 'SPEAKING'
    this.lastSpokenTimestampMs = Date.now()

    return segment
  }

  /**
   * Flushes in-progress segment immediately (on stop capture, device switch, unmount).
   * Ensures the user's trailing words are never dropped.
   */
  public flush(): SpeechSegment | null {
    if (this.activeFrames.length === 0) {
      this.resetActiveState()
      return null
    }

    const frameMs = (this.config.frameSizeSamples / this.config.sampleRate) * 1000
    const speechDurationMs = this.speechFramesCount * frameMs

    // Only emit if there was meaningful speech or it continues a prior segment
    if (speechDurationMs < 100 && !this.currentIsContinuation) {
      this.resetActiveState()
      return null
    }

    const mergedPcm = this.mergeFrames(this.activeFrames)
    const endSample = this.segmentStartSample + mergedPcm.length
    const durationMs = Math.round((mergedPcm.length / this.config.sampleRate) * 1000)
    const wasContinuation = this.currentIsContinuation

    const segment: SpeechSegment = {
      samples: mergedPcm,
      blob: encodeWavBlob(mergedPcm, this.config.sampleRate),
      startSample: this.segmentStartSample,
      endSample,
      durationMs,
      speechDurationMs: Math.round(speechDurationMs),
      closeReason: 'flush',
      continuation: wasContinuation,
      hasSpeech: true,
      endOfSpeechTimestampMs: this.lastSpokenTimestampMs || Date.now(),
    }

    this.resetActiveState()
    this.currentIsContinuation = false
    return segment
  }

  /**
   * Full reset of all internal state.
   */
  public reset(): void {
    this.resetActiveState()
    this.pendingPcm = new Int16Array(0)
    this.preRollQueue = []
    this.currentIsContinuation = false
    this.totalSamplesProcessed = 0
  }

  private resetActiveState(): void {
    this.state = 'IDLE'
    this.activeFrames = []
    this.speechFramesCount = 0
    this.silenceFramesCount = 0
    this.preRollQueue = []
  }

  private mergeFrames(frames: FrameMeta[]): Int16Array {
    if (frames.length === 0) return new Int16Array(0)
    const frameSize = this.config.frameSizeSamples
    const result = new Int16Array(frames.length * frameSize)
    let offset = 0
    for (let i = 0; i < frames.length; i++) {
      result.set(frames[i].data, offset)
      offset += frameSize
    }
    return result
  }

  private calculateRms(samples: Int16Array): number {
    const len = samples.length
    if (len === 0) return 0
    let sumSq = 0
    for (let i = 0; i < len; i++) {
      const norm = samples[i] / 32768
      sumSq += norm * norm
    }
    return Math.sqrt(sumSq / len)
  }
}
