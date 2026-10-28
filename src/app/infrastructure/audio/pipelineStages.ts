import type { PipelineStageInfo } from '@/core/audio/types'
import type { AudioPipelineState } from './types'

export function computePipelineStages(
  state: Pick<
    AudioPipelineState,
    | 'isCapturing'
    | 'sourceType'
    | 'isAudioDetected'
    | 'engineType'
    | 'hasBuffer'
    | 'bufferedSeconds'
    | 'bufferSizeBytes'
    | 'bufferDurationSec'
    | 'estimatedMemoryMb'
    | 'chunks'
  >
): PipelineStageInfo[] {
  const {
    isCapturing,
    sourceType,
    isAudioDetected,
    engineType,
    hasBuffer,
    bufferedSeconds,
    bufferSizeBytes,
    bufferDurationSec,
    estimatedMemoryMb,
    chunks,
  } = state

  return [
    {
      stage: 1,
      name: 'System audio',
      status: isCapturing ? 'active' : 'idle',
      detail:
        sourceType === 'system'
          ? 'Loopback stream (YouTube / Calls)'
          : 'Microphone stream',
      subDetail: isCapturing
        ? isAudioDetected
          ? 'Đang có tín hiệu âm thanh'
          : 'Chờ phát âm thanh...'
        : 'Sẵn sàng bắt đầu',
    },
    {
      stage: 2,
      name: 'Decode thành PCM',
      status: isCapturing ? 'processing' : 'idle',
      detail: isCapturing
        ? engineType === 'audio_worklet'
          ? 'Web Audio Worklet (Dedicated Audio Thread)'
          : 'Web Audio API Float32Array [-1.0, 1.0]'
        : 'Chờ luồng âm thanh',
      subDetail: isCapturing
        ? engineType === 'audio_worklet'
          ? 'AudioWorkletNode · 2048 samples · Zero-copy'
          : 'ScriptProcessorNode · 4096 samples'
        : undefined,
    },
    {
      stage: 3,
      name: 'Chuẩn hóa sample rate / channel',
      status: isCapturing ? 'processing' : 'idle',
      detail: '16,000 Hz · 1-ch (Mono) · 16-bit PCM',
      subDetail: 'Int16Array (256 kbps bitrate)',
    },
    {
      stage: 4,
      name: 'Audio buffer (Bounded Window)',
      status: hasBuffer ? 'ready' : isCapturing ? 'active' : 'idle',
      detail: `${bufferedSeconds}s buffer (${(bufferSizeBytes / 1024).toFixed(1)} KB) · Total ${bufferDurationSec}s`,
      subDetail: `RAM: ${estimatedMemoryMb} MB · Bounded sliding window`,
    },
    {
      stage: 5,
      name: 'Audio chunks',
      status: chunks.length > 0 ? 'ready' : isCapturing ? 'active' : 'idle',
      detail: `${chunks.length > 0 ? chunks[0]?.index : 0} chunks tạo ra (1.0s / 32 KB)`,
      subDetail: 'Sẵn sàng đóng gói gửi STT',
    },
    {
      stage: 6,
      name: 'Speech-to-Text',
      status: isAudioDetected ? 'active' : hasBuffer ? 'ready' : 'idle',
      detail: 'STT Ready (Whisper / Deepgram format)',
      subDetail: isAudioDetected
        ? 'Phát hiện giọng nói / âm thanh'
        : 'Hàng đợi sẵn sàng',
    },
  ]
}
