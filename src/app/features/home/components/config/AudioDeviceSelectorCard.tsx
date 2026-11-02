import {
  Volume2,
  RefreshCw,
  Headphones,
  Radio,
  Mic,
  ChevronDown,
  Settings,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AudioDeviceInfo } from '@/services/audio-devices'

export interface AudioDeviceSelectorCardProps {
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
  onOpenSettings?: () => void
}

function DeviceIcon({
  device,
  className,
}: {
  device: AudioDeviceInfo | undefined
  className?: string
}) {
  if (!device || device.deviceId === 'default-loopback' || device.type === 'system') {
    return <Radio className={className} />
  }
  if (device.type === 'headphone') {
    return <Headphones className={className} />
  }
  if (device.type === 'speaker') {
    return <Volume2 className={className} />
  }
  return <Mic className={className} />
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
  onOpenSettings,
}: AudioDeviceSelectorCardProps) {
  const isLoopback =
    !currentAudioDevice ||
    currentAudioDevice.deviceId === 'default-loopback' ||
    currentAudioDevice.type === 'system'

  return (
    <Card className="bg-white/[0.03] border-white/[0.07] shadow-none p-2.5 gap-2 relative min-h-[105px] flex flex-col justify-between shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11.5px] font-semibold text-white/85 whitespace-nowrap">
            Thiết Bị Âm Thanh
          </span>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap hidden sm:inline-block">
            Theo Cài Đặt
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefreshDevices}
            title="Quét lại thiết bị phần cứng đang kết nối"
            className="text-white/40 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-white/5 cursor-pointer"
          >
            <RefreshCw
              className={cn(
                'w-3 h-3',
                isScanningDevices && 'animate-spin text-emerald-400'
              )}
            />
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Đổi nguồn âm thanh mặc định trong Cài Đặt"
              className="text-white/40 hover:text-white transition-colors p-1 rounded hover:bg-white/5 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Active Audio Telemetry Display & Inspect Trigger */}
      <div ref={audioDropdownRef} className="relative w-full">
        <div
          id="btn-select-audio-device"
          onClick={onToggleDropdown}
          aria-haspopup="listbox"
          aria-expanded={isAudioDropdownOpen}
          className={cn(
            'w-full bg-black/45 border border-white/10 hover:border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-[11px] text-white/90 flex items-center justify-between gap-2 transition-all duration-200 shadow-inner select-none cursor-pointer active:scale-[0.99]',
            isAudioDropdownOpen && 'border-emerald-500/60 ring-2 ring-emerald-500/25'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <DeviceIcon device={currentAudioDevice} className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate block font-medium text-white/95 text-[11px]">
                  {currentAudioDevice?.label || 'Loopback Output (Âm thanh hệ thống)'}
                </span>
                {isLoopback ? (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium shrink-0">
                    Loopback
                  </span>
                ) : (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium shrink-0">
                    Hardware
                  </span>
                )}
              </div>
              <p className="text-[9.5px] text-white/40 truncate">
                {isLoopback
                  ? 'Âm thanh hệ thống / YouTube / Cuộc gọi Meet, Zoom'
                  : 'Nguồn âm thanh phần cứng kết nối'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Visualizer Waveform Animation */}
            <div
              className="flex items-end gap-[2px] h-3.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
              title="Kênh âm thanh đang sẵn sàng thu"
            >
              <span className="w-[2px] h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="w-[2px] h-3.5 rounded-full bg-emerald-400 animate-[pulse_0.7s_ease-in-out_infinite]" />
              <span className="w-[2px] h-2.5 rounded-full bg-emerald-400 animate-[pulse_1.2s_ease-in-out_infinite]" />
              <span className="w-[2px] h-3 rounded-full bg-emerald-400 animate-[pulse_0.9s_ease-in-out_infinite]" />
            </div>

            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
                isAudioDropdownOpen && 'rotate-180 text-emerald-400'
              )}
            />
          </div>
        </div>

        {/* Hardware Inspector Popover (Không làm thay đổi Settings) */}
        {isAudioDropdownOpen && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d]/95 border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-2 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 ease-out space-y-1"
          >
            <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-white/10 mb-1 text-[10px]">
              <span className="uppercase font-semibold tracking-wider text-white/50">
                Thiết Bị Phần Cứng ({audioDevices.length})
              </span>
              <span className="text-emerald-400/80 font-medium">Chế độ xem</span>
            </div>

            {audioDevices.map((d) => {
              const isSelected = d.deviceId === selectedDeviceId
              return (
                <div
                  key={d.deviceId}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => onDeviceChange(d.deviceId)}
                  onKeyDown={(e) => e.key === 'Enter' && onDeviceChange(d.deviceId)}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 select-none',
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-200 font-medium border border-emerald-500/35 shadow-sm'
                      : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                  )}
                  title={d.label}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <DeviceIcon device={d} className="w-3 h-3 text-emerald-400/80 shrink-0" />
                    <span className="truncate block">{d.label}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 shrink-0 font-medium border border-emerald-500/30">
                      Đang kích hoạt
                    </span>
                  )}
                </div>
              )
            })}

            <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 px-1">
              <span>Đổi nguồn mặc định trong Cài Đặt</span>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleDropdown()
                    onOpenSettings()
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  Mở Cài Đặt
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footnote */}
      <div className="flex items-center justify-between text-[10px] pt-1">
        <div className="flex items-center gap-1 text-emerald-300 whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sẵn sàng thu ({audioDevices.length} thiết bị online)</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[10px] text-white/50 hover:text-white transition-colors flex items-center gap-0.5 cursor-pointer"
              title="Đổi nguồn âm thanh mặc định trong Cài Đặt"
            >
              <Settings className="w-2.5 h-2.5" />
              <span>Cài đặt</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAudioTest}
            className="text-[10px] text-violet-300 hover:text-white underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Test âm thanh &rarr;
          </button>
        </div>
      </div>
    </Card>
  )
}
