import '@/test/setupDom'
import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useProfileContext } from '../useProfileContext'

describe('useProfileContext Hook', () => {
  it('initializes context data and manages sample loaders', () => {
    const { result } = renderHook(() => useProfileContext({ mode: 'interview' }))

    expect(result.current.contextData).toBeDefined()
    expect(result.current.interviewTab).toBe('cv')

    act(() => {
      result.current.setInterviewTab('jd')
    })
    expect(result.current.interviewTab).toBe('jd')

    act(() => {
      result.current.handleLoadSampleCV()
    })
    expect(result.current.contextData.cvSummary).toContain('Kinh nghiệm')
    expect(result.current.isContextSaved).toBe(true)
  })

  it('handles keywords add and remove', () => {
    const { result } = renderHook(() => useProfileContext({ mode: 'interview' }))

    act(() => {
      result.current.handleAddKeyword('GraphQL')
    })
    expect(result.current.contextData.keywords).toContain('GraphQL')

    act(() => {
      result.current.handleRemoveKeyword('GraphQL')
    })
    expect(result.current.contextData.keywords).not.toContain('GraphQL')
  })
})
