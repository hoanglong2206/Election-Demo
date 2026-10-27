/**
 * Backward compatibility wrapper for translateSTTText.
 *
 * Delegates to the resilient TranslationService (LRU cached, batched, rate-limited,
 * authenticated via OS Credential Store IPC / Universal LLM).
 *
 * Preserves exact function signature for any external callers.
 */

import { translationService } from '../translation'

export async function translateSTTText(text: string): Promise<string> {
  return translationService.translateDirect(text)
}
