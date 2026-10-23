import { callUniversalLLM } from './copilot/universalLlm'

/**
 * Translates a text from English to Vietnamese using the available LLM.
 * Falls back to returning the original text if the LLM is unavailable.
 */
export async function translateToVietnamese(text: string): Promise<string | null> {
  if (!text.trim()) return text

  const prompt = `Translate the following English text to Vietnamese. 
Output ONLY the translated Vietnamese text — no introduction, no explanation, no quotation marks around the output.

TEXT TO TRANSLATE:
${text}`

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 800,
    temperature: 0.1,
    systemPrompt:
      'You are a professional translator. Translate accurately from English to Vietnamese. Output ONLY the translated text with no preamble or explanation.',
  })

  if (!rawRes || !rawRes.text.trim()) return null
  return rawRes.text.trim()
}

/**
 * Translates a text from Vietnamese to English using the available LLM.
 * Falls back to returning the original text if the LLM is unavailable.
 */
export async function translateToEnglish(text: string): Promise<string | null> {
  if (!text.trim()) return text

  const prompt = `Translate the following Vietnamese text to English. 
Output ONLY the translated English text — no introduction, no explanation, no quotation marks around the output.

TEXT TO TRANSLATE:
${text}`

  const rawRes = await callUniversalLLM(prompt, {
    maxTokens: 800,
    temperature: 0.1,
    systemPrompt:
      'You are a professional translator. Translate accurately from Vietnamese to English. Output ONLY the translated text with no preamble or explanation.',
  })

  if (!rawRes || !rawRes.text.trim()) return null
  return rawRes.text.trim()
}
