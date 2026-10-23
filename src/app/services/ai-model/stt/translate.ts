import { settingsManager } from '../../settings'

/**
 * Fast bilingual helper: translate English transcript into natural Vietnamese.
 * Uses Google Translate gtx endpoint (80ms zero-latency, no key required) with Groq LLM fallback.
 */
export async function translateSTTText(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  // If text is already in Vietnamese (contains accented characters), return clean text
  const isVietnamese =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      trimmed
    )
  if (isVietnamese) {
    return trimmed
  }

  // 1. Ultra-fast Google Translate (Free, ~80ms response, natural Vietnamese)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(
      trimmed
    )}`
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.[0])) {
        const translated = data[0]
          .map((item: unknown) => (Array.isArray(item) ? item[0] : ''))
          .filter(Boolean)
          .join('')
          .trim()
        if (translated) return translated
      }
    }
  } catch (err) {
    console.warn('[translateSTTText] Fast GT API timeout/failed, trying LLM fallback:', err)
  }

  // 2. Fast translation via Groq LLM if key is present
  try {
    const groqKey = String(settingsManager.get('groqKey') || '').trim()
    if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are a real-time subtitle translator. Translate English into concise Vietnamese for video subtitles. Output ONLY the translation.',
            },
            { role: 'user', content: trimmed },
          ],
          temperature: 0.1,
          max_tokens: 120,
        }),
        signal: AbortSignal.timeout(2000),
      })

      if (res.ok) {
        const data = await res.json()
        const vi = data.choices?.[0]?.message?.content?.trim()
        if (vi) return vi
      }
    }
  } catch {
    // Fallback if offline
  }

  return trimmed
}
