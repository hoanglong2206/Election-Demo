import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useWhisperEngineCheck } from '../useWhisperEngineCheck'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'

describe('useWhisperEngineCheck Hook', () => {
  let mockIpc: MockIpcAdapter

  beforeEach(() => {
    mockIpc = new MockIpcAdapter()
    setIpcClient(mockIpc)
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
  })

  it('runs native engine check and returns result', async () => {
    const { result } = renderHook(() =>
      useWhisperEngineCheck({
        selectedSTT: 'ggml-tiny.bin',
        setSelectedSTT: () => {},
        setSttEnginesList: () => {},
      })
    )

    expect(result.current.isCheckingNative).toBe(false)
    expect(result.current.nativeTestResult).toBeNull()

    await act(async () => {
      await result.current.handleCheckNativeEngine()
    })

    expect(result.current.isCheckingNative).toBe(false)
    expect(result.current.nativeTestResult).not.toBeNull()
    expect(result.current.nativeTestResult?.isNative).toBe(true)
    expect(result.current.nativeTestResult?.latencyMs).toBe(120)
  })
})

