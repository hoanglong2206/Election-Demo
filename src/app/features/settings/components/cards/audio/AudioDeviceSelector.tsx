import { useState, useRef, useEffect } from 'react'
import { Volume2, ChevronDown, Check, RefreshCw, Headphones, Mic, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_LOOPBACK_DEVICE, type AudioDeviceInfo } from '@/services/audio-devices'

export interface AudioDeviceSelectorProps {
  selectedDevice: string
  onSelectDevice: (deviceId: string) => void
  currentDevice: AudioDeviceInfo
  audioDevices?: AudioDeviceInfo[]
  isScanningDevices?: boolean
  onRefreshDevices?: () => void
}

export function AudioDeviceSelector({
  selectedDevice,
  onSelectDevice,
  currentDevice,
  audioDevices = [],
  isScanningDevices = false,
  onRefreshDevices,
}: AudioDeviceSelectorProps) {
  const [isAudioOpen, setIsAudioOpen] = useState(false)
  const audioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (audioRef.current && !audioRef.current.contains(e.target as Node)) {
        setIsAudioOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const effectiveDevices =
    audioDevices.length > 0 ? audioDevices : [currentDevice || DEFAULT_LOOPBACK_DEVICE]

  const getDeviceIcon = (device?: AudioDeviceInfo) => {
    if (!device || device.type === 'system' || device.deviceId === 'default-loopback') {
      return <Radio className="w-3.5 h-3.5 text-violet-400 shrink-0" />
    }
    if (device.kind === 'audioinput') {
      return <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    }
    return <Headphones className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  }

  return (
    <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Nguồn âm thanh mặc định:</span>
        </span>
        {onRefreshDevices && (
          <button
            type="button"
            onClick={onRefreshDevices}
            disabled={isScanningDevices}
            title="Quét lại thiết bị phần cứng thật trên máy tính"
            className="text-white/40 hover:text-emerald-400 transition-colors p-0.5 rounded hover:bg-white/5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={cn(
                'w-3 h-3',
                isScanningDevices && 'animate-spin text-emerald-400'
              )}
            />
          </button>
        )}
      </div>

      <div ref={audioRef} className="relative">
        <button
          type="button"
          onClick={() => setIsAudioOpen(!isAudioOpen)}
          aria-haspopup="listbox"
          aria-expanded={isAudioOpen}
          className={cn(
            'w-full bg-black/50 hover:bg-black/70 border border-white/10 hover:border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-left flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-inner select-none',
            isAudioOpen && 'border-emerald-500/60 ring-2 ring-emerald-500/25'
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
            {getDeviceIcon(currentDevice)}
            <span className="font-medium text-white/90 truncate">
              {currentDevice?.label || DEFAULT_LOOPBACK_DEVICE.label}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200 ease-out',
              isAudioOpen && 'rotate-180 text-emerald-400'
            )}
          />
        </button>

        {isAudioOpen && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d]/95 border border-white/15 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 ease-out max-h-56 overflow-y-auto custom-scrollbar"
          >
            {effectiveDevices.map((d) => {
              const isSelected = d.deviceId === selectedDevice
              return (
                <div
                  key={d.deviceId}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectDevice(d.deviceId)
                    setIsAudioOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectDevice(d.deviceId)
                      setIsAudioOpen(false)
                    }
                  }}
                  className={cn(
                    'p-2 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-between text-xs select-none',
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-200 font-medium border border-emerald-500/35 shadow-sm'
                      : 'hover:bg-white/[0.08] text-white/80'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    {getDeviceIcon(d)}
                    <span className="truncate">{d.label}</span>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[9.5px] text-white/40 pt-0.5">
        Phát hiện tự động từ thiết bị phần cứng thật trên máy tính của bạn.
      </p>
    </div>
  )
}
