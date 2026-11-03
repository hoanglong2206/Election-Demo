/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MULTI-TURN CONVERSATIONAL INTENT TRACKER
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks and carries over active technical interview domains (Coding, System Design,
 * Behavioral STAR) across multi-turn exchanges.
 *
 * Prevents context loss when interviewers ask short follow-ups, challenge questions,
 * or clarification queries ("Thế còn độ trễ thì sao?", "Why not Redis?", "Còn cách
 * nào tối ưu hơn không?", "Lúc đó bạn cảm thấy thế nào?").
 *
 * Provides both stateful in-memory tracking and deterministic history resolution.
 */

import type {
  IntentDetectionResult,
  NormalizedIntent,
  InterviewDomain,
  MultiTurnState,
} from './types'
import {
  CODING_TERMS,
  SYSTEM_DESIGN_TERMS,
  BEHAVIORAL_TERMS,
  STAR_PROMPT_TERMS,
} from './heuristic'
import { isCandidateSpeaker } from './triggerLog'

export const MAX_INHERITANCE_TURNS = 4

/**
 * Connective cues and pronouns that indicate follow-up continuation of the active topic.
 */
const CONTEXTUAL_FOLLOW_UP_CUES =
  /\b(?:thế còn|vậy còn|còn|nếu vậy|tại sao|sao lại|lúc đó|kết quả|bài học|how about|what about|what if|why not|why|can we|and then|then|edge case|trade-off|bottleneck)\b/i

/**
 * Explicit topic shift cues that indicate the interviewer is deliberately moving on.
 */
const TOPIC_SHIFT_CUES =
  /\b(?:chuyển sang|chuyển qua|bây giờ sang|phần tiếp theo|let's move to|moving on to|next question|next topic|next problem)\b/i

export function getDomainFromIntent(intent?: NormalizedIntent): InterviewDomain | undefined {
  if (intent === 'coding_problem') return 'coding'
  if (intent === 'system_design_problem') return 'system_design'
  if (intent === 'behavioral_question') return 'behavioral'
  return undefined
}

export class MultiTurnIntentTracker {
  private state: MultiTurnState = {
    turnsSinceAnchor: 0,
  }

  /**
   * Returns a snapshot of the current multi-turn tracking state.
   */
  public getState(): Readonly<MultiTurnState> {
    return { ...this.state }
  }

  /**
   * Resets all multi-turn context (e.g. on session restart or clear).
   */
  public reset(): void {
    this.state = {
      activeDomain: undefined,
      activeDomainIntent: undefined,
      activeTopic: undefined,
      lastAnchorText: undefined,
      turnsSinceAnchor: 0,
    }
  }

  /**
   * Stateful method: records an incoming turn into the tracker and enriches
   * the detection with inherited context if applicable.
   */
  public recordTurn(
    detection: IntentDetectionResult,
    speaker?: string
  ): IntentDetectionResult {
    // Candidate turns do not establish new interview domain anchors
    if (speaker && isCandidateSpeaker(speaker)) {
      return detection
    }

    const rawText = detection.normalizedText || detection.rawText || ''
    const currentIntent = detection.normalizedIntent

    // 1. Check if the current turn explicitly introduces a new domain anchor
    const explicitDomain = getDomainFromIntent(currentIntent)
    if (explicitDomain) {
      this.state = {
        activeDomain: explicitDomain,
        activeDomainIntent: currentIntent,
        activeTopic: detection.topic || explicitDomain,
        lastAnchorText: rawText,
        turnsSinceAnchor: 0,
      }
      return {
        ...detection,
        activeDomain: explicitDomain,
        isContextInherited: false,
      }
    }

    // 2. Check for explicit topic shift cues that break existing domain anchor
    if (TOPIC_SHIFT_CUES.test(rawText)) {
      this.reset()
      return detection
    }

    // 3. If there is an active domain within the decay window, check for inheritance
    if (
      this.state.activeDomain &&
      this.state.activeDomainIntent &&
      this.state.turnsSinceAnchor < MAX_INHERITANCE_TURNS
    ) {
      const isQuestionOrFollowUp =
        detection.isQuestion ||
        Boolean(detection.isFollowUp) ||
        Boolean(detection.isChallenge) ||
        Boolean(detection.isClarification) ||
        CONTEXTUAL_FOLLOW_UP_CUES.test(rawText)

      const isCandidateForInheritance =
        isQuestionOrFollowUp &&
        (Boolean(detection.isFollowUp) ||
          Boolean(detection.isChallenge) ||
          Boolean(detection.isClarification) ||
          CONTEXTUAL_FOLLOW_UP_CUES.test(rawText) ||
          rawText.trim().split(/\s+/).length <= 14)

      if (isCandidateForInheritance) {
        this.state.turnsSinceAnchor += 1
        return {
          ...detection,
          parentIntent: this.state.activeDomainIntent,
          activeDomain: this.state.activeDomain,
          topic: detection.topic || this.state.activeTopic,
          isContextInherited: true,
          inheritedFromTurn: this.state.turnsSinceAnchor,
          contextTurnCount: this.state.turnsSinceAnchor,
        }
      }
    }

    // 4. No inheritance; advance decay counter if an anchor exists
    if (this.state.activeDomain) {
      this.state.turnsSinceAnchor += 1
      if (this.state.turnsSinceAnchor >= MAX_INHERITANCE_TURNS) {
        this.reset()
      }
    }

    return detection
  }

  /**
   * Deterministic method: resolves multi-turn context from a given slice of transcript lines.
   * Does NOT mutate internal state, making it idempotent and pure for any transcript window.
   */
  public resolveFromHistory(
    currentDetection: IntentDetectionResult,
    lines: Array<{ speaker?: string; original?: string; text?: string }>
  ): IntentDetectionResult {
    // If current detection is already a domain anchor, no need to inherit
    const currentIntent = currentDetection.normalizedIntent
    const selfDomain = getDomainFromIntent(currentIntent)
    if (selfDomain) {
      return {
        ...currentDetection,
        activeDomain: selfDomain,
        isContextInherited: false,
      }
    }

    if (!lines || lines.length <= 1) {
      return currentDetection
    }

    const currentText = currentDetection.normalizedText || currentDetection.rawText || ''

    // If current text explicitly shifts topic, do not inherit
    if (TOPIC_SHIFT_CUES.test(currentText)) {
      return currentDetection
    }

    // Scan backwards from second-to-last line up to lookback limit (10 lines)
    const lookbackStartIndex = Math.max(0, lines.length - 1 - 10)
    let turnsBack = 0

    for (let i = lines.length - 2; i >= lookbackStartIndex && turnsBack < MAX_INHERITANCE_TURNS; i--) {
      const line = lines[i]
      const speaker = line?.speaker || ''

      // Skip candidate turns when looking for interviewer's domain anchor
      if (isCandidateSpeaker(speaker)) {
        continue
      }

      const text = (line?.original || (line as any)?.text || '').trim()
      if (!text) continue

      turnsBack++

      // If an intermediate turn broke topic, stop
      if (TOPIC_SHIFT_CUES.test(text)) {
        break
      }

      // Check if this previous interviewer line was a domain anchor
      let anchorDomain: InterviewDomain | undefined
      let anchorIntent: NormalizedIntent | undefined

      if (STAR_PROMPT_TERMS.test(text) || BEHAVIORAL_TERMS.test(text)) {
        anchorDomain = 'behavioral'
        anchorIntent = 'behavioral_question'
      } else if (SYSTEM_DESIGN_TERMS.test(text)) {
        anchorDomain = 'system_design'
        anchorIntent = 'system_design_problem'
      } else if (CODING_TERMS.test(text)) {
        anchorDomain = 'coding'
        anchorIntent = 'coding_problem'
      }

      if (anchorDomain && anchorIntent) {
        // Check if current turn is eligible for inheritance
        const isQuestionOrFollowUp =
          currentDetection.isQuestion ||
          Boolean(currentDetection.isFollowUp) ||
          Boolean(currentDetection.isChallenge) ||
          Boolean(currentDetection.isClarification) ||
          CONTEXTUAL_FOLLOW_UP_CUES.test(currentText)

        const isEligible =
          isQuestionOrFollowUp &&
          (Boolean(currentDetection.isFollowUp) ||
            Boolean(currentDetection.isChallenge) ||
            Boolean(currentDetection.isClarification) ||
            CONTEXTUAL_FOLLOW_UP_CUES.test(currentText) ||
            currentText.trim().split(/\s+/).length <= 14)

        if (isEligible) {
          return {
            ...currentDetection,
            parentIntent: anchorIntent,
            activeDomain: anchorDomain,
            topic: currentDetection.topic || anchorDomain,
            isContextInherited: true,
            inheritedFromTurn: turnsBack,
            contextTurnCount: turnsBack,
          }
        }
        break
      }
    }

    return currentDetection
  }
}

export const multiTurnIntentTracker = new MultiTurnIntentTracker()
