import type { LLMProviderOption } from '../types'

/**
 * Validates the prefix format of an API key for standard providers.
 */
export function validateProviderKeyFormat(
  provider: string,
  key: string
): { valid: boolean; reason?: string } {
  const trimmed = key.trim()
  if (!trimmed) {
    return { valid: false, reason: 'Khóa API không được để trống' }
  }

  const p = provider.toLowerCase()
  if (p === 'openai' && !trimmed.startsWith('sk-')) {
    return {
      valid: false,
      reason: 'Khóa OpenAI hợp lệ phải bắt đầu bằng "sk-"',
    }
  }

  if (p === 'gemini' && !trimmed.startsWith('AIza')) {
    return {
      valid: false,
      reason: 'Khóa Google Gemini hợp lệ phải bắt đầu bằng "AIza"',
    }
  }

  if (p === 'groq' && !trimmed.startsWith('gsk_')) {
    return {
      valid: false,
      reason: 'Khóa Groq hợp lệ phải bắt đầu bằng "gsk_"',
    }
  }

  return { valid: true }
}

/**
 * Safely masks an API key, showing only the first 3 and last 4 characters.
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) {
    return '••••••••'
  }
  const start = trimmed.slice(0, 3)
  const end = trimmed.slice(-4)
  return `${start}••••••••${end}`
}

/**
 * Determines target provider for generic LLM input.
 */
export function resolveTargetLlmProvider(
  inputKey: string,
  selectedProvider: LLMProviderOption
): string {
  const trimmed = inputKey.trim()
  if (trimmed.startsWith('sk-')) return 'openai'
  if (trimmed.startsWith('AIza')) return 'gemini'
  if (selectedProvider !== 'Auto') return selectedProvider.toLowerCase()
  return 'gemini'
}

/**
 * Formats token count or context window into human-readable string.
 */
export function formatTokenCount(raw: string | number | undefined | null): string {
  if (!raw) return '128k tokens'
  const str = String(raw).trim()
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1).replace('.0', '')}M tokens`
    }
    if (num >= 1024) {
      return `${Math.round(num / 1024)}k tokens`
    }
    return `${num} tokens`
  }
  return str
}

