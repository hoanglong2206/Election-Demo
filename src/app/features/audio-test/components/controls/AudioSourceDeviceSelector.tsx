import { Radio } from 'lucide-react'
import type { AudioDeviceInfo } from '@/services/audio-devices'

export interface AudioSourceDeviceSelectorProps {
  sourceType: 'mic' | 'system'
  setSourceType: (type: 'mic' | 'system') => void
  isCapturing: boolean
  availableDevices?: AudioDeviceInfo[]
  selectedDeviceId?: string
  onSelectDevice?: (deviceId: string) => void
}

export function AudioSourceDeviceSelector({
  setSourceType,
  isCapturing,
}: AudioSourceDeviceSelectorProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/[0.08] shadow-inner">
        {/* System Audio Badge / Toggle */}
        <button
          type="button"
          id="btn-source-system"
          onClick={() => !isCapturing && setSourceType('system')}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap border bg-violet-600/35 text-violet-200 border-violet-500/40 shadow-sm cursor-default"
          title="Thu âm loopback từ video YouTube, cuộc gọi hoặc âm thanh hệ thống (Đang bật thu âm hệ thống)"
        >
          <Radio className="w-3.5 h-3.5 text-violet-400" />
          <span>System Audio (Loopback)</span>
        </button>
      </div>
    </div>
  )
}
