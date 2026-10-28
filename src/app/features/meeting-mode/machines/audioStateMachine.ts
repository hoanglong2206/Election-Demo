export type AudioState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'switching'
  | 'stopping'

export type AudioEvent =
  | { type: 'START' }
  | { type: 'CAPTURE_READY' }
  | { type: 'START_FAILED' }
  | { type: 'SWITCH_SOURCE' }
  | { type: 'SWITCH_COMPLETED' }
  | { type: 'STOP' }
  | { type: 'STOPPED' }
  | { type: 'RESET' }

const VALID_AUDIO_TRANSITIONS: Record<AudioState, AudioState[]> = {
  idle: ['starting'],
  starting: ['listening', 'idle'],
  listening: ['switching', 'stopping', 'idle'],
  switching: ['listening', 'stopping', 'idle'],
  stopping: ['idle'],
}

export function canTransitionAudio(from: AudioState, to: AudioState): boolean {
  return VALID_AUDIO_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionAudioState(current: AudioState, event: AudioEvent): AudioState {
  switch (current) {
    case 'idle':
      if (event.type === 'START') return 'starting'
      break

    case 'starting':
      if (event.type === 'CAPTURE_READY') return 'listening'
      if (event.type === 'START_FAILED') return 'idle'
      break

    case 'listening':
      if (event.type === 'SWITCH_SOURCE') return 'switching'
      if (event.type === 'STOP') return 'stopping'
      if (event.type === 'RESET') return 'idle'
      break

    case 'switching':
      if (event.type === 'SWITCH_COMPLETED') return 'listening'
      if (event.type === 'STOP') return 'stopping'
      if (event.type === 'RESET') return 'idle'
      break

    case 'stopping':
      if (event.type === 'STOPPED' || event.type === 'RESET') return 'idle'
      break
  }

  // If transition is invalid, keep current state and log warning
  console.warn(`[AudioStateMachine] Invalid transition attempted: ${current} with event ${event.type}`)
  return current
}
