/**
 * Format provider badge label for display
 */
export function getProviderBadgeLabel(provider?: string, modelId?: string): string {
  if (!provider) return 'AI Copilot'
  if (provider === 'Groq') {
    return modelId?.includes('70b') ? 'Groq LPU (Llama 3.3 70B)' : 'Groq LPU (Llama 3.1)'
  }
  if (provider === 'Google') {
    return modelId?.includes('pro') ? 'Google Gemini 1.5 Pro' : 'Google Gemini 1.5 Flash'
  }
  if (provider === 'OpenAI') {
    return modelId?.includes('gpt-4o-mini')
      ? 'OpenAI GPT-4o Mini'
      : modelId?.includes('gpt-4o')
      ? 'OpenAI GPT-4o'
      : 'OpenAI GPT'
  }
  return `${provider}`
}
