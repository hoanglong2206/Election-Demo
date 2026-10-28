/**
 * ─────────────────────────────────────────────────────────────────────────────
 * INTENT GATE & SPECULATIVE GENERATION PROTOCOL (Tier 2 Piggyback)
 * ─────────────────────────────────────────────────────────────────────────────
 * Allows Tier 2 Intent Classification to run with ZERO additional LLM calls
 * by embedding the classification decision at the very beginning of the
 * main response stream.
 *
 * Protocol Format:
 * <<INTENT|<normalizedIntent>|<confidence 0.00-1.00>>>
 * followed by a newline and the actual response content.
 */

import type { NormalizedIntent, AnswerStrategyId } from './types'

export const CONFIDENCE_HIGH = 0.65
export const CONFIDENCE_LOW = 0.35
export const GATE_FALLBACK_CHAR_LIMIT = 80
export const SPECULATIVE_MAX_PER_MINUTE = 6
export const BUDGET_USAGE_LIMIT_PERCENT = 80

export const VALID_NORMALIZED_INTENTS: ReadonlySet<NormalizedIntent> = new Set([
  'direct_question',
  'implicit_question',
  'coding_problem',
  'system_design_problem',
  'behavioral_question',
  'clarification_request',
  'follow_up_question',
  'challenge_or_objection',
  'normal_conversation',
])

export interface GateDecision {
  valid: boolean
  intent: NormalizedIntent
  confidence: number
  rawGate: string
  isActionableQuestion: boolean
}

export interface GateMetrics {
  gateCalls: number
  gateCancelled: number
  wastedTokens: number
  gatePassed: number
  averageGateResolutionLatencyMs: number
}

const gateMetrics: GateMetrics = {
  gateCalls: 0,
  gateCancelled: 0,
  wastedTokens: 0,
  gatePassed: 0,
  averageGateResolutionLatencyMs: 0,
}

export function getGateMetrics(): GateMetrics {
  return { ...gateMetrics }
}

export function resetGateMetrics(): void {
  gateMetrics.gateCalls = 0
  gateMetrics.gateCancelled = 0
  gateMetrics.wastedTokens = 0
  gateMetrics.gatePassed = 0
  gateMetrics.averageGateResolutionLatencyMs = 0
}

export function recordGateCall(): void {
  gateMetrics.gateCalls += 1
}

export function recordGateCancelled(wastedTokens: number = 0): void {
  gateMetrics.gateCancelled += 1
  gateMetrics.wastedTokens += Math.max(0, wastedTokens)
}

export function recordGatePassed(latencyMs: number = 0): void {
  gateMetrics.gatePassed += 1
  const count = gateMetrics.gatePassed
  gateMetrics.averageGateResolutionLatencyMs =
    (gateMetrics.averageGateResolutionLatencyMs * (count - 1) + latencyMs) / count
}

/**
 * Sliding-window rate limiter for speculative LLM calls.
 */
export class SpeculativeRateLimiter {
  private timestamps: number[] = []
  private maxPerMinute: number

  constructor(maxPerMinute = SPECULATIVE_MAX_PER_MINUTE) {
    this.maxPerMinute = maxPerMinute
  }

  public canExecute(now = Date.now()): boolean {
    const oneMinuteAgo = now - 60000
    this.timestamps = this.timestamps.filter((t) => t > oneMinuteAgo)
    return this.timestamps.length < this.maxPerMinute
  }

  public recordExecution(now = Date.now()): void {
    this.timestamps.push(now)
  }

  public getRemaining(now = Date.now()): number {
    const oneMinuteAgo = now - 60000
    this.timestamps = this.timestamps.filter((t) => t > oneMinuteAgo)
    return Math.max(0, this.maxPerMinute - this.timestamps.length)
  }

  public reset(): void {
    this.timestamps = []
  }
}

export const speculativeRateLimiter = new SpeculativeRateLimiter()

/**
 * Parses a single raw gate tag like `<<INTENT|direct_question|0.92>>`.
 */
