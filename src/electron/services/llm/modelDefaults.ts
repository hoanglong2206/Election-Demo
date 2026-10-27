/**
 * Single source of truth for validated default model IDs.
 * Aligned with current provider documentation:
 * - Groq: 'llama-3.3-70b-versatile' (Active production model for fast inference)
 * - Gemini: 'gemini-2.0-flash' (Current Google Gemini Flash model, high performance)
 * - OpenAI: 'gpt-4o-mini' (Current production cost-effective chat model)
 */
export const DEFAULT_PROVIDER_MODELS = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
} as const

export type SupportedProviderKey = keyof typeof DEFAULT_PROVIDER_MODELS

export const DEPRECATED_OR_INVALID_MODELS = new Set<string>([
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'gemini-1.0-pro',
  'gemini-pro',
  'gpt-3.5-turbo-0613',
])

export function getValidatedModelId(provider: string, requestedModelId?: string): string {
  const normProvider = provider.toLowerCase().trim()
  const defaultModel =
    normProvider === 'gemini' || normProvider === 'google'
      ? DEFAULT_PROVIDER_MODELS.gemini
      : normProvider === 'openai'
      ? DEFAULT_PROVIDER_MODELS.openai
      : DEFAULT_PROVIDER_MODELS.groq

  if (!requestedModelId || typeof requestedModelId !== 'string') {
    return defaultModel
  }

  const clean = requestedModelId.trim().replace(/^models\//, '')
  if (!clean || DEPRECATED_OR_INVALID_MODELS.has(clean)) {
    return defaultModel
  }

  return clean
}
