import { describe, it, expect } from 'bun:test'
import { IPC_CHANNELS } from '../channels.js'
import {
  windowResizeSchema,
  desktopCaptureOptionsSchema,
  sessionRenameSchema,
  usageRecordSchema,
  apiKeySaveSchema,
  llmStreamStartSchema,
  whisperDownloadProgressSchema,
} from '../schemas.js'

describe('Common IPC Contract: Channels & Zod Schemas', () => {
  it('1. IPC_CHANNELS contains all defined namespace categories', () => {
    expect(IPC_CHANNELS.WINDOW).toBeDefined()
    expect(IPC_CHANNELS.CAPTURE).toBeDefined()
    expect(IPC_CHANNELS.WHISPER).toBeDefined()
    expect(IPC_CHANNELS.SESSIONS).toBeDefined()
    expect(IPC_CHANNELS.RECOVERY).toBeDefined()
    expect(IPC_CHANNELS.USAGE).toBeDefined()
    expect(IPC_CHANNELS.CREDENTIALS).toBeDefined()
    expect(IPC_CHANNELS.LLM).toBeDefined()

    expect(IPC_CHANNELS.WINDOW.MINIMIZE).toBe('window:minimize')
    expect(IPC_CHANNELS.CAPTURE.CAPTURE_SCREEN).toBe('desktop:captureScreen')
    expect(IPC_CHANNELS.WHISPER.TRANSCRIBE).toBe('nativeWhisper:transcribe')
    expect(IPC_CHANNELS.SESSIONS.GET_ALL).toBe('sessions:getAll')
    expect(IPC_CHANNELS.RECOVERY.APPEND).toBe('sessions:recovery:append')
    expect(IPC_CHANNELS.USAGE.APPEND).toBe('usage:append')
    expect(IPC_CHANNELS.CREDENTIALS.SAVE_API_KEY).toBe('credentials:saveApiKey')
    expect(IPC_CHANNELS.LLM.STREAM_START).toBe('credentials:streamLLM:start')
  })

  it('2. Window resize schema validates dimensions correctly', () => {
    expect(windowResizeSchema.safeParse({ width: 900, height: 600 }).success).toBe(true)
    expect(windowResizeSchema.safeParse({ width: -10, height: 600 }).success).toBe(false)
    expect(windowResizeSchema.safeParse({ width: '900', height: 600 }).success).toBe(false)
  })

  it('3. Desktop capture options schema accepts valid enum and string', () => {
    expect(desktopCaptureOptionsSchema.safeParse({ sourceType: 'screen' }).success).toBe(true)
    expect(desktopCaptureOptionsSchema.safeParse({ sourceType: 'window', sourceId: 'win:123' }).success).toBe(true)
    expect(desktopCaptureOptionsSchema.safeParse({ sourceType: 'invalid_type' }).success).toBe(false)
  })

  it('4. Session rename schema requires non-empty strings', () => {
    expect(sessionRenameSchema.safeParse({ sessionId: 's1', newTitle: 'New Title' }).success).toBe(true)
    expect(sessionRenameSchema.safeParse({ sessionId: '', newTitle: 'Title' }).success).toBe(false)
    expect(sessionRenameSchema.safeParse({ sessionId: 's1', newTitle: '' }).success).toBe(false)
  })

  it('5. Usage record schema validates token counts and cost status', () => {
    const valid = {
      id: 'rec_1',
      timestamp: Date.now(),
      provider: 'Google',
      model: 'gemini-4-argon',
      feature: 'copilot',
      inputTokens: 100,
      outputTokens: 50,
      costStatus: 'calculated',
      estimatedCostUsd: 0.0001,
    }
    expect(usageRecordSchema.safeParse(valid).success).toBe(true)

    const invalidStatus = { ...valid, costStatus: 'not_a_valid_status' }
    expect(usageRecordSchema.safeParse(invalidStatus).success).toBe(false)
  })

  it('6. API key save schema validates non-empty provider and key', () => {
    expect(apiKeySaveSchema.safeParse({ provider: 'openai', key: 'sk-123' }).success).toBe(true)
    expect(apiKeySaveSchema.safeParse({ provider: '', key: 'sk-123' }).success).toBe(false)
    expect(apiKeySaveSchema.safeParse({ provider: 'openai', key: '' }).success).toBe(false)
  })

  it('7. LLM stream start schema validates requestId and passthrough input', () => {
    const valid = {
      requestId: 'req_123',
      input: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
      },
    }
    expect(llmStreamStartSchema.safeParse(valid).success).toBe(true)
    expect(llmStreamStartSchema.safeParse({ requestId: '' }).success).toBe(false)
  })

  it('8. Whisper download progress validates percent range 0-100', () => {
    expect(whisperDownloadProgressSchema.safeParse({
      modelId: 'base',
      percent: 50,
      loadedMb: 70,
      totalMb: 140,
    }).success).toBe(true)

    expect(whisperDownloadProgressSchema.safeParse({
      modelId: 'base',
      percent: 150, // Out of range
      loadedMb: 70,
      totalMb: 140,
    }).success).toBe(false)
  })
})
