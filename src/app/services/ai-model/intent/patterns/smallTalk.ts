/**
 * Common parenthetical/bracketed audio annotations from STT engines like Whisper
 */
export const AUDIO_TAGS_REGEX =
  /\((?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\)|\[(?:laughing|laughter|cười|music|applause|cheering|coughing|sighs?|gasp|chuckle|whisper|silence|throat clearing)\]/gi

/**
 * Leading filler words, conversational openers, or symbols
 */
export const LEADING_FILLER_REGEX =
  /^(?:[\s\-_–—•*~,.;:!?()\[\]"']|so|well|okay|ok|hey|hi|hello|um|uh|yeah|yes|no|now|and|or|but|please|by the way|anyway|à|ừ|ừm|vâng|dạ|thế|vậy|cho hỏi|em cho anh hỏi|anh cho em hỏi|nhân tiện|ủa)+\s*[,:;-]*\s*/i

/**
 * Pure small-talk phrases in English and Vietnamese that should NEVER trigger LLM Copilot.
 */
export const SMALL_TALK_TOKENS = new Set([
  'ok', 'okay', 'k', 'oke', 'oki', 'okie', 'alright', 'all right', 'i see', 'right',
  'yeah', 'yep', 'yes', 'nope', 'no', 'sure', 'cool', 'fine', 'great', 'awesome', 'perfect',
  'nice', 'good', 'thank you', 'thanks', 'thanks a lot', 'thank you very much', 'got it',
  'understood', 'sounds good', 'makes sense', 'no problem', 'youre welcome', 'you\'re welcome',
  'welcome', 'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'bye',
  'goodbye', 'see you', 'take care', 'vâng', 'dạ', 'dạ vâng', 'vâng ạ', 'ừ', 'ừm', 'ờ',
  'dạ được', 'được rồi', 'rõ rồi', 'hiểu rồi', 'chuẩn rồi', 'chính xác', 'đúng rồi', 'cảm ơn',
  'cảm ơn bạn', 'cảm ơn anh', 'cảm ơn chị', 'cảm ơn em', 'cảm ơn nhiều', 'cảm ơn nhé',
  'xin cảm ơn', 'chào bạn', 'xin chào', 'tạm biệt', 'hẹn gặp lại', 'vậy thôi', 'thế thôi',
  'không có chi', 'không sao', 'ok anh', 'ok em', 'dạ vâng ạ', 'được rồi ạ', 'rõ rồi ạ',
  'dạ được rồi ạ', 'dạ rõ rồi ạ', 'vâng được rồi ạ', 'dạ cảm ơn ạ', 'vâng cảm ơn ạ',
  'dạ vâng cảm ơn', 'rồi ạ', 'xong rồi ạ', 'xong rồi', 'được ạ', 'dạ được ạ'
])

export function cleanUtterance(text: string): string {
  if (!text) return ''
  return text.replace(AUDIO_TAGS_REGEX, ' ').replace(/\s+/g, ' ').trim()
}

export function stripLeadingFillers(text: string): string {
  let cleaned = text.trim()
  let prev = ''
  while (cleaned !== prev) {
    prev = cleaned
    cleaned = cleaned.replace(LEADING_FILLER_REGEX, '').trim()
  }
  return cleaned
}

export function isSmallTalkUtterance(cleaned: string): boolean {
  if (!cleaned) return false
  // Never treat text with explicit question mark as pure small talk
  if (/[?？]/.test(cleaned)) return false

  const normalized = cleaned
    .toLowerCase()
    .replace(/[.,!?;:…\-_'"()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return false
  if (SMALL_TALK_TOKENS.has(normalized)) return true

  // Strip polite particles and check core
  let core = normalized
  // Strip trailing particles: ạ, nhé, nha, nghen, bạn, anh, chị, em, nhiều
  core = core.replace(/\s+(?:ạ|nhé|nha|nghen|nhá|bạn|anh|chị|em|nhiều|nữa)$/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  // Strip leading openers: dạ, vâng, ừ, ừm, ok, okay, right
  core = core.replace(/^(?:dạ|vâng|ừ|ừm|ok|okay|right|yeah|yes)\s+/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  // Re-check trailing after leading strip (e.g. "dạ được rồi ạ" -> "được rồi")
  core = core.replace(/\s+(?:ạ|nhé|nha|nghen|nhá|bạn|anh|chị|em|nhiều)$/, '').trim()
  if (SMALL_TALK_TOKENS.has(core)) return true

  return false
}
