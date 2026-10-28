import type { AudioChunkMeta, AudioSourceType } from '@/core/audio/types'
import {
  speechSegmentationTelemetry,
  type SpeechSegmentationMetrics,
} from '@/core/audio/SpeechSegmentationTelemetry'
import type { STTQueueMetrics } from '@/services/ai-model/stt'
import type { PipelineOverviewInfo, PipelineStage } from '../types'

export interface PipelineStageParams {
  pipelineStages?: PipelineStage[]
  bufferDurationSec: number
  bufferSizeBytes: number
  chunks: AudioChunkMeta[]
  queueMetrics: STTQueueMetrics
  isCapturing: boolean
  isStarting: boolean
  sourceType: AudioSourceType
  isAudioDetected: boolean
  captureError: string | null
  inputSampleRateHz: number | null
  telemetryMetrics?: SpeechSegmentationMetrics
}

export function computePipelineOverview(params: PipelineStageParams): PipelineOverviewInfo {
  const {
    pipelineStages = [],
    bufferDurationSec,
    bufferSizeBytes,
    chunks,
    queueMetrics,
    isCapturing,
    isStarting,
    sourceType,
    isAudioDetected,
    captureError,
  } = params

  const totalChunksCreated = chunks[0]?.index ?? 0
  const queued = queueMetrics.queueDepth
  const processing = queueMetrics.processingJobs
  const succeeded = queueMetrics.succeededJobs ?? 0
  const failed = queueMetrics.failedJobs ?? 0
  const sent = queueMetrics.enqueuedJobs ?? succeeded + failed + queued + processing
  const isWorkerFailed = queueMetrics.provider === 'Local' && queueMetrics.workerState === 'FAILED'
  const sttFailed = Boolean(queueMetrics.lastResult && !queueMetrics.lastResult.success)

  let overallLabel = 'Chưa bắt đầu thu âm'
  let advice: string | null = null
  let adviceTone: 'warning' | 'error' = 'warning'

  if (captureError) {
    overallLabel = 'Không mở được nguồn âm thanh'
    advice = `Kiểm tra quyền truy cập, thiết bị đang chọn và thử chọn lại nguồn. Chi tiết: ${captureError}`
    adviceTone = 'error'
  } else if (isWorkerFailed || sttFailed) {
    overallLabel = 'STT gặp lỗi'
    advice = isWorkerFailed
      ? 'Local Whisper worker không sẵn sàng. Kiểm tra binary/model trong Settings hoặc chuyển sang STT cloud đã cấu hình.'
      : `Chunk đã tới STT nhưng xử lý thất bại: ${
          queueMetrics.lastResult?.error || 'xem lỗi engine/API trong khu vực STT bên cạnh.'
        } Kiểm tra engine, API key và kết nối.`
    adviceTone = 'error'
  } else if (isStarting) {
    overallLabel = 'Đang kết nối nguồn âm thanh'
  } else if (isCapturing && !isAudioDetected) {
    overallLabel = 'Đang thu nhưng chưa phát hiện tín hiệu'
    advice =
      sourceType === 'mic'
        ? 'Nói gần micro và kiểm tra đã chọn đúng thiết bị cũng như quyền micro. Nếu tín hiệu vẫn không xuất hiện, thử đổi thiết bị hoặc kiểm tra lại mức đầu vào.'
        : 'Phát âm thanh trên ứng dụng cần nghe và kiểm tra đã chọn đúng nguồn system audio. Nếu vẫn im lặng, kiểm tra quyền/chia sẻ âm thanh của hệ thống.'
  } else if (
    isCapturing &&
    isAudioDetected &&
    totalChunksCreated === 0 &&
    bufferDurationSec >= 1
  ) {
    overallLabel = 'Có tín hiệu nhưng chưa tạo audio chunk'
    advice =
      'Kiểm tra ngưỡng VAD/độ nhạy và khoảng thời gian chunk. Nếu đang dùng micro, chạy Auto Calibrate trong Audio Test rồi thử lại.'
  } else if (
    isCapturing &&
    isAudioDetected &&
    totalChunksCreated > 0 &&
    sent === 0 &&
    (queueMetrics.droppedJobs ?? 0) > 0
  ) {
    overallLabel = 'Có chunk nhưng chưa gửi nội dung nói tới STT'
    advice =
      'Các đoạn có thể bị VAD loại vì mức âm thanh thấp hơn ngưỡng. Thử nói rõ hơn, giảm ngưỡng VAD hoặc hiệu chuẩn lại micro.'
  } else if (queued > 0 || processing > 0) {
    overallLabel = `STT đang xử lý · ${processing} đang chạy, ${queued} đang chờ`
    if (queued > Math.max(3, queueMetrics.concurrency * 2)) {
      advice =
        'Hàng đợi đang tăng. Kiểm tra độ trễ của STT engine/kết nối hoặc chuyển sang engine nhanh hơn.'
    }
  } else if (succeeded > 0) {
    overallLabel = `Pipeline hoạt động · ${succeeded} chunk STT thành công`
  } else if (isCapturing) {
    overallLabel = 'Đang thu và chờ tạo chunk'
  }

  // Format 6 stages
  const formattedStages: PipelineStage[] = pipelineStages.map((stage) => {
    if (stage.stage === 1) {
      return {
        ...stage,
        status: captureError
          ? 'error'
          : isStarting
          ? 'processing'
          : isCapturing
          ? 'active'
          : 'idle',
        detail: sourceType === 'system' ? 'System audio / loopback' : 'Microphone',
        subDetail: captureError
          ? 'Không thể mở capture'
          : isCapturing
          ? isAudioDetected
            ? 'Đang nhận được tín hiệu'
            : 'Chưa phát hiện tín hiệu'
          : 'Chưa thu âm',
      }
    }
    if (stage.stage === 4) {
      return {
        ...stage,
        status: bufferSizeBytes > 0 ? 'ready' : isCapturing ? 'active' : 'idle',
        detail: `${bufferDurationSec.toFixed(1)}s audio · ${(bufferSizeBytes / 1024).toFixed(1)} KB`,
      }
    }
    if (stage.stage === 5) {
      return {
        ...stage,
        status: totalChunksCreated > 0 ? 'ready' : isCapturing ? 'processing' : 'idle',
        detail: `${totalChunksCreated} chunk đã tạo · ${chunks.length} chunk gần nhất đang lưu`,
        subDetail: chunks[0]
          ? `Chunk mới nhất: ${chunks[0].durationSec.toFixed(1)}s · RMS ${chunks[0].rmsDb} dBFS`
          : 'Chưa có chunk PCM',
      }
    }
    if (stage.stage === 6) {
      const status =
        isWorkerFailed || sttFailed
          ? 'error'
          : processing > 0
          ? 'processing'
          : queued > 0
          ? 'active'
          : succeeded > 0
          ? 'ready'
          : isCapturing && isAudioDetected
          ? 'active'
          : 'idle'
      return {
        ...stage,
        status,
        detail: `${sent} gửi · ${processing} xử lý · ${queued} chờ`,
        subDetail: queueMetrics.lastResult
          ? `${succeeded} thành công · ${failed} thất bại · ${
              queueMetrics.droppedJobs
            } bỏ qua · lần cuối ${
              queueMetrics.lastResult.success ? 'OK' : 'lỗi'
            } ${new Date(queueMetrics.lastResult.at).toLocaleTimeString()}`
          : `${succeeded} thành công · ${failed} thất bại · ${queueMetrics.droppedJobs} bị bỏ qua`,
      }
    }
    return stage
  })

  return {
    overallLabel,
    advice,
    adviceTone,
    stages: formattedStages,
  }
}

export function getTelemetryMetricsSnapshot(): SpeechSegmentationMetrics {
  return speechSegmentationTelemetry.getMetrics()
}
