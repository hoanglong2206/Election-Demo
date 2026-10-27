/**
 * Web Worker for Tier 1 Deterministic Grounding Engine
 * Offloads tokenization, entity verification, and regex scoring from the main thread.
 * Module worker compatible with Vite (import.meta.url).
 */

import {
  getOrCreateEvidenceIndex,
  classifyClaimDeterministic,
  type EvidenceIndex,
  type GroundingClaim,
  type GroundingEvidenceInput,
  type GroundingMode,
} from './answerGrounding'

export interface WorkerInitMessage {
  type: 'init'
  payload: GroundingEvidenceInput & {
    hash: string
  }
}

export interface WorkerGroundSentenceMessage {
  type: 'ground_sentence'
  requestId: string
  sentence: string
  mode?: GroundingMode
}

export interface WorkerCancelMessage {
  type: 'cancel'
  requestId?: string
  cancelAll?: boolean
}

export type GroundingWorkerInMessage =
  | WorkerInitMessage
  | WorkerGroundSentenceMessage
  | WorkerCancelMessage

export interface WorkerInitDoneMessage {
  type: 'init_done'
  hash: string
}

export interface WorkerGroundSentenceResultMessage {
  type: 'ground_sentence_result'
  requestId: string
  claim: GroundingClaim
}

export interface WorkerErrorMessage {
  type: 'error'
  requestId?: string
  error: string
}

export type GroundingWorkerOutMessage =
  | WorkerInitDoneMessage
  | WorkerGroundSentenceResultMessage
  | WorkerErrorMessage

let currentIndex: EvidenceIndex | null = null
const cancelledRequestIds = new Set<string>()

self.onmessage = (event: MessageEvent<GroundingWorkerInMessage>) => {
  const msg = event.data
  if (!msg) return

  if (msg.type === 'init') {
    try {
      cancelledRequestIds.clear()
      currentIndex = getOrCreateEvidenceIndex(msg.payload)
      self.postMessage({ type: 'init_done', hash: msg.payload.hash } satisfies WorkerInitDoneMessage)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      self.postMessage({
        type: 'error',
        error: errMsg || 'Failed to initialize EvidenceIndex in worker',
      } satisfies WorkerErrorMessage)
    }
    return
  }

  if (msg.type === 'cancel') {
    if (msg.cancelAll) {
      cancelledRequestIds.clear()
    } else if (msg.requestId) {
      cancelledRequestIds.add(msg.requestId)
    }
    return
  }

  if (msg.type === 'ground_sentence') {
    if (cancelledRequestIds.has(msg.requestId)) {
      cancelledRequestIds.delete(msg.requestId)
      return
    }

    if (!currentIndex) {
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        error: 'Worker not initialized with evidence',
      } satisfies WorkerErrorMessage)
      return
    }

    try {
      const classified = classifyClaimDeterministic(
        msg.sentence,
        currentIndex.evidenceList,
        currentIndex.factSheet,
        msg.mode || 'balanced',
        currentIndex
      )

      if (cancelledRequestIds.has(msg.requestId)) {
        cancelledRequestIds.delete(msg.requestId)
        return
      }

      self.postMessage({
        type: 'ground_sentence_result',
        requestId: msg.requestId,
        claim: {
          ...classified,
          id: msg.requestId,
        },
      } satisfies WorkerGroundSentenceResultMessage)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        error: errMsg || 'Error classifying claim in worker',
      } satisfies WorkerErrorMessage)
    }
  }
}
