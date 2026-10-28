export type CopilotState =
  | 'idle'
  | 'detecting'
  | 'generating'
  | 'streaming'
  | 'done'
  | 'error'
  | 'interrupted'

export type CopilotEvent =
  | { type: 'DETECT_QUESTION' }
  | { type: 'START_GENERATION' }
  | { type: 'FIRST_TOKEN' }
  | { type: 'FINISH_STREAM' }
  | { type: 'INTERRUPT' }
  | { type: 'FAIL' }
  | { type: 'RESET' }

const VALID_COPILOT_TRANSITIONS: Record<CopilotState, CopilotState[]> = {
  idle: ['detecting', 'generating'],
  detecting: ['generating', 'idle'],
  generating: ['streaming', 'interrupted', 'error', 'done', 'idle'],
  streaming: ['done', 'interrupted', 'error', 'idle'],
  done: ['idle', 'detecting', 'generating'],
  error: ['idle', 'generating'],
  interrupted: ['generating', 'idle'],
}

export function canTransitionCopilot(from: CopilotState, to: CopilotState): boolean {
  return VALID_COPILOT_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionCopilotState(current: CopilotState, event: CopilotEvent): CopilotState {
  switch (current) {
    case 'idle':
      if (event.type === 'DETECT_QUESTION') return 'detecting'
      if (event.type === 'START_GENERATION') return 'generating'
      break

    case 'detecting':
      if (event.type === 'START_GENERATION') return 'generating'
      if (event.type === 'RESET') return 'idle'
      break

    case 'generating':
      if (event.type === 'FIRST_TOKEN') return 'streaming'
      if (event.type === 'INTERRUPT') return 'interrupted'
      if (event.type === 'FAIL') return 'error'
      if (event.type === 'FINISH_STREAM') return 'done'
      if (event.type === 'RESET') return 'idle'
      break

    case 'streaming':
      if (event.type === 'FINISH_STREAM') return 'done'
      if (event.type === 'INTERRUPT') return 'interrupted'
      if (event.type === 'FAIL') return 'error'
      if (event.type === 'RESET') return 'idle'
      break

    case 'done':
      if (event.type === 'DETECT_QUESTION') return 'detecting'
      if (event.type === 'START_GENERATION') return 'generating'
      if (event.type === 'RESET') return 'idle'
      break

    case 'error':
      if (event.type === 'START_GENERATION') return 'generating'
      if (event.type === 'RESET') return 'idle'
      break

    case 'interrupted':
      if (event.type === 'START_GENERATION') return 'generating'
      if (event.type === 'RESET') return 'idle'
      break
  }

  console.warn(`[CopilotStateMachine] Invalid transition attempted: ${current} with event ${event.type}`)
  return current
}
