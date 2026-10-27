import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../common/ipc/channels.js'
import { getElectronLlmService } from '../../services/llm'

interface ActiveLLMStreamInfo {
  requestId: string
  senderId: number
  controller: AbortController
  createdAt: number
}

export function registerLlmHandlers(): void {
  const llmService = getElectronLlmService()
  const activeLLMStreams = new Map<string, ActiveLLMStreamInfo>()
  const trackedSenderLifecycles = new Set<number>()
  const MAX_CONCURRENT_PER_SENDER = 4

  function attachSenderLifecycle(sender: Electron.WebContents) {
    if (trackedSenderLifecycles.has(sender.id)) return
    trackedSenderLifecycles.add(sender.id)

    const cleanupSenderStreams = () => {
      for (const [reqId, entry] of activeLLMStreams.entries()) {
        if (entry.senderId === sender.id) {
          entry.controller.abort()
          activeLLMStreams.delete(reqId)
        }
      }
      trackedSenderLifecycles.delete(sender.id)
    }

    sender.once('destroyed', cleanupSenderStreams)
    sender.on('did-start-navigation', (_ev, _url, isInPlace) => {
      if (!isInPlace) {
        cleanupSenderStreams()
      }
    })
  }

  ipcMain.handle(IPC_CHANNELS.LLM.CALL, async (_event, payload: any) => {
    return llmService.callLLM(payload)
  })

  ipcMain.on(
    IPC_CHANNELS.LLM.STREAM_START,
    async (
      event,
      payload: { requestId: string; input: any }
    ) => {
      const { requestId, input } = payload
      if (!requestId) return

      attachSenderLifecycle(event.sender)

      // Cancel previous controller with same requestId if any exists
      const existing = activeLLMStreams.get(requestId)
      if (existing) {
        existing.controller.abort()
        activeLLMStreams.delete(requestId)
      }

      // Enforce concurrency limit per sender
      const senderStreams = Array.from(activeLLMStreams.values()).filter(
        (s) => s.senderId === event.sender.id
      )
      if (senderStreams.length >= MAX_CONCURRENT_PER_SENDER) {
        const oldest = senderStreams.sort((a, b) => a.createdAt - b.createdAt)[0]
        oldest.controller.abort()
        activeLLMStreams.delete(oldest.requestId)
      }

      const controller = new AbortController()
      activeLLMStreams.set(requestId, {
        requestId,
        senderId: event.sender.id,
        controller,
        createdAt: Date.now(),
      })

      llmService.streamLLM(
        input,
        {
          onFirstToken: (data) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.LLM.STREAM_FIRST_TOKEN, { requestId, ...data })
            }
          },
          onDelta: (data) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.LLM.STREAM_DELTA, { requestId, ...data })
            }
          },
          onDone: (data) => {
            activeLLMStreams.delete(requestId)
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.LLM.STREAM_DONE, { requestId, ...data })
            }
          },
          onError: (data) => {
            activeLLMStreams.delete(requestId)
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.LLM.STREAM_ERROR, { requestId, ...data })
            }
          },
        },
        controller.signal
      )
    }
  )

  ipcMain.on(IPC_CHANNELS.LLM.STREAM_CANCEL, (event, payload: { requestId: string }) => {
    if (!payload?.requestId) return
    const entry = activeLLMStreams.get(payload.requestId)
    // Validate that the cancelling sender owns this stream requestId
    if (entry && entry.senderId === event.sender.id) {
      entry.controller.abort()
      activeLLMStreams.delete(payload.requestId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.LLM.CALL_MULTIMODAL, async (_event, payload: any) => {
    return llmService.callMultimodalLLM(payload)
  })
}
