/**
 * Grounding Worker Client Manager
 * Manages Vite module Web Worker lifecycle with transparent main-thread fallback.
 * Sends evidence once by hash, handles request cancellation, and measures long tasks.
 */

import {
  classifyClaimDeterministic,
  getOrCreateEvidenceIndex,
  computeEvidenceHash,
  type GroundingClaim,
  type GroundingEvidenceInput,
  type GroundingInput,
  type GroundingMode,
} from './answerGrounding'
import type {
  GroundingWorkerInMessage,
  GroundingWorkerOutMessage,
} from './groundingWorker'

interface PendingRequest {
  resolve: (claim: GroundingClaim) => void
  reject: (err: Error) => void
  sentence: string
  mode?: GroundingMode
  fallbackInput: GroundingInput
}

let workerInstance: Worker | null = null
let currentEvidenceHash = ''
let isWorkerReady = false
let workerFailed = false
const pendingRequests = new Map<string, PendingRequest>()

// PerformanceObserver for longtask measurement
let longTaskCount = 0
let maxLongTaskDuration = 0
let longTaskObserver: PerformanceObserver | null = null

export function startLongTaskObserver(): void {
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount++
          if (entry.duration > maxLongTaskDuration) {
            maxLongTaskDuration = entry.duration
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch {
      // Ignore if unsupported
    }
  }
}

export function getLongTaskMetrics(): { count: number; maxDurationMs: number } {
  return {
    count: longTaskCount,
    maxDurationMs: maxLongTaskDuration,
  }
}

export function resetLongTaskMetrics(): void {
  longTaskCount = 0
  maxLongTaskDuration = 0
}

function handleWorkerMessage(event: MessageEvent<GroundingWorkerOutMessage>): void {
  const data = event.data
  if (!data) return

  if (data.type === 'init_done') {
    isWorkerReady = true
    return
  }

  if (data.type === 'ground_sentence_result') {
    const pending = pendingRequests.get(data.requestId)
    if (pending) {
      pendingRequests.delete(data.requestId)
      pending.resolve(data.claim)
    }
    return
  }

  if (data.type === 'error') {
    if (data.requestId) {
      const pending = pendingRequests.get(data.requestId)
      if (pending) {
        pendingRequests.delete(data.requestId)
        // Fallback to synchronous main thread for this claim
        try {
          const index = getOrCreateEvidenceIndex(pending.fallbackInput)
          const claim = classifyClaimDeterministic(
            pending.sentence,
            index.evidenceList,
            index.factSheet,
            pending.mode || 'balanced',
            index
          )
          pending.resolve({ ...claim, id: data.requestId })
        } catch (err: unknown) {
          pending.reject(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
  }
}

function handleWorkerError(): void {
  workerFailed = true
  isWorkerReady = false

  // Fallback all pending requests to synchronous main-thread
  for (const [requestId, pending] of pendingRequests.entries()) {
    try {
      const index = getOrCreateEvidenceIndex(pending.fallbackInput)
      const claim = classifyClaimDeterministic(
        pending.sentence,
        index.evidenceList,
        index.factSheet,
        pending.mode || 'balanced',
        index
      )
      pending.resolve({ ...claim, id: requestId })
    } catch (err: unknown) {
      pending.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }
  pendingRequests.clear()
}

/**
 * Initializes or reuses the Web Worker for the given evidence context.
 * Sends evidence once by hash. Returns false if falling back to main-thread.
 */
export async function initGroundingWorker(input: GroundingEvidenceInput): Promise<boolean> {
  if (typeof Worker === 'undefined') {
    workerFailed = true
    return false
  }

  const hash = computeEvidenceHash(input)
  if (hash === currentEvidenceHash && isWorkerReady && workerInstance && !workerFailed) {
    return true
  }

  currentEvidenceHash = hash

  try {
    if (!workerInstance) {
      workerInstance = new Worker(new URL('./groundingWorker.ts', import.meta.url), {
        type: 'module',
      })
      workerInstance.onmessage = handleWorkerMessage
      workerInstance.onerror = handleWorkerError
    }

    const initMsg: GroundingWorkerInMessage = {
      type: 'init',
      payload: {
        hash,
        cv: input.cv,
        profile: input.profile,
        jobDescription: input.jobDescription,
        transcript: input.transcript,
        session: input.session,
        mode: input.mode,
      },
    }

    workerInstance.postMessage(initMsg)
    return true
  } catch {
    workerFailed = true
    return false
  }
}

/**
 * Grounds a single sentence using Web Worker if available, with transparent main-thread fallback.
 */
export async function groundSentenceWithWorker(
  requestId: string,
  sentence: string,
  fallbackInput: GroundingInput,
  mode: GroundingMode = 'balanced'
): Promise<GroundingClaim> {
  // If worker is unavailable or failed, run synchronously on main thread
  if (workerFailed || !workerInstance || typeof Worker === 'undefined') {
    const index = getOrCreateEvidenceIndex(fallbackInput)
    const classified = classifyClaimDeterministic(
      sentence,
      index.evidenceList,
      index.factSheet,
      mode,
      index
    )
    return { ...classified, id: requestId }
  }

  return new Promise<GroundingClaim>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve,
      reject,
      sentence,
      mode,
      fallbackInput,
    })

    const msg: GroundingWorkerInMessage = {
      type: 'ground_sentence',
      requestId,
      sentence,
      mode,
    }

    workerInstance?.postMessage(msg)
  })
}

/**
 * Cancels pending requests by requestId or all active requests.
 */
export function cancelGroundingWorkerRequests(requestId?: string): void {
  if (requestId) {
    pendingRequests.delete(requestId)
  } else {
    pendingRequests.clear()
  }

  if (workerInstance && !workerFailed) {
    const cancelMsg: GroundingWorkerInMessage = {
      type: 'cancel',
      requestId,
      cancelAll: !requestId,
    }
    workerInstance.postMessage(cancelMsg)
  }
}

/**
 * Terminates the worker instance on unmount or session exit.
 */
export function terminateGroundingWorker(): void {
  if (workerInstance) {
    workerInstance.terminate()
    workerInstance = null
  }
  isWorkerReady = false
  currentEvidenceHash = ''
  pendingRequests.clear()
  if (longTaskObserver) {
    longTaskObserver.disconnect()
    longTaskObserver = null
  }
}
