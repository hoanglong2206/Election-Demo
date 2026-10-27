/**
 * Whisper Silence Hallucination & Artifact Filter
 * Detects and suppresses classic Whisper hallucinations on silence / background noise,
 * including repeated n-gram loops, YouTube closing artifacts, and bracket tags.
 */

const KNOWN_SILENCE_HALLUCINATIONS = [
  // English common YouTube / subtitle training corpus artifacts
  /^thanks for watching[.!?,]?$/i,
  /^thank you for watching[.!?,]?$/i,
  /^thank you very much[.!?,]?$/i,
  /^thank you[.!?,]?$/i,
  /^(?:please\s+)?(?:like\s+and\s+)?subscribe(?:\s+to\s+my\s+channel)?[.!?,]?$/i,
  /^please subscribe[.!?,]?$/i,
  /^like and subscribe[.!?,]?$/i,
  /^subscribe to my channel[.!?,]?$/i,
  /^subtitles by[.!?,]?/i,
  /^translated by[.!?,]?/i,
  /^see you in the next video[.!?,]?$/i,
  /^bye bye[.!?,]?$/i,
  /^you're welcome[.!?,]?$/i,
  /^goodbye[.!?,]?$/i,

  // Vietnamese training corpus artifacts
  /^cảm ơn các bạn đã theo dõi[.!?,]?$/i,
  /^cảm ơn các bạn đã xem[.!?,]?$/i,
  /^cảm ơn đã xem[.!?,]?$/i,
  /^cảm ơn rất nhiều[.!?,]?$/i,
  /^cảm ơn[.!?,]?$/i,
  /^hẹn gặp lại các bạn[.!?,]?$/i,
  /^hẹn gặp lại trong các video tiếp theo[.!?,]?$/i,
  /^hãy like và subscribe[.!?,]?$/i,
  /^phụ đề bởi[.!?,]?/i,
  /^chúc các bạn một ngày tốt lành[.!?,]?$/i,
]

const NON_SPEECH_TAG_REGEX = /\[(?:blank_audio|music|applause|laughter|silence|pause|cough|sigh)\]|\((?:music|applause|laughter|silence)\)/gi

/**
 * Checks if a string consists of an n-gram phrase (1-4 words) repeated >= 3 times.
 * e.g. "you you you you", "tôi nghĩ là tôi nghĩ là tôi nghĩ là"
 */
export function hasRepetitiveLoop(text: string): boolean {
  const words = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length < 3) return false

  // Check n-gram loop where n in [1, 2, 3, 4]
  for (let n = 1; n <= Math.min(4, Math.floor(words.length / 3)); n++) {
    if (words.length % n === 0) {
      const pattern = words.slice(0, n).join(' ')
      let isLoop = true
      for (let i = 0; i < words.length; i += n) {
        if (words.slice(i, i + n).join(' ') !== pattern) {
          isLoop = false
          break
        }
      }
      if (isLoop) return true
    }
  }

  return false
}

/**
 * Checks if the text matches any known hallucination patterns.
 */
export function isHallucination(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true

  // Strip non-speech tags first
  const withoutTags = trimmed.replace(NON_SPEECH_TAG_REGEX, '').trim()
  if (!withoutTags) return true

  // Check known hallucination phrases
  for (const pattern of KNOWN_SILENCE_HALLUCINATIONS) {
    if (pattern.test(withoutTags)) {
      return true
    }
  }

  // Check repetitive loops
  if (hasRepetitiveLoop(withoutTags)) {
    return true
  }

  return false
}

/**
 * Cleans Whisper raw output text by stripping audio tags and suppressing hallucinations.
 * Returns empty string if the content is identified as hallucination or silence.
 */
export function cleanWhisperOutput(rawText: string): { text: string; isHallucination: boolean } {
  if (!rawText || !rawText.trim()) {
    return { text: '', isHallucination: false }
  }

  const strippedTags = rawText
    .replace(NON_SPEECH_TAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!strippedTags) {
    return { text: '', isHallucination: false }
  }

  if (isHallucination(strippedTags)) {
    return { text: '', isHallucination: true }
  }

  return { text: strippedTags, isHallucination: false }
}

export const isSilenceHallucination = isHallucination
export const isRepetitiveLoop = hasRepetitiveLoop
export function cleanSilenceHallucination(text: string): string {
  return cleanWhisperOutput(text).text
}
