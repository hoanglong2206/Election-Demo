import type { MeetingSession } from '@/services/sessionHistory'

export type DeleteTarget =
  | { type: 'single'; session: MeetingSession }
  | { type: 'bulk'; ids: string[] }
  | { type: 'all'; count: number }
  | null

export interface SessionSelectionState {
  isSelectMode: boolean
  selectedSessionIds: Set<string>
  deleteTarget: DeleteTarget
}

export const initialSessionSelectionState: SessionSelectionState = {
  isSelectMode: false,
  selectedSessionIds: new Set<string>(),
  deleteTarget: null,
}

export type SessionSelectionAction =
  | { type: 'TOGGLE_SELECT_MODE' }
  | { type: 'SET_SELECT_MODE'; enabled: boolean }
  | { type: 'TOGGLE_SELECT_SESSION'; id: string }
  | { type: 'TOGGLE_SELECT_ALL'; allIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_DELETE_TARGET'; target: DeleteTarget }
  | { type: 'CLEAR_DELETE_TARGET' }
  | { type: 'REMOVE_IDS_FROM_SELECTION'; ids: string[] }

export function sessionSelectionReducer(
  state: SessionSelectionState,
  action: SessionSelectionAction
): SessionSelectionState {
  switch (action.type) {
    case 'TOGGLE_SELECT_MODE': {
      const nextMode = !state.isSelectMode
      return {
        ...state,
        isSelectMode: nextMode,
        selectedSessionIds: nextMode ? state.selectedSessionIds : new Set<string>(),
      }
    }

    case 'SET_SELECT_MODE': {
      return {
        ...state,
        isSelectMode: action.enabled,
        selectedSessionIds: action.enabled ? state.selectedSessionIds : new Set<string>(),
      }
    }

    case 'TOGGLE_SELECT_SESSION': {
      const nextSet = new Set(state.selectedSessionIds)
      if (nextSet.has(action.id)) {
        nextSet.delete(action.id)
      } else {
        nextSet.add(action.id)
      }
      return {
        ...state,
        selectedSessionIds: nextSet,
      }
    }

    case 'TOGGLE_SELECT_ALL': {
      const allCount = action.allIds.length
      const isAllSelected = allCount > 0 && state.selectedSessionIds.size === allCount
      return {
        ...state,
        selectedSessionIds: isAllSelected ? new Set<string>() : new Set(action.allIds),
      }
    }

    case 'CLEAR_SELECTION': {
      return {
        ...state,
        isSelectMode: false,
        selectedSessionIds: new Set<string>(),
      }
    }

    case 'SET_DELETE_TARGET': {
      return {
        ...state,
        deleteTarget: action.target,
      }
    }

    case 'CLEAR_DELETE_TARGET': {
      return {
        ...state,
        deleteTarget: null,
      }
    }

    case 'REMOVE_IDS_FROM_SELECTION': {
      const nextSet = new Set(state.selectedSessionIds)
      for (const id of action.ids) {
        nextSet.delete(id)
      }
      return {
        ...state,
        selectedSessionIds: nextSet,
      }
    }

    default:
      return state
  }
}

