import '@/test/setupDom'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useCredentialManagement } from '../useCredentialManagement'
import { setIpcClient, resetIpcClient, MockIpcAdapter } from '@/infrastructure/ipc'

describe('useCredentialManagement Hook', () => {
  let mockIpc: MockIpcAdapter

  beforeEach(() => {
    localStorage.clear()
    mockIpc = new MockIpcAdapter()
    setIpcClient(mockIpc)
  })

  afterEach(() => {
    cleanup()
    resetIpcClient()
  })

  it('initializes credential statuses from credentialsPort', async () => {
    const setSelectedLLM = () => {}
    const setSelectedSTT = () => {}
    const setModelsList = () => {}
    const setSttEnginesList = () => {}

    const { result } = renderHook(() =>
      useCredentialManagement({
        llmProvider: 'Auto',
        selectedLLM: '',
        selectedSTT: 'whisper-large-v3-turbo',
        setSelectedLLM,
        setSelectedSTT,
        setModelsList,
        setSttEnginesList,
        autoDismissMs: 0,
      })
    )

    // Flush promises
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current.secureStorageAvailable).toBe(true)
    expect(result.current.groqVerify.state).toBe('idle')
    expect(result.current.llmVerify.state).toBe('idle')
  })

  it('saves and deletes groq key via credentialsPort', async () => {
    let savedSTT = ''
    let modelsCount = 0
    const { result } = renderHook(() =>
      useCredentialManagement({
        llmProvider: 'Auto',
        selectedLLM: '',
        selectedSTT: 'ggml-tiny.bin',
        setSelectedLLM: () => {},
        setSelectedSTT: (id) => {
          savedSTT = id
        },
        setModelsList: (models) => {
          modelsCount = models.length
        },
        setSttEnginesList: () => {},
        autoDismissMs: 0,
      })
    )

    let success = false
    await act(async () => {
      success = await result.current.handleSaveGroqKey('gsk_valid_key_123', [], [])
    })

    expect(success).toBe(true)
    expect(result.current.groqVerify.state).toBe('valid')
    expect(savedSTT).toBeDefined()
    expect(modelsCount).toBeGreaterThanOrEqual(0)

    await act(async () => {
      success = await result.current.handleDeleteGroqKey()
    })

    expect(success).toBe(true)
    expect(result.current.groqVerify.state).toBe('idle')
  })

  it('saves and deletes LLM key via credentialsPort', async () => {
    const { result } = renderHook(() =>
      useCredentialManagement({
        llmProvider: 'OpenAI',
        selectedLLM: '',
        selectedSTT: 'ggml-tiny.bin',
        setSelectedLLM: () => {},
        setSelectedSTT: () => {},
        setModelsList: () => {},
        setSttEnginesList: () => {},
        autoDismissMs: 0,
      })
    )

    let success = false
    await act(async () => {
      success = await result.current.handleSaveLLMKey('openai', 'sk-test-key')
    })

    expect(success).toBe(true)
    expect(result.current.llmVerify.state).toBe('valid')

    await act(async () => {
      success = await result.current.handleDeleteLLMKey('openai')
    })

    expect(success).toBe(true)
    expect(result.current.llmVerify.state).toBe('idle')
  })
})
