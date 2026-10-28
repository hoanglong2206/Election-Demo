import { useState, useRef, useEffect } from 'react'
import { Volume2, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRESET_AUDIO_DEVICES, type AudioDeviceInfo } from '@/services/audioDevices'

interface AudioDeviceSelectorProps {
  selectedDevice: string
  onSelectDevice: (deviceId: string) => void
  currentDevice: AudioDeviceInfo
}

export function AudioDeviceSelector({
  selectedDevice,
  onSelectDevice,
  currentDevice,
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

  return (
    <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-white/85 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Nguồn âm thanh mặc định:</span>
        </span>
      </div>

      <div ref={audioRef} className="relative">
        <button
          type="button"
          onClick={() => setIsAudioOpen(!isAudioOpen)}
          className="w-full bg-black/60 hover:bg-black/80 border border-white/[0.1] hover:border-violet-500/40 rounded-xl px-3 py-2 text-[11px] text-left flex items-center justify-between transition-all"
        >
          <span className="font-medium text-white/90 truncate">{currentDevice.label}</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
              isAudioOpen && 'rotate-180 text-violet-400'
            )}
          />
        </button>

        {isAudioOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 space-y-1 animate-fade-in">
            {PRESET_AUDIO_DEVICES.map((d) => {
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
                    'p-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[11px]',
                    isSelected
                      ? 'bg-violet-600/20 text-white font-medium border border-violet-500/30'
                      : 'hover:bg-white/[0.06] text-white/75'
                  )}
                >
                  <span className="truncate pr-2">{d.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-violet-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[9.5px] text-white/40 pt-0.5">
        Có thể chuyển đổi nhanh giữa Loa ngoài, Tai nghe và Loopback ở bất kỳ lúc nào.
      </p>
    </div>
  )
}

