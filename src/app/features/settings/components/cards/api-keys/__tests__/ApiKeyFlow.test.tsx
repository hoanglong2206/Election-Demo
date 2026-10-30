import '@/test/setupDom'
import { describe, it, expect, mock } from 'bun:test'
import { render, fireEvent, act } from '@testing-library/react'
import { GroqApiKeySection } from '../GroqApiKeySection'
import { LLMProviderKeySection } from '../LLMProviderKeySection'

describe('ApiKeyFlow UX Workflow Test', () => {
  it('Groq flow: input key -> test validity -> show sync -> sync models -> show models & disabled save -> check all -> enabled save', async () => {
    const onVerifyRawKey = mock(async () => ({
      valid: true,
      provider: 'Groq',
      models: [
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
        { id: 'mixtral-8x7b', name: 'Mixtral 8x7B' },
      ],
      sttModels: [{ id: 'whisper-large-v3', name: 'Whisper Large v3' }],
    }))
    const onTestModelAvailability = mock(async () => ({ available: true }))
    const onSaveGroqKey = mock(async () => true)

    let view: any
    await act(async () => {
      view = render(
        <GroqApiKeySection
          groqStatus={{ configured: false }}
          groqVerify={{ state: 'idle' }}
          onVerifyGroq={() => {}}
          onSaveGroqKey={onSaveGroqKey}
          onDeleteRequest={() => {}}
          onVerifyRawKey={onVerifyRawKey}
          onTestModelAvailability={onTestModelAvailability}
        />
      )
    })

    // 1. Initial: button is "Kiểm tra hợp lệ", models list is NOT shown
    const input = view.container.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(view.getByText('Kiểm tra hợp lệ')).toBeDefined()
    expect(view.queryByText('Đồng bộ model')).toBeNull()
    expect(view.queryByText('Lưu OS Store')).toBeNull()
    expect(view.queryByText(/Danh sách mô hình Groq/)).toBeNull()

    // 2. Type key & click "Kiểm tra hợp lệ"
    await act(async () => {
      input.value = 'gsk_test12345'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      fireEvent.click(view.getByText('Kiểm tra hợp lệ'))
    })

    expect(onVerifyRawKey).toHaveBeenCalledWith('groq', 'gsk_test12345')

    // 3. Key is valid: shows "Đồng bộ model" button, models list is STILL NOT shown
    expect(view.getByText('Đồng bộ model')).toBeDefined()
    expect(view.getByText(/Key hợp lệ! Hãy bấm Đồng bộ model/)).toBeDefined()
    expect(view.queryByText('Lưu OS Store')).toBeNull()
    expect(view.queryByText(/Danh sách mô hình Groq/)).toBeNull()

    // 4. Click "Đồng bộ model"
    await act(async () => {
      fireEvent.click(view.getByText('Đồng bộ model'))
    })

    // Now: models list appears and Save button appears
    expect(view.getByText(/Danh sách mô hình Groq từ API/)).toBeDefined()
    const saveBtn = view.getByText('Lưu OS Store').closest('button')
    expect(saveBtn).not.toBeNull()
    // Save button is disabled because models are unchecked!
    expect(saveBtn!.disabled).toBe(true)

    // 5. Click "Kiểm tra tất cả model"
    const checkAllBtn = view.getByText('Kiểm tra tất cả model')
    await act(async () => {
      fireEvent.click(checkAllBtn)
    })

    // All models checked -> Save button becomes enabled
    expect(saveBtn!.disabled).toBe(false)

    // 6. Click Save
    await act(async () => {
      fireEvent.click(saveBtn!)
    })
    expect(onSaveGroqKey).toHaveBeenCalled()
  })

  it('LLM flow: input key -> test validity -> show sync -> sync models -> show models & disabled save -> check all -> enabled save', async () => {
    const onVerifyRawKey = mock(async () => ({
      valid: true,
      provider: 'Google',
      models: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      ],
    }))
    const onTestModelAvailability = mock(async () => ({ available: true }))
    const onSaveLLMKey = mock(async () => true)

    let view: any
    await act(async () => {
      view = render(
        <LLMProviderKeySection
          llmStatus={{ configured: false }}
          llmVerify={{ state: 'idle' }}
          onVerifyLLM={() => {}}
          llmProvider="Google"
          onLlmProviderChange={() => {}}
          onSaveLLMKey={onSaveLLMKey}
          onDeleteRequest={() => {}}
          onVerifyRawKey={onVerifyRawKey}
          onTestModelAvailability={onTestModelAvailability}
        />
      )
    })

    // 1. Initial state
    const input = view.container.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(view.getByText('Kiểm tra hợp lệ')).toBeDefined()
    expect(view.queryByText('Đồng bộ model')).toBeNull()
    expect(view.queryByText('Lưu OS Store')).toBeNull()
    expect(view.queryByText(/Danh sách mô hình Google/)).toBeNull()

    // 2. Type key & test validity
    await act(async () => {
      input.value = 'AIzaSyTest123'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      fireEvent.click(view.getByText('Kiểm tra hợp lệ'))
    })

    // 3. Verified -> shows Sync button, models still hidden
    expect(view.getByText('Đồng bộ model')).toBeDefined()
    expect(view.queryByText(/Danh sách mô hình Google/)).toBeNull()
    expect(view.queryByText('Lưu OS Store')).toBeNull()

    // 4. Click Sync -> models shown, save disabled
    await act(async () => {
      fireEvent.click(view.getByText('Đồng bộ model'))
    })

    expect(view.getByText(/Danh sách mô hình Google từ API/)).toBeDefined()
    const saveBtn = view.getByText('Lưu OS Store').closest('button')
    expect(saveBtn!.disabled).toBe(true)

    // 5. Check all models -> save enabled
    const checkAllBtn = view.getByText('Kiểm tra tất cả model')
    await act(async () => {
      fireEvent.click(checkAllBtn)
    })
    expect(saveBtn!.disabled).toBe(false)

    // 6. Save
    await act(async () => {
      fireEvent.click(saveBtn!)
    })
    expect(onSaveLLMKey).toHaveBeenCalled()
  })

  it('Groq save failure displays clear error and allows retry without disguising failure', async () => {
    const onVerifyRawKey = mock(async () => ({
      valid: true,
      provider: 'Groq',
      models: [{ id: 'llama-3.3-70b', name: 'Llama 3.3 70B' }],
    }))
    const onTestModelAvailability = mock(async () => ({ available: true }))
    const onSaveGroqKey = mock(async () => false) // Fails!

    let view: any
    await act(async () => {
      view = render(
        <GroqApiKeySection
          groqStatus={{ configured: false }}
          groqVerify={{ state: 'idle' }}
          onVerifyGroq={() => {}}
          onSaveGroqKey={onSaveGroqKey}
          onDeleteRequest={() => {}}
          onVerifyRawKey={onVerifyRawKey}
          onTestModelAvailability={onTestModelAvailability}
        />
      )
    })

    const input = view.container.querySelector('input[type="password"]') as HTMLInputElement
    await act(async () => {
      input.value = 'gsk_test12345'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      fireEvent.click(view.getByText('Kiểm tra hợp lệ'))
    })

    await act(async () => {
      fireEvent.click(view.getByText('Đồng bộ model'))
    })

    await act(async () => {
      fireEvent.click(view.getByText('Kiểm tra tất cả model'))
    })

    const saveBtn = view.getByText('Lưu OS Store').closest('button')
    await act(async () => {
      fireEvent.click(saveBtn!)
    })

    // Error message should be rendered, save button still present for retry
    expect(view.getByText(/Không thể lưu Groq API key vào OS Credential Store/)).toBeDefined()
    expect(view.getByText('Lưu OS Store')).toBeDefined()
  })
});
