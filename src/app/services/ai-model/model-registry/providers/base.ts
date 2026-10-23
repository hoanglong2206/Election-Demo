import type { AIProvider, AIProviderId, DiscoveredModel, ModelCapability } from '../types'

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: AIProviderId
  abstract readonly displayName: string

  abstract listModels(apiKey?: string): Promise<DiscoveredModel[]>

  /**
   * Helper to derive standard model capabilities
   */
  protected detectCapabilities(
    _id: string,
    options?: {
      supportsVision?: boolean
      inputModalities?: string[]
      isReasoning?: boolean
      isCoding?: boolean
      isFast?: boolean
    }
  ): ModelCapability[] {
    const caps: Set<ModelCapability> = new Set(['text'])

    if (options?.supportsVision) {
      caps.add('vision')
    } else if (
      Array.isArray(options?.inputModalities) &&
      (options.inputModalities.includes('image') || options.inputModalities.includes('vision'))
    ) {
      caps.add('vision')
    }

    if (options?.isReasoning) {
      caps.add('reasoning')
    }
    if (options?.isCoding) {
      caps.add('code')
    }
    if (options?.isFast) {
      caps.add('fast')
    }

    return Array.from(caps)
  }

  /**
   * Safe fetch wrapper that guarantees API key is never logged upon error
   * and enforces an active timeout (10 seconds default) to prevent hanging.
   */
  protected async safeFetch(url: string, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController()
    let isTimedOut = false
    const timer = setTimeout(() => {
      isTimedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal || controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch (err: any) {
      clearTimeout(timer)
      const sanitizedUrl = url.replace(/([?&]key=)[^&]+/gi, '$1***')
      if (isTimedOut || err?.name === 'AbortError') {
        throw new Error(`[${this.displayName}] Quá thời gian chờ (timeout ${timeoutMs}ms) tới endpoint ${sanitizedUrl}`)
      }
      throw new Error(`[${this.displayName}] Lỗi kết nối mạng tới endpoint ${sanitizedUrl}`)
    }
  }
}
