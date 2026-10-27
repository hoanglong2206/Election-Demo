import {
  ElectronCredentialStore as PureCredentialStore,
} from './credentials/credentialStore.js'
import { getElectronLlmService } from './llm/llmService.js'
import type { CallLLMInput, CallMultimodalLLMInput } from './credentials/credentialSchema.js'

export * from './credentials/credentialStore.js'
export * from './credentials/credentialSchema.js'

/**
 * Backward compatibility facade:
 * Combines pure credential store with delegated LLM methods
 * so older tests and callers continue working without disruption.
 */
export class ElectronCredentialStore extends PureCredentialStore {
  public async callLLM(input: CallLLMInput) {
    return getElectronLlmService().callLLM(input)
  }

  public async streamLLM(
    input: CallLLMInput,
    callbacks: any,
    signal?: AbortSignal
  ) {
    return getElectronLlmService().streamLLM(input, callbacks, signal)
  }

  public async callMultimodalLLM(input: CallMultimodalLLMInput) {
    return getElectronLlmService().callMultimodalLLM(input)
  }

  public async verifyApiKey(rawProvider: string, rawKey?: string) {
    return getElectronLlmService().verifyApiKey(rawProvider, rawKey)
  }

  public async testModelAvailability(rawProvider: string, rawKey: string, modelId: string) {
    return getElectronLlmService().testModelAvailability(rawProvider, rawKey, modelId)
  }

  public async syncModels() {
    return getElectronLlmService().syncModels()
  }

  public async transcribeGroq(
    audioBase64: string,
    modelId?: string,
    language?: string,
    prompt?: string
  ) {
    return getElectronLlmService().transcribeGroq(audioBase64, modelId, language, prompt)
  }

  public async translateText(params: any) {
    return getElectronLlmService().translateText(params)
  }

  public isSTTModel(m: any) {
    return getElectronLlmService().isSTTModel(m)
  }

  public formatSTTModel(m: any, provider?: string) {
    return getElectronLlmService().formatSTTModel(m, provider)
  }
}

let legacyInstance: ElectronCredentialStore | null = null

export function getElectronCredentialStore(): ElectronCredentialStore {
  if (!legacyInstance) {
    legacyInstance = new ElectronCredentialStore()
  }
  return legacyInstance
}
