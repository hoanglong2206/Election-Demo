import { describe, expect, it } from 'bun:test'
import { SpeechSegmenter } from '../SpeechSegmenter'
import { SpeechSegmentationTelemetry } from '../SpeechSegmentationTelemetry'

function generateSilence(durationSec: number, noiseRms = 0.0005): Int16Array {
  const numSamples = Math.round(durationSec * 16000)
  const arr = new Int16Array(numSamples)
  const maxNoise = Math.round(noiseRms * 32768)
  for (let i = 0; i < numSamples; i++) {
    arr[i] = Math.round((Math.random() * 2 - 1) * maxNoise)
  }
  return arr
}

function generateSpeech(durationSec: number, amplitude = 0.25): Int16Array {
  const numSamples = Math.round(durationSec * 16000)
  const arr = new Int16Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const sample =
      Math.sin((2 * Math.PI * 300 * i) / 16000) * 0.5 +
      Math.sin((2 * Math.PI * 700 * i) / 16000) * 0.3 +
      Math.sin((2 * Math.PI * 1200 * i) / 16000) * 0.2
    arr[i] = Math.round(sample * amplitude * 32767)
  }
  return arr
}


describe('SpeechSegmenter Full Functional & Acoustic Suite', () => {
  // ── TEST 1: Pure Silence ──────────────────────────────────────────────────
  it('keeps IDLE state and emits 0 segments during continuous silence', () => {
    const segmenter = new SpeechSegmenter({
      vadThresholdRms: 0.008,
      silenceEndMs: 400,
    })

    const silence = generateSilence(5.0) // 5 seconds of silence
    const segments = segmenter.feed(silence)

    expect(segments.length).toBe(0)
    expect(segmenter.getState()).toBe('IDLE')
  })

  // ── TEST 2: Short Transient Noise Filter (< 250ms) ────────────────────────
  it('discards short transients (cough / click < 250ms) and avoids spurious STT calls', () => {
    const segmenter = new SpeechSegmenter({
      minSpeechMs: 250,
      silenceEndMs: 400,
      vadThresholdRms: 0.008,
    })

    // 100ms loud noise + 600ms silence
    const transient = generateSpeech(0.1, 0.4)
    const trailingSilence = generateSilence(0.6)

    const seg1 = segmenter.feed(transient)
    expect(seg1.length).toBe(0) // Still buffering

    const seg2 = segmenter.feed(trailingSilence)
    // Should be discarded because speech duration (100ms) < minSpeechMs (250ms)
    expect(seg2.length).toBe(0)
    expect(segmenter.getState()).toBe('IDLE')
  })

  // ── TEST 3: Speech - Pause - Speech (Natural Sentence Boundaries) ─────────
  it('segments natural sentences cleanly at silence boundaries with pre-roll and post-roll', () => {
    const segmenter = new SpeechSegmenter({
      silenceEndMs: 400,
      vadThresholdRms: 0.008,
      preRollMs: 200,
      postRollMs: 150,
    })

    // Sentence 1: 1.5s speech + 0.5s pause (>= 400ms silenceEndMs)
    // Sentence 2: 2.0s speech + 0.5s pause
    const sentence1 = generateSpeech(1.5)
    const pause1 = generateSilence(0.5)
    const sentence2 = generateSpeech(2.0)
    const pause2 = generateSilence(0.5)

    const allPcm = new Int16Array(sentence1.length + pause1.length + sentence2.length + pause2.length)
    let offset = 0
    allPcm.set(sentence1, offset); offset += sentence1.length
    allPcm.set(pause1, offset); offset += pause1.length
    allPcm.set(sentence2, offset); offset += sentence2.length
    allPcm.set(pause2, offset)

    // Feed in standard AudioWorklet chunk batches of 2048 samples (~128ms)
    const emittedSegments: any[] = []
    const chunkSize = 2048
    for (let i = 0; i < allPcm.length; i += chunkSize) {
      const chunk = allPcm.subarray(i, Math.min(i + chunkSize, allPcm.length))
      const segs = segmenter.feed(chunk, i)
      emittedSegments.push(...segs)
    }

    expect(emittedSegments.length).toBe(2)

    // Segment 1 verification
    const first = emittedSegments[0]
    expect(first.closeReason).toBe('silence')
    expect(first.continuation).toBe(false)
    expect(first.hasSpeech).toBe(true)
    // Duration: 1500ms speech + pre-roll (~200ms) + post-roll (~150ms) ≈ 1700-1900ms
    expect(first.durationMs).toBeGreaterThanOrEqual(1600)
    expect(first.durationMs).toBeLessThanOrEqual(2000)

    // Segment 2 verification
    const second = emittedSegments[1]
    expect(second.closeReason).toBe('silence')
    expect(second.continuation).toBe(false)
    expect(second.hasSpeech).toBe(true)
    // Duration: 2000ms speech + pre-roll + post-roll ≈ 2200-2400ms
    expect(second.durationMs).toBeGreaterThanOrEqual(2100)
    expect(second.durationMs).toBeLessThanOrEqual(2500)
  })

  // ── TEST 4: Continuous Speech for 12s with Valley Splitting ─────────────────
  it('smoothly splits continuous speech at energy valleys near maxSegmentMs with carry-over continuation', () => {
    const segmenter = new SpeechSegmenter({
      maxSegmentMs: 4500,
      silenceEndMs: 400,
      valleyWindowMs: 1000,
      vadThresholdRms: 0.008,
    })

    // Generate 12 seconds of continuous speech with natural acoustic valleys (dips) at 4.0s and 8.3s
    const speech12s = new Int16Array(16000 * 12)
    // Fill with active speech
    speech12s.set(generateSpeech(12.0))

    // Insert acoustic valleys (energy dips) where speaker inhales or pauses between syllables
    const valley1Start = 16000 * 4.0 // at 4.0s (within 1.0s window before 4.5s ceiling)
    const valley1End = valley1Start + 16000 * 0.1 // 100ms dip
    for (let i = valley1Start; i < valley1End; i++) {
      speech12s[i] = Math.round(speech12s[i] * 0.01) // Near silence dip
    }

    const valley2Start = 16000 * 8.3 // at 8.3s (within 1.0s window before second 4.5s ceiling)
    const valley2End = valley2Start + 16000 * 0.1
    for (let i = valley2Start; i < valley2End; i++) {
      speech12s[i] = Math.round(speech12s[i] * 0.01)
    }

    // Feed in 2048-sample blocks
    const emittedSegments: any[] = []
    for (let i = 0; i < speech12s.length; i += 2048) {
      const chunk = speech12s.subarray(i, Math.min(i + 2048, speech12s.length))
      const segs = segmenter.feed(chunk, i)
      emittedSegments.push(...segs)
    }

    // Must have triggered valley splitting around 4.5s ceiling
    expect(emittedSegments.length).toBeGreaterThanOrEqual(2)

    // Segment 1 was split on max-length at the energy dip
    const seg1 = emittedSegments[0]
    expect(seg1.closeReason).toBe('max-length')
    expect(seg1.continuation).toBe(false)
    // Cut should be close to valley1 (around 4000ms - 4300ms)
    expect(seg1.durationMs).toBeGreaterThanOrEqual(3800)
    expect(seg1.durationMs).toBeLessThanOrEqual(4500)

    // Segment 2 MUST be marked continuation = true!
    const seg2 = emittedSegments[1]
    expect(seg2.continuation).toBe(true)

    // Calling flush to seal the remaining speech
    const flushed = segmenter.flush()
    expect(flushed).not.toBeNull()
    if (flushed) {
      expect(flushed.continuation).toBe(true)
      expect(flushed.closeReason).toBe('flush')
    }
  })

  // ── TEST 5: Flush on Stop / Switch / Unmount ────────────────────────────────
  it('immediately flushes in-progress segment on stop/unmount without losing final words', () => {
    const segmenter = new SpeechSegmenter({
      silenceEndMs: 400,
      vadThresholdRms: 0.008,
    })

    // 1.2s of speech, no trailing silence yet
    const speech = generateSpeech(1.2)
    const segs = segmenter.feed(speech)
    expect(segs.length).toBe(0) // Still in SPEAKING state
    expect(segmenter.getState()).toBe('SPEAKING')

    // User clicks Stop / unmounts MeetingMode
    const flushed = segmenter.flush()
    expect(flushed).not.toBeNull()
    expect(flushed?.closeReason).toBe('flush')
    expect(flushed?.hasSpeech).toBe(true)
    expect(flushed?.durationMs).toBeGreaterThanOrEqual(1200)
    expect(segmenter.getState()).toBe('IDLE')
  })

  // ── TEST 6: Hysteresis Threshold Anti-Chattering ───────────────────────────
  it('employs hysteresis to avoid rapid chattering around the voice boundary', () => {
    const segmenter = new SpeechSegmenter({
      vadThresholdRms: 0.01, // enter threshold: 0.01
      hysteresisFactor: 0.65, // exit threshold: 0.0065
    })

    // 1. Start with silence
    segmenter.feed(generateSilence(0.2))
    expect(segmenter.getState()).toBe('IDLE')

    // 2. Cross enter threshold (RMS 0.015) -> Enter SPEAKING
    segmenter.feed(generateSpeech(0.2, 0.05)) // RMS ~0.03
    expect(segmenter.getState()).toBe('SPEAKING')

    // 3. Drop slightly below enter threshold (RMS 0.008), which is still above exit threshold (0.0065)
    // In a non-hysteresis system, this would chatter back to silence immediately.
    // In our hysteresis system, state remains SPEAKING!
    const marginalSpeech = generateSpeech(0.1, 0.015) // RMS ~0.009
    segmenter.feed(marginalSpeech)
    expect(segmenter.getState()).toBe('SPEAKING')

    // 4. Drop fully below exit threshold (< 0.0065) -> Enter TRAILING
    segmenter.feed(generateSilence(0.1))
    expect(segmenter.getState()).toBe('TRAILING')
  })

  // ── TEST 7: Before vs After Comparative Benchmark ──────────────────────────
  it('demonstrates significant STT request reduction vs fixed 1000ms slicing on sample audio', () => {
    const telemetry = new SpeechSegmentationTelemetry()
    const segmenter = new SpeechSegmenter({
      silenceEndMs: 400,
      maxSegmentMs: 4500,
      vadThresholdRms: 0.008,
    })

    // Simulating a 12-second interview exchange:
    // Sentence 1: "Could you describe your experience with microservices?" (2.5s) + pause (0.5s)
    // Sentence 2: "Specifically how you managed database transactions across services." (3.0s) + pause (0.6s)
    // Sentence 3: "Did you use the Saga pattern or two-phase commit?" (2.5s) + pause (0.8s)
    // Remainder: silence (2.1s)
    const part1 = generateSpeech(2.5)
    const pause1 = generateSilence(0.5)
    const part2 = generateSpeech(3.0)
    const pause2 = generateSilence(0.6)
    const part3 = generateSpeech(2.5)
    const pause3 = generateSilence(0.8)
    const part4 = generateSilence(2.1)

    const conversationPcm = new Int16Array(
      part1.length + pause1.length + part2.length + pause2.length + part3.length + pause3.length + part4.length
    )
    let off = 0
    conversationPcm.set(part1, off); off += part1.length
    conversationPcm.set(pause1, off); off += pause1.length
    conversationPcm.set(part2, off); off += part2.length
    conversationPcm.set(pause2, off); off += pause2.length
    conversationPcm.set(part3, off); off += part3.length
    conversationPcm.set(pause3, off); off += pause3.length
    conversationPcm.set(part4, off)

    // 1. Benchmark Old Fixed Slicing (every 1000ms):
    // 12 seconds with fixed 1s slices produces 12 slices
    const legacySliceCount = Math.floor(conversationPcm.length / 16000)
    expect(legacySliceCount).toBe(12)

    // 2. Benchmark SpeechSegmenter:
    const newSegments: any[] = []
    for (let i = 0; i < conversationPcm.length; i += 2048) {
      const chunk = conversationPcm.subarray(i, Math.min(i + 2048, conversationPcm.length))
      const segs = segmenter.feed(chunk, i)
      for (const s of segs) {
        newSegments.push(s)
        telemetry.recordSegmentClosed(s)
      }
    }

    // Exactly 3 whole-sentence segments emitted!
    expect(newSegments.length).toBe(3)
    // All 3 sentences were sealed naturally by silence
    expect(newSegments.every((s) => s.closeReason === 'silence')).toBe(true)

    // Comparison Metrics:
    // Request count dropped from 12 down to 3 (a 75% reduction in STT invocations!)
    const reductionPercent = Math.round(((legacySliceCount - newSegments.length) / legacySliceCount) * 100)
    expect(reductionPercent).toBeGreaterThanOrEqual(70)

    const metrics = telemetry.getMetrics()
    expect(metrics.totalSegments).toBe(3)
    expect(metrics.closeReasons.silence).toBe(3)
    expect(metrics.closeReasons.silencePercent).toBe(100)
    expect(metrics.averageDurationMs).toBeGreaterThanOrEqual(2500)
  })
})
