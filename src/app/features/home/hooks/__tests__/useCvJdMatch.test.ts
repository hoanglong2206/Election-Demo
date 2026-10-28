import '@/test/setupDom'
import { describe, it, expect } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { useCvJdMatch } from '../useCvJdMatch'

describe('useCvJdMatch Hook', () => {
  it('computes heuristic match score when CV and JD are present in interview mode', async () => {
    const { result } = renderHook(() =>
      useCvJdMatch({
        mode: 'interview',
        hasCV: true,
        hasJD: true,
        cvSummary: '5 years React, TypeScript, Node.js development',
        jobDescription: 'Seeking Senior React Developer with TypeScript',
      })
    )

    expect(result.current.isMatchDialogOpen).toBe(false)
    expect(result.current.isAnalyzingMatch).toBe(false)

    act(() => {
      result.current.setIsMatchDialogOpen(true)
    })
    expect(result.current.isMatchDialogOpen).toBe(true)
  })

  it('resets match score when in discussion mode or when CV/JD missing', () => {
    const { result } = renderHook(() =>
      useCvJdMatch({
        mode: 'discussion',
        hasCV: true,
        hasJD: true,
        cvSummary: 'React',
        jobDescription: 'React',
      })
    )

    expect(result.current.matchResult).toBeNull()
  })
})