export function parseRawGateTag(text: string): GateDecision | null {
  if (!text) return null
  const match = text.match(/<<INTENT\s*\|\s*([a-z_]+)\s*\|\s*([0-9.]+)\s*>>/i)
  if (!match) return null

  const rawIntent = match[1].toLowerCase() as NormalizedIntent
  const intent: NormalizedIntent = VALID_NORMALIZED_INTENTS.has(rawIntent)
    ? rawIntent
    : 'normal_conversation'

  const parsedConf = parseFloat(match[2])
  const confidence = isNaN(parsedConf) ? 0.5 : Math.max(0, Math.min(1, parsedConf))

  const isActionableQuestion = intent !== 'normal_conversation' && confidence >= 0.45

  return {
    valid: true,
    intent,
    confidence,
    rawGate: match[0],
    isActionableQuestion,
  }
}

/**
 * Stream Parser that buffers incoming deltas until the `<<INTENT|...>>\n` header is resolved.
 * Supports chunks split across token boundaries (e.g. `<<INTENT|` + `direct_question` + `|0.90>>\n`).
 */
export class IntentGateStreamParser {
  private buffer = ''
  private gateResolved = false
  private gateDecision: GateDecision | null = null
  private startedAt = performance.now()
  private isAmbiguous = false
  private highConfidenceBypass = false

  constructor(options?: { isAmbiguous?: boolean; initialConfidence?: number }) {
    this.isAmbiguous = options?.isAmbiguous ?? false
    this.highConfidenceBypass = (options?.initialConfidence ?? 0) >= CONFIDENCE_HIGH
  }

  /**
   * Feed a new delta into the gate parser.
   *
   * Returns:
   * - `action: 'buffering'`: Still waiting for gate to finish. DO NOT render to UI.
   * - `action: 'pass'`: Gate passed! `contentDelta` has any content trailing the gate.
   * - `action: 'abort'`: Intent is normal_conversation or gate missing in ambiguous range. Stream must be cancelled.
   */
  public feed(delta: string): {
    action: 'buffering' | 'pass' | 'abort'
    decision?: GateDecision
    contentDelta?: string
    reason?: string
  } {
    if (this.gateResolved) {
      return {
        action: 'pass',
        decision: this.gateDecision || undefined,
        contentDelta: delta,
      }
    }

    this.buffer += delta

    // Check if gate tag is fully present in buffer
    const tagMatch = this.buffer.match(/<<INTENT\s*\|\s*[a-z_]+\s*\|\s*[0-9.]+\s*>>/i)
    if (tagMatch) {
      const decision = parseRawGateTag(tagMatch[0])
      if (decision) {
        this.gateResolved = true
        this.gateDecision = decision
        const latencyMs = performance.now() - this.startedAt

        // Remove the gate tag and any immediate trailing newlines from buffer
        const tagIndex = this.buffer.indexOf(tagMatch[0])
        const afterTag = this.buffer.slice(tagIndex + tagMatch[0].length).replace(/^[\r\n]+/, '')

        // Evaluation in Ambiguous Range:
        // If intent is normal_conversation or confidence < 0.45, cancel stream!
        if (this.isAmbiguous && !decision.isActionableQuestion) {
          recordGateCancelled(Math.ceil(this.buffer.length / 4))
          const reason = decision.confidence < 0.45
            ? `Ambiguous gate aborted: Confidence too low (${(decision.confidence * 100).toFixed(0)}% < 45%)`
            : `Ambiguous gate aborted: classified as ${decision.intent} (${(decision.confidence * 100).toFixed(0)}%)`
          return {
            action: 'abort',
            decision,
            reason,
          }
        }

        recordGatePassed(latencyMs)
        return {
          action: 'pass',
          decision,
          contentDelta: afterTag,
        }
      }
    }

    // Edge-case: No gate tag found yet and buffer exceeded fallback limit (~80 chars)
    if (this.buffer.length >= GATE_FALLBACK_CHAR_LIMIT) {
      this.gateResolved = true
      const latencyMs = performance.now() - this.startedAt

      if (this.highConfidenceBypass) {
        // High confidence tier: model skipped gate tag, but confidence >= 0.65 -> allow through
        recordGatePassed(latencyMs)
        return {
          action: 'pass',
          decision: {
            valid: false,
            intent: 'direct_question',
            confidence: CONFIDENCE_HIGH,
            rawGate: '',
            isActionableQuestion: true,
          },
          contentDelta: this.buffer,
        }
      }

      // In ambiguous range without gate: abort for cost safety
      recordGateCancelled(Math.ceil(this.buffer.length / 4))
      return {
        action: 'abort',
        reason: `No intent gate tag found within 80 chars (received ${this.buffer.length} chars)`,
      }
    }

    return { action: 'buffering' }
  }

