import type { AssemblerCommit, STTJob, TranscribeResult } from './types'

interface AssemblerItem {
  sequenceId: number
  jobId: string
  sessionId: string
  result?: TranscribeResult
  isSkipped?: boolean
  speakerLabel?: string
  timestampStr?: string
  sourceType?: 'system' | 'mic'
  arrivedAt: number
}

/**
 * TranscriptAssembler
 *
 * Ensures transcripts are committed strictly in sequential order (sequenceId 1, 2, 3...)
 * even if worker threads complete out of order due to network jitter or variable audio length.
 *
 * Flow:
 * - Workers submit completed results via `receiveResult(seqId, result, meta)`
 * - Dropped or silence chunks submit `skipSequence(seqId)` to advance without waiting
 * - `tryCommit()` commits monotonically in sequenceId order
 * - Watchdog timer skips stalled sequences after 8 seconds of backlog to prevent pipeline deadlocks
 */
export class TranscriptAssembler {
  private expectedSequenceId = 1
  private buffer = new Map<number, AssemblerItem>()
  private listeners: ((commit: AssemblerCommit) => void)[] = []
  private sessionId = 'default'
  private committedCount = 0
  private gapWatchdogTimer: ReturnType<typeof setInterval> | null = null

  constructor(initialSessionId = 'default') {
    this.sessionId = initialSessionId
    this.startWatchdog()
  }

  public setSessionId(sessionId: string, initialSeq = 1): void {
    this.sessionId = sessionId
    this.expectedSequenceId = initialSeq
    this.buffer.clear()
    this.committedCount = 0
  }

  /**
   * Register a listener for monotonically committed transcript lines.
   */
  public onCommit(listener: (commit: AssemblerCommit) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Receive a completed transcription result from an STT worker.
   */
  public receiveResult(
    sequenceId: number,
    result: TranscribeResult,
    jobMeta: Pick<STTJob, 'jobId' | 'sessionId' | 'speakerLabel' | 'timestampStr' | 'sourceType'>
  ): void {
    // Drop results from past or mismatched sessions to prevent cross-session transcript pollution
    if (jobMeta.sessionId && this.sessionId !== 'default' && jobMeta.sessionId !== this.sessionId) {
      return
    }

    // Obsolete or already committed sequence
    if (sequenceId < this.expectedSequenceId) {
      return
    }

    this.buffer.set(sequenceId, {
      sequenceId,
      jobId: jobMeta.jobId,
      sessionId: jobMeta.sessionId,
      result,
      isSkipped: false,
      speakerLabel: jobMeta.speakerLabel,
      timestampStr: jobMeta.timestampStr,
      sourceType: jobMeta.sourceType,
      arrivedAt: Date.now(),
    })

    this.tryCommit()
  }

  /**
   * Mark a sequenceId as skipped (e.g. silence chunk dropped before enqueue or dropped by backpressure).
   * Allows the expectedSequenceId pointer to advance without stalling!
   */
  public skipSequence(sequenceId: number, sessionId?: string): void {
    if (sessionId && this.sessionId !== 'default' && sessionId !== this.sessionId) {
      return
    }
    if (sequenceId < this.expectedSequenceId) {
      return
    }

    this.buffer.set(sequenceId, {
      sequenceId,
      jobId: `skipped_${sequenceId}`,
      sessionId: this.sessionId,
      isSkipped: true,
      arrivedAt: Date.now(),
    })

    this.tryCommit()
  }

  /**
   * Drains ready sequences in strict increasing sequenceId order.
   */
  private tryCommit(): void {
    while (this.buffer.has(this.expectedSequenceId)) {
      const item = this.buffer.get(this.expectedSequenceId)!
      this.buffer.delete(this.expectedSequenceId)
      this.expectedSequenceId++

      // Only emit commits that contain actual recognized speech text
      if (!item.isSkipped && item.result?.success && item.result.text.trim()) {
        this.committedCount++
        const commit: AssemblerCommit = {
          sequenceId: item.sequenceId,
          jobId: item.jobId,
          sessionId: item.sessionId,
          result: item.result,
          speakerLabel: item.speakerLabel,
          timestampStr: item.timestampStr,
          sourceType: item.sourceType,
        }

        for (const listener of this.listeners) {
          try {
            listener(commit)
          } catch (err) {
            console.error('[TranscriptAssembler] Listener callback error:', err)
          }
        }
      }
    }
  }

  /**
   * Watchdog timer: If expectedSequenceId is missing for > 8s while later sequences are waiting,
   * skip the stalled sequence to avoid blocking the user transcript display.
   */
  private startWatchdog(): void {
    if (this.gapWatchdogTimer) return
    this.gapWatchdogTimer = setInterval(() => {
      if (this.buffer.size === 0) return

      const bufferedKeys = Array.from(this.buffer.keys()).sort((a, b) => a - b)
      const lowestBuffered = bufferedKeys[0]

      if (lowestBuffered > this.expectedSequenceId) {
        const item = this.buffer.get(lowestBuffered)
        if (item && Date.now() - item.arrivedAt > 8000) {
          console.warn(
            `[TranscriptAssembler] Stalled sequenceId ${this.expectedSequenceId} timed out after 8s. Advancing to ${lowestBuffered}.`
          )
          this.expectedSequenceId = lowestBuffered
          this.tryCommit()
        }
      }
    }, 2000)
  }

  public reset(startSequenceId = 1): void {
    this.expectedSequenceId = startSequenceId
    this.buffer.clear()
    this.committedCount = 0
  }

  public destroy(): void {
    if (this.gapWatchdogTimer) {
      clearInterval(this.gapWatchdogTimer)
      this.gapWatchdogTimer = null
    }
    this.buffer.clear()
    this.listeners = []
  }

  public getStats() {
    return {
      expectedSequenceId: this.expectedSequenceId,
      bufferedCount: this.buffer.size,
      committedCount: this.committedCount,
    }
  }
}
