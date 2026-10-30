/**
 * Convert Blob to Base64 string (stripping data URL prefix if present).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof Buffer !== 'undefined') {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer).toString('base64')
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const res = reader.result as string
        const clean = res ? res.replace(/^data:[^;]+;base64,/, '').trim() : ''
        resolve(clean)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to Blob.
 */
export function base64ToBlob(base64: string, mime = 'audio/wav'): Blob {
  const cleanBase64 = (base64 || '').replace(/^data:[^;]+;base64,/, '').trim()
  const byteChars = atob(cleanBase64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mime })
}

/**
 * Generate a synthetic 1.5-second 16kHz speech-like test audio WAV blob
 * for testing whisper-cli.exe and cloud STT engines without microphone input.
 */
export function generateTestSpeechWavBlob(): Blob {
  const sampleRate = 16000
  const durationSec = 1.5
  const samples = Math.floor(sampleRate * durationSec)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples * 2, true)

  let offset = 44
  // Speech formant frequency simulation (vowel-like harmonic)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const envelope = Math.sin(Math.PI * (i / samples)) // Bell envelope
    const f1 = Math.sin(2 * Math.PI * 300 * t)
    const f2 = Math.sin(2 * Math.PI * 800 * t) * 0.6
    const f3 = Math.sin(2 * Math.PI * 2200 * t) * 0.3
    const wave = (f1 + f2 + f3) * envelope * 0.4
    const intVal = Math.max(-32768, Math.min(32767, Math.round(wave * 32767)))
    view.setInt16(offset, intVal, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
