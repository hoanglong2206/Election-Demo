// ── In-memory caches & In-flight promises to guarantee STRICTLY ONCE execution ─
export const cvAnalysisMemoryCache = new Map<string, string>()
export const cvAnalysisInFlight = new Map<string, Promise<string>>()

export const discussionAnalysisMemoryCache = new Map<string, string>()
export const discussionAnalysisInFlight = new Map<string, Promise<string>>()

/**
 * Fast deterministic hash for cache keys.
 */
export function computeCacheKey(prefix: string, content: string): string {
  let hash = 0
  const str = content.trim()
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`
}

/**
 * Retrieve cached CV background analysis without triggering any network call.
 */
export function getCachedCvAnalysis(cvText: string, jdText?: string): string | null {
  if (!cvText || !cvText.trim()) return null
  const key = computeCacheKey('cv', `${cvText.trim()}:::${(jdText || '').trim()}`)
  if (cvAnalysisMemoryCache.has(key)) {
    return cvAnalysisMemoryCache.get(key)!
  }
  try {
    const fromSession = sessionStorage.getItem(`bg_cache_${key}`)
    if (fromSession) {
      cvAnalysisMemoryCache.set(key, fromSession)
      return fromSession
    }
  } catch {}
  return null
}

/**
 * Retrieve cached Discussion background analysis without triggering any network call.
 */
export function getCachedDiscussionAnalysis(topicText: string): string | null {
  if (!topicText || !topicText.trim()) return null
  const key = computeCacheKey('disc', topicText.trim())
  if (discussionAnalysisMemoryCache.has(key)) {
    return discussionAnalysisMemoryCache.get(key)!
  }
  try {
    const fromSession = sessionStorage.getItem(`bg_cache_${key}`)
    if (fromSession) {
      discussionAnalysisMemoryCache.set(key, fromSession)
      return fromSession
    }
  } catch {}
  return null
}
