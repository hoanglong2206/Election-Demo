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
