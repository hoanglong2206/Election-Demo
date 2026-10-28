import type { AudioDeviceInfo } from '@/services/audioDevices'
import type { VADCalibrationRecord, VADCalibrationResult } from '@/services/vad-calibration'

export type LayoutTab = 'split' | 'stt' | 'benchmark'

export interface STTPreviewLine {
  id: number
  timestamp: string
  originalEn: string
  translatedVi: string
  confidence: number
  latencyMs: number
  speaker: string
  engineBadge?: string
  isReal?: boolean
}

export type STTLang = 'auto' | 'en' | 'vi'

export interface AudioTestProps {
  onViewChange?: (view: 'home' | 'meeting' | 'audio-test' | 'ai-diagnostic' | 'history' | 'settings') => void
}

export type CalibrationStep = 'idle' | 'countdown' | 'sampling' | 'analyzed' | 'guard_error'

export interface VADCalibrationState {
  step: CalibrationStep
  countdown: number
  samplingProgress: number
  safetyMarginDb: number
  calibrationResult: VADCalibrationResult | null
  guardErrorMessage: string | null
}

export type PipelineStageStatus = 'idle' | 'processing' | 'active' | 'ready' | 'error'

export interface PipelineStage {
  stage: number
  name: string
  status: string
  detail: string
  subDetail?: string
}

export interface PipelineOverviewInfo {
  overallLabel: string
  advice: string | null
  adviceTone: 'warning' | 'error'
  stages: PipelineStage[]
}

export type AudioDeviceInfoItem = AudioDeviceInfo
export type VADCalibrationRecordItem = VADCalibrationRecord
