import type { SpeechSegment } from './types'

export interface SpeechSegmentationMetrics {
  totalSegments: number
  segmentsPerMinute: number
  averageDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  closeReasons: {
    silence: number
    maxLength: number
    flush: number
    silencePercent: number
    maxLengthPercent: number
    flushPercent: number
  }
  averageEndOfSpeechToCommitMs: number
  lastCommitLatencyMs: number
}

/**
 * SpeechSegmentationTelemetry
 *
 * Real-time operational metric tracker for sentence boundary speech segmentation.
 * Tracks throughput, average duration, reason distribution (silence vs max-length vs flush),
 * and end-to-end utterance-to-commit latency.
 */
export class SpeechSegmentationTelemetry {
  private totalSegments = 0
  private totalDurationMs = 0
  private minDurationMs = Infinity
  private maxDurationMs = 0

  private silenceCount = 0
  private maxLengthCount = 0
  private flushCount = 0

  // Rolling timestamp window for segments/minute calculation
  private recentSegmentTimestamps: number[] = []

  // Latency metrics: from user stopping speech to transcript committed on UI
  private totalLatencyMs = 0
  private latencyRecordCount = 0
  private lastLatencyMs = 0

  public recordSegmentClosed(segment: Pick<SpeechSegment, 'durationMs' | 'closeReason'>): void {
    const now = Date.now()
    this.totalSegments++
    this.totalDurationMs += segment.durationMs

    if (segment.durationMs < this.minDurationMs) this.minDurationMs = segment.durationMs
    if (segment.durationMs > this.maxDurationMs) this.maxDurationMs = segment.durationMs

    switch (segment.closeReason) {
      case 'silence':
        this.silenceCount++
        break
      case 'max-length':
        this.maxLengthCount++
        break
      case 'flush':
        this.flushCount++
        break
    }

    // Window sliding: purge timestamps older than 60s
    this.recentSegmentTimestamps.push(now)
    const cutoff = now - 60000
    while (this.recentSegmentTimestamps.length > 0 && this.recentSegmentTimestamps[0] < cutoff) {
      this.recentSegmentTimestamps.shift()
    }
  }

  public recordCommitLatency(endOfSpeechTimestampMs?: number): number {
    if (!endOfSpeechTimestampMs || endOfSpeechTimestampMs <= 0) return 0
    const now = Date.now()
    const latency = Math.max(0, now - endOfSpeechTimestampMs)
    this.lastLatencyMs = latency
    this.totalLatencyMs += latency
    this.latencyRecordCount++
    return latency
  }

  public getMetrics(): SpeechSegmentationMetrics {
    const now = Date.now()
    const cutoff = now - 60000
    while (this.recentSegmentTimestamps.length > 0 && this.recentSegmentTimestamps[0] < cutoff) {
      this.recentSegmentTimestamps.shift()
    }

    const total = this.totalSegments
    const avgDuration = total > 0 ? Math.round(this.totalDurationMs / total) : 0
    const avgLatency =
      this.latencyRecordCount > 0 ? Math.round(this.totalLatencyMs / this.latencyRecordCount) : 0

    return {
      totalSegments: total,
      segmentsPerMinute: this.recentSegmentTimestamps.length,
      averageDurationMs: avgDuration,
      minDurationMs: this.minDurationMs === Infinity ? 0 : this.minDurationMs,
      maxDurationMs: this.maxDurationMs,
      closeReasons: {
        silence: this.silenceCount,
        maxLength: this.maxLengthCount,
        flush: this.flushCount,
        silencePercent: total > 0 ? Math.round((this.silenceCount / total) * 100) : 0,
        maxLengthPercent: total > 0 ? Math.round((this.maxLengthCount / total) * 100) : 0,
        flushPercent: total > 0 ? Math.round((this.flushCount / total) * 100) : 0,
      },
      averageEndOfSpeechToCommitMs: avgLatency,
      lastCommitLatencyMs: this.lastLatencyMs,
    }
  }

  public reset(): void {
    this.totalSegments = 0
    this.totalDurationMs = 0
    this.minDurationMs = Infinity
    this.maxDurationMs = 0
    this.silenceCount = 0
    this.maxLengthCount = 0
    this.flushCount = 0
    this.recentSegmentTimestamps = []
    this.totalLatencyMs = 0
    this.latencyRecordCount = 0
    this.lastLatencyMs = 0
  }
}

export const speechSegmentationTelemetry = new SpeechSegmentationTelemetry()
