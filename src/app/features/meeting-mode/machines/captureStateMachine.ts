export type CaptureState =
  | 'idle'
  | 'picking'
  | 'capturing'
  | 'cropping'
  | 'processing'
  | 'done'
  | 'error'

export type CaptureEvent =
  | { type: 'OPEN_PICKER' }
  | { type: 'START_CAPTURE' }
  | { type: 'CAPTURE_SUCCESS' }
  | { type: 'CONFIRM_CROP' }
  | { type: 'ANALYSIS_COMPLETE' }
  | { type: 'RETAKE' }
  | { type: 'CANCEL' }
  | { type: 'FAIL' }
  | { type: 'RESET' }

const VALID_CAPTURE_TRANSITIONS: Record<CaptureState, CaptureState[]> = {
  idle: ['picking', 'capturing'],
  picking: ['capturing', 'idle'],
  capturing: ['cropping', 'error', 'idle'],
  cropping: ['processing', 'capturing', 'idle'],
  processing: ['done', 'error', 'idle'],
  done: ['idle', 'picking'],
  error: ['idle', 'picking', 'capturing'],
}

export function canTransitionCapture(from: CaptureState, to: CaptureState): boolean {
  return VALID_CAPTURE_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionCaptureState(current: CaptureState, event: CaptureEvent): CaptureState {
  switch (current) {
    case 'idle':
      if (event.type === 'OPEN_PICKER') return 'picking'
      if (event.type === 'START_CAPTURE') return 'capturing'
      break

    case 'picking':
      if (event.type === 'START_CAPTURE') return 'capturing'
      if (event.type === 'CANCEL' || event.type === 'RESET') return 'idle'
      break

    case 'capturing':
      if (event.type === 'CAPTURE_SUCCESS') return 'cropping'
      if (event.type === 'FAIL') return 'error'
      if (event.type === 'CANCEL' || event.type === 'RESET') return 'idle'
      break

    case 'cropping':
      if (event.type === 'CONFIRM_CROP') return 'processing'
      if (event.type === 'RETAKE') return 'capturing'
      if (event.type === 'CANCEL' || event.type === 'RESET') return 'idle'
      break

    case 'processing':
      if (event.type === 'ANALYSIS_COMPLETE') return 'done'
      if (event.type === 'FAIL') return 'error'
      if (event.type === 'CANCEL' || event.type === 'RESET') return 'idle'
      break

    case 'done':
      if (event.type === 'OPEN_PICKER') return 'picking'
      if (event.type === 'START_CAPTURE') return 'capturing'
      if (event.type === 'RESET') return 'idle'
      break

    case 'error':
      if (event.type === 'OPEN_PICKER') return 'picking'
      if (event.type === 'START_CAPTURE') return 'capturing'
      if (event.type === 'RESET') return 'idle'
      break
  }

  console.warn(`[CaptureStateMachine] Invalid transition attempted: ${current} with event ${event.type}`)
  return current
}
