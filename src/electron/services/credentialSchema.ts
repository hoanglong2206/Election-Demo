import { z } from 'zod'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CREDENTIAL SCHEMA & SECURITY HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Strict schema validation with Zod and secret masking / redaction helpers.
 */

export const CredentialProviderSchema = z
  .string()
  .transform((v) => v.toLowerCase().trim())
  .pipe(
    z.enum(['groq', 'openai', 'gemini', 'google', 'deepl', 'google_translate']).transform((val) => {
      if (val === 'google') return 'gemini' as const
      return val
    })
  )

export type CredentialProvider = z.infer<typeof CredentialProviderSchema>

export const SaveApiKeyInputSchema = z.object({
  provider: CredentialProviderSchema,
  key: z
    .string()
    .min(8, 'Khóa API phải có ít nhất 8 ký tự')
    .max(500, 'Khóa API không được vượt quá 500 ký tự')
    .trim(),
})

export type SaveApiKeyInput = z.infer<typeof SaveApiKeyInputSchema>

export const ProviderParamSchema = z.object({
  provider: CredentialProviderSchema,
})

export type ProviderParam = z.infer<typeof ProviderParamSchema>

export const CallLLMInputSchema = z.object({
  provider: CredentialProviderSchema.optional(),
  modelId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt không được để trống'),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
})

export type CallLLMInput = z.infer<typeof CallLLMInputSchema>

export const CallMultimodalLLMInputSchema = z.object({
  provider: CredentialProviderSchema.optional(),
  modelId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt không được để trống'),
  systemPrompt: z.string().optional(),
  imageBase64: z.string().optional(),
  imagePath: z.string().optional(),
  imageMediaUrl: z.string().optional(),
  mimeType: z.string().default('image/jpeg'),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
})

export type CallMultimodalLLMInput = z.infer<typeof CallMultimodalLLMInputSchema>

/**
 * Masks an API key for safe UI display (e.g. gsk_••••••••1234).
 * Never exposes the full raw key to the renderer process.
 */
export function maskApiKey(key: string, _provider?: string): string {
  if (!key || typeof key !== 'string') return ''
  const trimmed = key.trim()
  if (trimmed.length === 0) return ''

  if (trimmed.length <= 8) {
    return '••••••••'
  }

  // Provider specific prefix preservation
  if (trimmed.startsWith('gsk_')) {
    const last4 = trimmed.slice(-4)
    return `gsk_••••••••${last4}`
  }


  if (trimmed.startsWith('sk-')) {
    const last4 = trimmed.slice(-4)
    return `sk-••••••••${last4}`
  }

  if (trimmed.startsWith('AIza')) {
    const last4 = trimmed.slice(-4)
    return `AIza••••••••${last4}`
  }

  const first3 = trimmed.slice(0, 3)
  const last4 = trimmed.slice(-4)
  return `${first3}••••••••${last4}`
}

/**
 * Sanitizes and redacts any detected API key patterns from log / telemetry text
 * so secrets are never written into console, file logs, or error telemetry.
 */
export function sanitizeLogMessage(message: unknown): string {
  if (message === null || message === undefined) return ''
  const text = typeof message === 'string' ? message : String(message)

  return text
    .replace(/gsk_[a-zA-Z0-9_-]{16,}/g, (match) => `gsk_••••••••${match.slice(-4)}`)
    .replace(/sk-[a-zA-Z0-9_-]{16,}/g, (match) => `sk-••••••••${match.slice(-4)}`)
    .replace(/AIza[a-zA-Z0-9_-]{16,}/g, (match) => `AIza••••••••${match.slice(-4)}`)
    .replace(/Bearer\s+[a-zA-Z0-9_.-]{16,}/gi, 'Bearer [REDACTED_TOKEN]')
}
