export type VerifyState = 'idle' | 'checking' | 'valid' | 'invalid'

export type { LLMProviderOption } from '@/services/settings'

export const PROVIDER_NAMES: Record<string, string> = {
  Auto: 'Tự nhận diện',
  Google: 'Google Gemini',
  OpenAI: 'ChatGPT (OpenAI API)',
  Unknown: 'Không xác định',
}
