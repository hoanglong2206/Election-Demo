import { Volume2, RefreshCw, Headphones, ChevronDown, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AudioDeviceInfo } from '../../../services/audioDevices'

interface AudioDeviceSelectorCardProps {
  audioDevices: AudioDeviceInfo[]
  selectedDeviceId: string
  currentAudioDevice: AudioDeviceInfo | undefined
  isScanningDevices: boolean
  isAudioDropdownOpen: boolean
  audioDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onDeviceChange: (id: string) => void
  onRefreshDevices: () => void
  onOpenAudioTest: () => void
}

export function AudioDeviceSelectorCard({
  audioDevices,
  selectedDeviceId,
  currentAudioDevice,
  isScanningDevices,
  isAudioDropdownOpen,
  audioDropdownRef,
  onToggleDropdown,
  onDeviceChange,
  onRefreshDevices,
  onOpenAudioTest,
}: AudioDeviceSelectorCardProps) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.07] shadow-none p-3 gap-2 relative h-[105px] flex flex-col justify-between shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-white/85 flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          Thiết Bị Âm Thanh
        </span>
        <button
          type="button"
          onClick={onRefreshDevices}
          title="Quét lại thiết bị đang kết nối"
          className="text-white/40 hover:text-emerald-400 transition-colors p-0.5 rounded hover:bg-white/5"
        >
          <RefreshCw
            className={cn(
              'w-3 h-3',
              isScanningDevices && 'animate-spin text-emerald-400'
            )}
          />
        </button>
      </div>

      {/* Custom Dropdown */}
      <div ref={audioDropdownRef} className="relative w-full">
        <button
          id="btn-select-audio-device"
          type="button"
          onClick={onToggleDropdown}
          className="w-full bg-black/40 border border-white/[0.1] hover:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 flex items-center justify-between gap-1.5 transition-all text-left"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Headphones className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate block font-medium">
              {currentAudioDevice?.label || 'Loopback Output'}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
              isAudioDropdownOpen && 'rotate-180 text-emerald-400'
            )}
          />
        </button>

        {isAudioDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 max-h-48 overflow-y-auto custom-scrollbar animate-fade-in">
            {audioDevices.map((d) => {
              const isSelected = d.deviceId === selectedDeviceId
              return (
                <div
                  key={d.deviceId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onDeviceChange(d.deviceId)}
                  onKeyDown={(e) => e.key === 'Enter' && onDeviceChange(d.deviceId)}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                  title={d.label}
                >
                  <span className="truncate pr-2 block">{d.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status footnote */}
      <div className="flex items-center justify-between text-[10px] pt-1">
        <div className="flex items-center gap-1 text-emerald-300 whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Ready (Sẵn sàng thu)</span>
        </div>
        <button
          type="button"
          onClick={onOpenAudioTest}
          className="text-[10px] text-violet-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0"
        >
          Test âm thanh &rarr;
        </button>
      </div>
    </Card>
  )
}
