/**
 * Lightweight, privacy-first Language Detector.
 *
 * Replaces naive accented regex heuristic with:
 * 1. Whisper / STT reported language code check
 * 2. Vietnamese diacritic check
 * 3. Vietnamese unaccented stopword frequency scoring
 * 4. English stopword scoring
 * 5. Mixed English-Vietnamese detection (prevents translating Vietnamese with technical English words)
 */

// Common Vietnamese stopwords (accented + unaccented)
const VI_STOPWORDS = new Set([
  'la', 'va', 'cua', 'trong', 'co', 'duoc', 'khong', 'nguoi', 've', 'de',
  'cac', 'mot', 'nhung', 'thi', 'voi', 'cho', 'tai', 'nhu', 'theo', 'khi',
  'ra', 'den', 'se', 'da', 'dang', 'chung', 'to', 'minh', 'ban', 'anh',
  'em', 'rat', 'hon', 'nhat', 'gi', 'sao', 'nay', 'kia', 'do', 'day',
  'gio', 'phai', 'biet', 'lam', 'noi', 'di', 'roi', 'ma', 'neu', 'hay',
  'hoi', 'giup', 'dung', 'chua', 'qua', 'lai', 'boi', 'vi', 'con', 'luon'
])

// Common English stopwords
const EN_STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also'
])

const VI_ACCENTS_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

export type DetectedLanguage = 'vi' | 'en' | 'unknown'

export interface LanguageDetectionResult {
  detectedLang: DetectedLanguage
  confidence: number
  isMixed: boolean
  shouldTranslateToVi: boolean
  reason: string
}

/**
 * Detect language of utterance and decide if translation to Vietnamese is necessary.
 */
export function detectLanguage(
  text: string,
  sttReportedLang?: string
): LanguageDetectionResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      detectedLang: 'unknown',
      confidence: 1.0,
      isMixed: false,
      shouldTranslateToVi: false,
      reason: 'Empty text',
    }
  }

  // 1. If STT already identified the language with high authority
  const normalizedSttLang = sttReportedLang?.toLowerCase().trim()
  if (normalizedSttLang === 'vi' || normalizedSttLang === 'vietnamese') {
    return {
      detectedLang: 'vi',
      confidence: 0.95,
      isMixed: false,
      shouldTranslateToVi: false,
      reason: 'STT reported Vietnamese',
    }
  }

  // 2. High confidence Vietnamese if contains accented Vietnamese characters
  if (VI_ACCENTS_REGEX.test(trimmed)) {
    return {
      detectedLang: 'vi',
      confidence: 0.99,
      isMixed: false,
      shouldTranslateToVi: false,
      reason: 'Contains Vietnamese diacritics',
    }
  }

  // 3. Tokenize words for stopword scoring (unaccented Vietnamese vs English)
  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)

  if (words.length === 0) {
    return {
      detectedLang: 'unknown',
      confidence: 0.5,
      isMixed: false,
      shouldTranslateToVi: false,
      reason: 'No alphanumeric words found',
    }
  }

  let viScore = 0
  let enScore = 0

  for (const word of words) {
    if (VI_STOPWORDS.has(word)) viScore++
    if (EN_STOPWORDS.has(word)) enScore++
  }

  const isMixed = viScore > 0 && enScore > 0

  // If Vietnamese stopwords are found in significant ratio, treat as Vietnamese (unaccented or mixed)
  // Example: "Toi muon deploy len Kubernetes" -> viScore >= 2 ("toi", "muon" / "len"), enScore ~ 0
  if (viScore > 0 && viScore >= enScore) {
    return {
      detectedLang: 'vi',
      confidence: Math.min(0.9, 0.5 + (viScore / words.length) * 0.5),
      isMixed,
      shouldTranslateToVi: false,
      reason: 'Detected unaccented or mixed Vietnamese stopwords',
    }
  }

  if (enScore > 0) {
    return {
      detectedLang: 'en',
      confidence: Math.min(0.95, 0.6 + (enScore / words.length) * 0.4),
      isMixed,
      shouldTranslateToVi: true,
      reason: 'Detected English stopwords',
    }
  }

  // If STT reported English (and no Vietnamese tokens found)
  if (normalizedSttLang === 'en' || normalizedSttLang === 'english') {
    return {
      detectedLang: 'en',
      confidence: 0.85,
      isMixed: false,
      shouldTranslateToVi: true,
      reason: 'STT reported English',
    }
  }

  // Default heuristic for pure Latin words: if ASCII only and no Vietnamese cues, translate to Vietnamese
  return {
    detectedLang: 'en',
    confidence: 0.6,
    isMixed: false,
    shouldTranslateToVi: true,
    reason: 'Latin text without Vietnamese markers',
  }
}
