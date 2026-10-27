import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../common/ipc/channels.js'
import { getElectronCredentialStore } from '../../services/credentials/index.js'
import { getElectronLlmService } from '../../services/llm/index.js'

export function registerCredentialHandlers(): void {
  const credentialStore = getElectronCredentialStore()
  const llmService = getElectronLlmService()

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.IS_AVAILABLE, () => {
    return credentialStore.isAvailable()
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.SAVE_API_KEY, (_event, payload: { provider: string; key: string }) => {
    return credentialStore.saveApiKey(payload.provider, payload.key)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.DELETE_API_KEY, (_event, payload: { provider: string }) => {
    return credentialStore.deleteApiKey(payload.provider)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.HAS_API_KEY, (_event, payload: { provider: string }) => {
    return credentialStore.hasApiKey(payload.provider)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.GET_STATUS, (_event, payload: { provider: string }) => {
    return credentialStore.getStatus(payload.provider)
  })

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.GET_ALL_STATUSES, () => {
    return credentialStore.getAllStatuses()
  })

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS.VERIFY_API_KEY,
    async (_event, payload: { provider: string; rawKey?: string }) => {
      return llmService.verifyApiKey(payload.provider, payload.rawKey)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS.TEST_MODEL_AVAILABILITY,
    async (_event, payload: { provider: string; rawKey: string; modelId: string }) =>
      llmService.testModelAvailability(payload.provider, payload.rawKey, payload.modelId)
  )

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS.TRANSCRIBE_GROQ,
    async (
      _event,
      payload: { audioBase64: string; modelId?: string; language?: string; prompt?: string }
    ) => {
      return llmService.transcribeGroq(
        payload.audioBase64,
        payload.modelId,
        payload.language,
        payload.prompt
      )
    }
  )

  ipcMain.handle(IPC_CHANNELS.CREDENTIALS.SYNC_MODELS, async () => {
    return llmService.syncModels()
  })

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS.TRANSLATE_TEXT,
    async (
      _event,
      payload: {
        texts: string[]
        sourceLang?: string
        targetLang?: string
        provider?: 'google_translate' | 'deepl'
      }
    ) => {
      return llmService.translateText(payload)
    }
  )
}
