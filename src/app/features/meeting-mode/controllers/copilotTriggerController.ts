import type { SpeechSegmentCloseReason } from '@/core/audio'
import {
  getAdaptiveDebounceMs,
  speculativeRateLimiter,
  type IntentDetectionResult,
  type TriggerMode,
} from '@/services/ai-model/copilot'
import type { ScannedExchangeResult } from '@/services/ai-model/copilotResponseService'

export interface ScheduleTriggerOptions {
  exchange: ScannedExchangeResult
  intent: IntentDetectionResult
  closeReason?: SpeechSegmentCloseReason
  isGenerating: boolean
  cancelCurrentStream: () => void
  onTrigger: (exchange: ScannedExchangeResult) => Promise<void> | void
}

export class CopilotTriggerController {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private lastExchangeSignature = ''
  private triggerMode: TriggerMode = 'auto'

  constructor(initialTriggerMode: TriggerMode = 'auto') {
    this.triggerMode = initialTriggerMode
  }

  public setTriggerMode(mode: TriggerMode): void {
    this.triggerMode = mode
    if (mode === 'manual') {
      this.cancelPending()
    }
  }

  public getTriggerMode(): TriggerMode {
    return this.triggerMode
  }

  public getLastSignature(): string {
    return this.lastExchangeSignature
  }

  public setLastSignature(sig: string): void {
    this.lastExchangeSignature = sig
  }

  public scheduleTrigger(options: ScheduleTriggerOptions): boolean {
    const { exchange, intent, closeReason, isGenerating, cancelCurrentStream, onTrigger } = options

    // 1. Only auto mode triggers automatic copilot LLM call
    if (this.triggerMode !== 'auto') {
      return false
    }

    // 2. IntentGate check: small talk or non-triggering intents skipped
    if (!intent.shouldTriggerCopilot) {
      return false
    }

    // 3. Deduplication: skip if identical signature already triggered
    const textSignature = exchange.original.trim()
    if (textSignature === this.lastExchangeSignature) {
      return false
    }

    // 4. Rate-limit check for ambiguous band
    if (intent.isAmbiguous && !speculativeRateLimiter.canExecute()) {
      return false
    }

    // 5. Clear pending debounce timer
    this.cancelPending()

    const debounceMs = getAdaptiveDebounceMs(exchange.original, 500, closeReason)

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null

      if (intent.isAmbiguous) {
        speculativeRateLimiter.recordExecution()
      }

      // CRITICAL RACE CONDITION HANDLING:
      // If a previous stream is in-flight when a new question arrives,
      // cancel the old stream immediately and dispatch the new question without dropping it!
      if (isGenerating) {
        cancelCurrentStream()
      }

      this.lastExchangeSignature = textSignature
      await onTrigger(exchange)
    }, debounceMs)

    return true
  }

  public cancelPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  public reset(): void {
    this.cancelPending()
    this.lastExchangeSignature = ''
  }
}

export const copilotTriggerController = new CopilotTriggerController()
