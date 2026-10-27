import { getAvailableSTTEngines, getSavedSTTEngineId } from '../aiModels'
import type { TranscribeResult } from './types'
import { base64ToBlob, blobToBase64 } from './audioUtils'
import { usageTrackerService } from '../../usage-tracker'

/**
 * Estimate audio duration in seconds based on 16kHz 16-bit mono PCM bytes.
 */
/**
 * Estimate audio duration in seconds based on 16kHz 16-bit mono PCM bytes.
 */
function estimateAudioDurationSeconds(
  audioData: string | Blob | ArrayBuffer | ArrayBufferView
): number {
  try {
    let byteLength = 0
    if (typeof audioData === 'string') {
      const clean = audioData.replace(/^data:[^;]+;base64,/, '').trim()
      byteLength = Math.floor((clean.length * 3) / 4)
    } else if (audioData instanceof Blob) {
      byteLength = audioData.size
    } else if (audioData instanceof ArrayBuffer) {
      byteLength = audioData.byteLength
    } else if (ArrayBuffer.isView(audioData)) {
      byteLength = audioData.byteLength
    }
    // 16kHz, 16-bit mono = 32000 bytes/sec
    const pcmBytes = Math.max(0, byteLength - 44)
    const duration = pcmBytes / 32000
    return Math.max(0.1, Math.round(duration * 10) / 10)
  } catch {
    return 0
  }
}

/**
 * Transcribe audio using the chosen STT Engine:
 * - Local Whisper (ggml-base.bin, ggml-tiny.bin) via persistent whisper-server / whisper-cli fallback
 * - Groq Whisper (whisper-large-v3-turbo, whisper-large-v3) via Groq Cloud LPU
 */
export async function transcribeAudio(
  audioData: string | Blob | ArrayBuffer | Uint8Array | Float32Array | Int16Array,
  customEngineId?: string,
  language = 'auto',
  prompt?: string,
  sessionId?: string
): Promise<TranscribeResult> {
  const engineId = customEngineId || getSavedSTTEngineId()
  const available = getAvailableSTTEngines()
  const engine = available.find((e) => e.id === engineId) || available[0]
  const startTime = performance.now()
  const durationSec = estimateAudioDurationSeconds(audioData)

  // ── 1. LOCAL WHISPER C++ ENGINE ──────────────────────────────────────────
  if (engine?.provider === 'Local') {
    if (window.api?.nativeWhisper) {
      // Pass ArrayBuffer directly across IPC to avoid base64 serialization overhead and disk I/O
      let rawData: any = audioData
      if (audioData instanceof Blob) {
        rawData = await audioData.arrayBuffer()
      }

      const res = await window.api.nativeWhisper.transcribe(rawData, {
        modelId: engineId,
        language: language || 'auto',
        prompt,
      })

      // Track usage (Local is always $0 free)
      try {
        usageTrackerService.trackUsage({
          sessionId,
          provider: 'Local',
          model: engineId,
          feature: 'stt',
          audioDurationSeconds: durationSec,
        })
      } catch {}

      const elapsed = Math.round(performance.now() - startTime)
      const cleanText = (res.text || '')
        .replace(/\[BLANK_AUDIO\]/gi, '')
        .replace(/\[MUSIC\]/gi, '')
        .replace(/\(music\)/gi, '')
        .replace(/\[pause\]/gi, '')
        .trim()

      // Translation is handled asynchronously by TranslationService on transcript commit
      const translatedVi = ''

      return {
        success: res.success && Boolean(cleanText),
        text: cleanText,
        translatedVi,
        latencyMs: res.latencyMs || elapsed,
        inferenceMs: res.inferenceMs || res.latencyMs || elapsed,
        queueWaitMs: res.queueWaitMs,
        totalMs: res.totalMs,
        mode: res.mode,
        engineId,
        engineName: engine.name,
        provider: 'Local',
        isNative: res.isNative,
        confidence: engineId.includes('base') ? 99 : 97,
        error: res.error,
      }
    } else {
      const elapsed = Math.round(performance.now() - startTime)
      return {
        success: false,
        text: 'Native Whisper API chỉ khả dụng khi chạy trên ứng dụng Desktop Electron.',
        translatedVi: 'Chưa thể kết nối Native C++ Whisper.',
        latencyMs: elapsed,
        engineId,
        engineName: engine?.name || engineId,
        provider: 'Local',
        confidence: 0,
        error: 'API Desktop unavailable',
      }
    }
  }

  // ── 2. GROQ WHISPER CLOUD LPU ENGINE ──────────────────────────────────────
  if (engine?.provider === 'Groq') {
    // High security path: Transcribe via Electron Main Process (no plaintext key in renderer!)
    if (typeof window !== 'undefined' && window.api?.credentials?.transcribeGroq) {
      try {
        let blob: Blob
        if (audioData instanceof Blob) {
          blob = audioData
        } else if (typeof audioData === 'string') {
          blob = base64ToBlob(audioData)
        } else {
          blob = new Blob([audioData as any], { type: 'audio/wav' })
        }
        const audioBase64 = typeof audioData === 'string' ? audioData : await blobToBase64(blob)
        const res = await window.api.credentials.transcribeGroq(audioBase64, engineId, language, prompt)
        if (res && res.text) {
          try {
            usageTrackerService.trackUsage({
              sessionId,
              provider: 'Groq',
              model: engineId,
              feature: 'stt',
              audioDurationSeconds: durationSec,
            })
          } catch {}

          const cleanText = res.text.trim()
          // Translation is handled asynchronously by TranslationService on transcript commit
          const translatedVi = ''
          return {
            success: Boolean(cleanText),
            text: cleanText,
            translatedVi,
            latencyMs: res.latencyMs || Math.round(performance.now() - startTime),
            engineId,
            engineName: engine.name,
            provider: 'Groq',
            confidence: 98,
          }
        }
      } catch (err: any) {
        console.warn('[transcribe] Secure Groq STT via Main process error:', err)
        return {
          success: false,
          text: '',
          translatedVi: '',
          latencyMs: 0,
          engineId,
          engineName: engine.name,
          provider: 'Groq',
          confidence: 0,
          error: err?.message || 'Groq STT failed',
        }
      }
    }

    return {
      success: false,
      text: '',
      translatedVi: '',
      latencyMs: 0,
      engineId,
      engineName: engine.name,
      provider: 'Groq',
      confidence: 0,
      error: 'Dịch vụ Groq STT yêu cầu Electron IPC và khóa an toàn trong OS Credential Store.',
    }
  }

  return {
    success: false,
    text: '',
    translatedVi: '',
    latencyMs: 0,
    engineId,
    engineName: 'Unknown',
    provider: 'Local',
    confidence: 0,
    error: 'Không tìm thấy cấu hình STT phù hợp.',
  }
}
