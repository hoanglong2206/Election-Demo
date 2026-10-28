import { useState, useRef, useEffect } from 'react'
import { Radio, Mic, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  sourceType,
  setSourceType,
  isCapturing,
  availableDevices = [],
  selectedDeviceId,
  onSelectDevice,
}: AudioSourceDeviceSelectorProps) {
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false)
  const deviceMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setIsDeviceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedDevice =
    availableDevices.find((d) => d.deviceId === selectedDeviceId) || availableDevices[0]

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/[0.08] shadow-inner">
        {/* System Audio Toggle */}
        <button
          type="button"
          id="btn-source-system"
          onClick={() => !isCapturing && setSourceType('system')}
          disabled={isCapturing}
          className={cn(
            'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
            sourceType === 'system'
              ? 'bg-violet-600/35 text-violet-200 border border-violet-500/40 shadow-sm font-semibold'
              : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
          )}
          title="Thu âm loopback từ video YouTube, cuộc gọi hoặc âm thanh hệ thống"
        >
          <Radio className="w-3.5 h-3.5 text-violet-400" />
          <span>System Audio</span>
        </button>

        {/* Microphone Toggle with integrated Device Select Popover */}
        <div className="relative flex items-center" ref={deviceMenuRef}>
          <button
            type="button"
            id="btn-source-mic"
            onClick={() => {
              if (!isCapturing) {
                setSourceType('mic')
              }
            }}
            disabled={isCapturing}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
              sourceType === 'mic'
                ? 'bg-emerald-600/35 text-emerald-200 border border-emerald-500/40 shadow-sm font-semibold'
                : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
            )}
            title={
              selectedDevice
                ? `Microphone: ${selectedDevice.label} (Bấm mũi tên để đổi thiết bị)`
                : 'Thu âm trực tiếp từ microphone'
            }
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Microphone</span>

            {availableDevices.length > 1 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDeviceMenuOpen(!isDeviceMenuOpen)
                }}
                className="ml-0.5 p-0.5 hover:text-emerald-200 text-emerald-400/70 transition-colors"
                title="Đổi thiết bị microphone"
              >
                <ChevronDown
                  className={cn(
                    'w-3 h-3 transition-transform duration-200',
                    isDeviceMenuOpen && 'rotate-180'
                  )}
                />
              </span>
            )}
          </button>

          {/* Clean Microphone Selector Dropdown */}
          {isDeviceMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[220px] max-w-[280px] space-y-0.5 animate-fade-in">
              <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider flex items-center justify-between">
                <span>Chọn Microphone</span>
                <span className="text-[9px] text-white/20 font-mono">
                  {availableDevices.length} thiết bị
                </span>
              </div>
              {availableDevices.map((dev) => (
                <button
                  key={dev.deviceId}
                  type="button"
                  onClick={() => {
                    onSelectDevice?.(dev.deviceId)
                    setIsDeviceMenuOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors',
                    selectedDeviceId === dev.deviceId
                      ? 'bg-emerald-500/20 text-emerald-200 font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="truncate">{dev.label}</span>
                  {selectedDeviceId === dev.deviceId && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
