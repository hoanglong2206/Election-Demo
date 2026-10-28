import { describe, it, expect } from 'bun:test'
import {
  profileFormReducer,
  initialProfileFormState,
  type ProfileFormState,
} from '../profilePresetReducer'

describe('ProfilePresetDialog: profileFormReducer', () => {
  it('resets to default empty state when preset is null', () => {
    const dirty: ProfileFormState = {
      ...initialProfileFormState,
      name: 'Dirty',
      keywords: ['react'],
    }
    const state = profileFormReducer(dirty, { type: 'RESET' })
    expect(state.name).toBe('')
    expect(state.keywords).toEqual([])
  })

  it('resets with values from existing preset', () => {
    const state = profileFormReducer(initialProfileFormState, {
      type: 'RESET',
      preset: {
        id: '123',
        name: 'Backend Dev',
        role: 'Senior Node',
        companyName: 'Acme',
        jobDescription: 'JD text',
        resumeContext: 'CV text',
        customInstructions: 'Be precise',
        keywords: ['Node', 'Postgres'],
        icon: 'server',
        color: 'sky',
        createdAt: 1000,
        updatedAt: 1000,
      },
    })
    expect(state.name).toBe('Backend Dev')
    expect(state.role).toBe('Senior Node')
    expect(state.companyName).toBe('Acme')
    expect(state.keywords).toEqual(['Node', 'Postgres'])
    expect(state.color).toBe('sky')
  })

  it('adds unique keyword and clears input', () => {
    const state1 = profileFormReducer(initialProfileFormState, {
      type: 'ADD_KEYWORD',
      keyword: 'TypeScript',
    })
    expect(state1.keywords).toEqual(['TypeScript'])

    // Duplicate case-insensitive
    const state2 = profileFormReducer(state1, {
      type: 'ADD_KEYWORD',
      keyword: 'typescript',
    })
    expect(state2.keywords).toEqual(['TypeScript'])
  })

  it('removes keyword', () => {
    const stateWithKw: ProfileFormState = {
      ...initialProfileFormState,
      keywords: ['Go', 'Rust'],
    }
    const state = profileFormReducer(stateWithKw, {
      type: 'REMOVE_KEYWORD',
      keyword: 'go',
    })
    expect(state.keywords).toEqual(['Rust'])
  })

  it('updates form fields and errors', () => {
    let state = profileFormReducer(initialProfileFormState, {
      type: 'SET_FIELD',
      field: 'name',
      value: 'My Profile',
    })
    expect(state.name).toBe('My Profile')

    state = profileFormReducer(state, {
      type: 'SET_ERROR',
      error: 'Vui lòng điền tên profile',
    })
    expect(state.error).toBe('Vui lòng điền tên profile')
  })
})
