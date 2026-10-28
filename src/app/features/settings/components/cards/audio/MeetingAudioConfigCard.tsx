import { Sliders } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AudioDeviceSelector } from './AudioDeviceSelector'
import { ModelRouterPolicySelector, type ModelRouterPolicy } from './ModelRouterPolicySelector'
import { VADSegmentationSection } from './VADSegmentationSection'
import { ResponseLanguageSection } from './ResponseLanguageSection'
import type { AudioDeviceInfo } from '@/services/audio-devices'

export interface MeetingAudioConfigCardProps {
  vadThreshold: string
  onVadThresholdChange: (val: string) => void
  responseLang: string
  onResponseLangChange: (val: string) => void
  selectedDevice: string
  onSelectDevice: (deviceId: string) => void
  currentDevice: AudioDeviceInfo
  modelRouterPolicy: ModelRouterPolicy
  onModelRouterPolicyChange: (policy: ModelRouterPolicy) => void
  segmentationMode?: 'sentence' | 'fixed'
  onSegmentationModeChange?: (mode: 'sentence' | 'fixed') => void
  silenceEndMs?: number
  onSilenceEndMsChange?: (val: number) => void
  maxSegmentMs?: number
  onMaxSegmentMsChange?: (val: number) => void
}

export function MeetingAudioConfigCard({
  vadThreshold,
  onVadThresholdChange,
  responseLang,
  onResponseLangChange,
  selectedDevice,
  onSelectDevice,
  currentDevice,
  modelRouterPolicy,
  onModelRouterPolicyChange,
  segmentationMode = 'sentence',
  onSegmentationModeChange,
  silenceEndMs = 400,
  onSilenceEndMsChange,
  maxSegmentMs = 4500,
  onMaxSegmentMsChange,
}: MeetingAudioConfigCardProps) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none py-3.5 px-4 gap-3">
      <CardHeader className="p-0 pb-1">
        <CardTitle className="text-[12.5px] text-white/90 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Cấu Hình Nâng Cao Cho Cuộc Họp (Audio & Response Tuning)</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 space-y-3 flex flex-col">
        {/* Row 1: Audio Device & Smart Router */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 order-1">
          <AudioDeviceSelector
            selectedDevice={selectedDevice}
            onSelectDevice={onSelectDevice}
            currentDevice={currentDevice}
          />
          <ModelRouterPolicySelector
            modelRouterPolicy={modelRouterPolicy}
            onModelRouterPolicyChange={onModelRouterPolicyChange}
          />
        </div>

        {/* Row 2: VAD Segmentation & Preferred Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 order-2">
          <VADSegmentationSection
            selectedDevice={selectedDevice}
            vadThreshold={vadThreshold}
            onVadThresholdChange={onVadThresholdChange}
            segmentationMode={segmentationMode}
            onSegmentationModeChange={onSegmentationModeChange}
            silenceEndMs={silenceEndMs}
            onSilenceEndMsChange={onSilenceEndMsChange}
            maxSegmentMs={maxSegmentMs}
            onMaxSegmentMsChange={onMaxSegmentMsChange}
          />
          <ResponseLanguageSection
            responseLang={responseLang}
            onResponseLangChange={onResponseLangChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