  /**
   * Compatibility wrapper for processDelta returning status, action, and wastedChars.
   */
  public processDelta(delta: string): {
    status: 'buffering' | 'pass' | 'abort'
    action: 'buffering' | 'pass' | 'abort'
    decision?: GateDecision
    contentDelta: string
    reason?: string
    wastedChars: number
  } {
    const res = this.feed(delta)
    return {
      ...res,
      status: res.action,
      contentDelta: res.contentDelta ?? '',
      wastedChars: this.buffer.length,
    }
  }

  /**
   * Flushes remaining content if stream ends.
   */
  public flush(): {
    action: 'pass' | 'abort'
    decision?: GateDecision
    content?: string
  } {
    if (!this.gateResolved) {
      // Stream ended before gate resolved
      if (this.highConfidenceBypass && this.buffer.trim()) {
        return { action: 'pass', content: this.buffer }
      }
      return { action: 'abort' }
    }
    return {
      action: 'pass',
      decision: this.gateDecision || undefined,
      content: this.buffer,
    }
  }

  public getDecision(): GateDecision | null {
    return this.gateDecision
  }

  public isResolved(): boolean {
    return this.gateResolved
  }
}

/**
 * Strips the leading <<INTENT|...>> header tag from completed text.
 */
export function stripGateTag(text: string): string {
  if (!text) return ''
  return text
    .replace(/^[\s\r\n]*<<INTENT\s*\|\s*[a-z_]+\s*\|\s*[0-9.]+\s*>>[\r\n]*/i, '')
    .trim()
}

/**
 * Infers appropriate AnswerStrategyId from gate NormalizedIntent.
 */
export function inferStrategyFromGateIntent(intent: NormalizedIntent): AnswerStrategyId | null {
  switch (intent) {
    case 'coding_problem':
      return 'coding'
    case 'system_design_problem':
      return 'system_design'
    case 'behavioral_question':
      return 'behavioral'
    default:
      return null
  }
}

/**
 * Checks if the newly classified gate strategy distinctly clashes with the initial heuristic strategy.
 */
export function isDistinctStrategyMismatch(
  currentStrategy: string,
  gateIntentOrStrategy: string
): boolean {
  const gateStrategy = inferStrategyFromGateIntent(gateIntentOrStrategy as any) || gateIntentOrStrategy
  if (currentStrategy === gateStrategy) return false
  const technical = ['coding', 'system_design', 'database']
  const behavioral = ['behavioral', 'leadership']

  if (technical.includes(currentStrategy) && behavioral.includes(gateStrategy)) return true
  if (behavioral.includes(currentStrategy) && technical.includes(gateStrategy)) return true
  if (currentStrategy === 'coding' && gateStrategy === 'system_design') return true
  if (currentStrategy === 'system_design' && gateStrategy === 'coding') return true
  return false
}

/**
 * Maps normalized intent to topic.
 */
export function inferTopicFromIntent(intent: NormalizedIntent): string | undefined {
  switch (intent) {
    case 'coding_problem':
      return 'coding'
    case 'system_design_problem':
      return 'system_design'
    case 'behavioral_question':
      return 'behavioral'
    default:
      return undefined
  }
}

