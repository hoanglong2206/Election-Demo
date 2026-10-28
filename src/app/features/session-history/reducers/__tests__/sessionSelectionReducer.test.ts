import { describe, expect, it } from 'bun:test'
import {
  sessionSelectionReducer,
  initialSessionSelectionState,
  type SessionSelectionState,
} from '../sessionSelectionReducer'
import type { MeetingSession } from '@/services/sessionHistory'

describe('sessionSelectionReducer', () => {
  it('returns initial state by default', () => {
    // @ts-expect-error - testing default branch
    const state = sessionSelectionReducer(initialSessionSelectionState, { type: 'UNKNOWN' })
    expect(state).toEqual(initialSessionSelectionState)
  })

  it('toggles select mode on and off, clearing selected ids on close', () => {
    let state = sessionSelectionReducer(initialSessionSelectionState, { type: 'TOGGLE_SELECT_MODE' })
    expect(state.isSelectMode).toBe(true)

    state = sessionSelectionReducer(state, { type: 'TOGGLE_SELECT_SESSION', id: 's1' })
    expect(state.selectedSessionIds.has('s1')).toBe(true)

    state = sessionSelectionReducer(state, { type: 'TOGGLE_SELECT_MODE' })
    expect(state.isSelectMode).toBe(false)
    expect(state.selectedSessionIds.size).toBe(0)
  })

  it('selects and deselects individual session ids', () => {
    let state = sessionSelectionReducer(initialSessionSelectionState, {
      type: 'TOGGLE_SELECT_SESSION',
      id: 's1',
    })
    expect(state.selectedSessionIds.has('s1')).toBe(true)
    expect(state.selectedSessionIds.size).toBe(1)

    state = sessionSelectionReducer(state, {
      type: 'TOGGLE_SELECT_SESSION',
      id: 's2',
    })
    expect(state.selectedSessionIds.has('s1')).toBe(true)
    expect(state.selectedSessionIds.has('s2')).toBe(true)
    expect(state.selectedSessionIds.size).toBe(2)

    // Toggle s1 off
    state = sessionSelectionReducer(state, {
      type: 'TOGGLE_SELECT_SESSION',
      id: 's1',
    })
    expect(state.selectedSessionIds.has('s1')).toBe(false)
    expect(state.selectedSessionIds.has('s2')).toBe(true)
    expect(state.selectedSessionIds.size).toBe(1)
  })

  it('toggles select all: selects all when not all are selected, clears when all are selected', () => {
    const allIds = ['s1', 's2', 's3']

    // When none are selected
    let state = sessionSelectionReducer(initialSessionSelectionState, {
      type: 'TOGGLE_SELECT_ALL',
      allIds,
    })
    expect(state.selectedSessionIds.size).toBe(3)
    expect(state.selectedSessionIds.has('s1')).toBe(true)
    expect(state.selectedSessionIds.has('s2')).toBe(true)
    expect(state.selectedSessionIds.has('s3')).toBe(true)

    // When all are selected, toggling clears all
    state = sessionSelectionReducer(state, {
      type: 'TOGGLE_SELECT_ALL',
      allIds,
    })
    expect(state.selectedSessionIds.size).toBe(0)

    // When partial are selected, toggling selects all
    state = sessionSelectionReducer(state, {
      type: 'TOGGLE_SELECT_SESSION',
      id: 's1',
    })
    expect(state.selectedSessionIds.size).toBe(1)
    state = sessionSelectionReducer(state, {
      type: 'TOGGLE_SELECT_ALL',
      allIds,
    })
    expect(state.selectedSessionIds.size).toBe(3)
  })

  it('clears selection and select mode with CLEAR_SELECTION', () => {
    let state: SessionSelectionState = {
      isSelectMode: true,
      selectedSessionIds: new Set(['s1', 's2']),
      deleteTarget: null,
    }
    state = sessionSelectionReducer(state, { type: 'CLEAR_SELECTION' })
    expect(state.isSelectMode).toBe(false)
    expect(state.selectedSessionIds.size).toBe(0)
  })

  it('handles setting and clearing delete targets', () => {
    const mockSession = { id: 's1', title: 'Interview' } as MeetingSession
    let state = sessionSelectionReducer(initialSessionSelectionState, {
      type: 'SET_DELETE_TARGET',
      target: { type: 'single', session: mockSession },
    })
    expect(state.deleteTarget).toEqual({ type: 'single', session: mockSession })

    state = sessionSelectionReducer(state, { type: 'CLEAR_DELETE_TARGET' })
    expect(state.deleteTarget).toBeNull()

    state = sessionSelectionReducer(state, {
      type: 'SET_DELETE_TARGET',
      target: { type: 'bulk', ids: ['s1', 's2'] },
    })
    expect(state.deleteTarget).toEqual({ type: 'bulk', ids: ['s1', 's2'] })

    state = sessionSelectionReducer(state, {
      type: 'SET_DELETE_TARGET',
      target: { type: 'all', count: 5 },
    })
    expect(state.deleteTarget).toEqual({ type: 'all', count: 5 })
  })

  it('removes specific ids from selection', () => {
    const state: SessionSelectionState = {
      isSelectMode: true,
      selectedSessionIds: new Set(['s1', 's2', 's3']),
      deleteTarget: null,
    }
    const updated = sessionSelectionReducer(state, {
      type: 'REMOVE_IDS_FROM_SELECTION',
      ids: ['s1', 's3'],
    })
    expect(updated.selectedSessionIds.has('s1')).toBe(false)
    expect(updated.selectedSessionIds.has('s2')).toBe(true)
    expect(updated.selectedSessionIds.has('s3')).toBe(false)
    expect(updated.selectedSessionIds.size).toBe(1)
  })
})
