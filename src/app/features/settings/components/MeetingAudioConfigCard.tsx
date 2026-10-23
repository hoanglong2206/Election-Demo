import { useState, useRef, useEffect } from 'react'
import { Sliders, Globe, Volume2, ChevronDown, Check, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { PRESET_AUDIO_DEVICES, type AudioDeviceInfo } from '../../../services/audioDevices'
import { getVADCalibration } from '../../../services/vad-calibration'

interface MeetingAudioConfigCardProps {
  vadThreshold: string
  onVadThresholdChange: (val: string) => void
  responseLang: string
  onResponseLangChange: (val: string) => void
  selectedDevice: string
  onSelectDevice: (deviceId: string) => void
  currentDevice: AudioDeviceInfo
  autoPersonalize: boolean
  onAutoPersonalizeChange: (val: boolean) => void
}

export function MeetingAudioConfigCard({
  vadThreshold,
  onVadThresholdChange,
  responseLang,
  onResponseLangChange,
  selectedDevice,
  onSelectDevice,
  currentDevice,
  autoPersonalize,
  onAutoPersonalizeChange,
}: MeetingAudioConfigCardProps) {
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
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none py-3.5 px-4 gap-3">
      <CardHeader className="p-0 pb-1">
        <CardTitle className="text-[12.5px] text-white/90 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span>Cấu Hình Nâng Cao Cho Cuộc Họp (Audio & Response Tuning)</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* VAD Silence Detection Threshold */}
          <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white/85">
                VAD Silence Detection (Độ nhạy ngắt câu):
              </span>
              <div className="flex items-center gap-1.5">
                {getVADCalibration(selectedDevice) && (
                  <span className="text-[9.5px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded font-mono">
                    {getVADCalibration(selectedDevice)?.speechThresholdDbfs} dBFS
                  </span>
                )}
                <span className="text-violet-300 font-mono text-[10.5px] font-medium">
                  {vadThreshold}s
                </span>
              </div>
            </div>

            {/* Segmented control buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {[
                { val: '0.5', label: '0.5s', sub: 'Nhanh dứt khoát' },
                { val: '0.8', label: '0.8s', sub: 'Chuẩn mặc định' },
                { val: '1.2', label: '1.2s', sub: 'Chậm ngắt quãng' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onVadThresholdChange(item.val)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
                    vadThreshold === item.val
                      ? 'bg-violet-600/25 border-violet-500/50 text-white shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  <span className="text-[11px] font-bold">{item.label}</span>
                  <span className="text-[8.5px] opacity-60 leading-tight">{item.sub}</span>
                </button>
              ))}
            </div>

            <p className="text-[9.5px] text-white/40 pt-0.5">
              Khoảng lặng âm thanh trước khi hệ thống chốt câu và gửi sang bộ phân tích AI.
            </p>
          </div>

          {/* Preferred Response Language */}
          <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white/85 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                <span>Ngôn ngữ phản hồi của AI:</span>
              </span>
            </div>

            {/* Segmented control buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {[
                { val: 'bilingual', label: 'Song ngữ', sub: 'EN + VI song song' },
                { val: 'en', label: 'Tiếng Anh', sub: 'Chỉ English' },
                { val: 'vi', label: 'Tiếng Việt', sub: 'Chỉ Vietnamese' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onResponseLangChange(item.val)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center border',
                    responseLang === item.val
                      ? 'bg-violet-600/25 border-violet-500/50 text-white shadow-sm'
                      : 'bg-white/[0.02] border-white/[0.05] text-white/60 hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  <span className="text-[11px] font-bold">{item.label}</span>
                  <span className="text-[8.5px] opacity-60 leading-tight">{item.sub}</span>
                </button>
              ))}
            </div>

            <p className="text-[9.5px] text-white/40 pt-0.5">
              AI sẽ gợi ý câu trả lời tương ứng theo đúng định dạng ngôn ngữ bạn mong muốn.
            </p>
          </div>
        </div>

        {/* Audio Device Selector & Personalization Switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Audio Device Custom Dropdown */}
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
                <span className="font-medium text-white/90 truncate">
                  {currentDevice.label}
                </span>
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

          {/* Personalization Switch Card */}
          <div className="bg-black/40 p-3 rounded-xl border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[12px] font-semibold text-white/95 block">
                  Tự động cá nhân hóa theo CV & JD
                </span>
                <p className="text-[10px] text-white/45 leading-relaxed mt-0.5">
                  Tận dụng thông tin kinh nghiệm thực tế để tạo câu trả lời phỏng vấn chuẩn xác nhất.
                </p>
              </div>
            </div>
            <Switch
              checked={autoPersonalize}
              onCheckedChange={onAutoPersonalizeChange}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
