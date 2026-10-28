import { credentialsPort } from '@/infrastructure/ipc'

const apiKeyCache = new Map<string, { hasKey: boolean; timestamp: number }>()
const API_KEY_CACHE_TTL_MS = 60_000

export function invalidateApiKeyCache(provider?: string): void {
  if (provider) {
    const p = provider.toLowerCase()
    apiKeyCache.delete(p)
    if (p === 'google' || p === 'gemini') {
      apiKeyCache.delete('google')
      apiKeyCache.delete('gemini')
    }
  } else {
    apiKeyCache.clear()
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('credential-store:key-changed', (e: any) => {
    invalidateApiKeyCache(e?.detail?.provider)
  })
}

export async function checkCachedHasApiKey(provider: string): Promise<boolean> {
  const norm = provider.toLowerCase() === 'google' ? 'gemini' : provider.toLowerCase()
  const cached = apiKeyCache.get(norm)
  const now = Date.now()
  if (cached && now - cached.timestamp < API_KEY_CACHE_TTL_MS) {
    return cached.hasKey
  }
  if (credentialsPort.isSupported) {
    const hasKey = await credentialsPort.hasApiKey(norm)
    apiKeyCache.set(norm, { hasKey, timestamp: now })
    return hasKey
  }
  return false
}
