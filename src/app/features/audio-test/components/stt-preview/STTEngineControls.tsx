import { useState, useRef, useEffect } from 'react'
import { Cpu, ChevronDown, Check, Globe, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STT_LANG_OPTIONS } from '../../constants'
import type { STTLang } from '../../types'
import type { STTEngineConfig } from '@/services/ai-model/aiModels'

export interface STTEngineControlsProps {
  currentSTTEngine: STTEngineConfig
  availableSTTEngines: STTEngineConfig[]
  selectedSTT: string
  onSelectSTTEngine: (engineId: string) => void
  sttLang: STTLang
  onSelectSTTLang: (lang: STTLang) => void
  sttLinesCount: number
  onSimulateSTT: () => void
  onClearSTT: () => void
}

export function STTEngineControls({
  currentSTTEngine,
  availableSTTEngines,
  selectedSTT,
  onSelectSTTEngine,
  sttLang,
  onSelectSTTLang,
  sttLinesCount,
  onSimulateSTT,
  onClearSTT,
}: STTEngineControlsProps) {
  const [isSTTMenuOpen, setIsSTTMenuOpen] = useState(false)
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
  const sttMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sttMenuRef.current && !sttMenuRef.current.contains(e.target as Node)) {
        setIsSTTMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {/* Interactive STT Engine Selector */}
      <div ref={sttMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsSTTMenuOpen(!isSTTMenuOpen)}
          className="h-6 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-md text-[10px] text-emerald-300 font-medium flex items-center gap-1 transition-all"
          title="Chọn mô hình STT đang sử dụng"
        >
          <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="max-w-[130px] truncate">
            {currentSTTEngine.name.split(' (')[0]}
          </span>
          <ChevronDown
            className={cn(
              'w-2.5 h-2.5 text-emerald-400 shrink-0 transition-transform duration-200',
              isSTTMenuOpen && 'rotate-180'
            )}
          />
        </button>

        {isSTTMenuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[240px] space-y-0.5 animate-fade-in">
            <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider">
              Mô hình STT nhận diện:
            </div>
            {availableSTTEngines.map((eng) => {
              const isSelected = eng.id === selectedSTT
              return (
                <div
                  key={eng.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectSTTEngine(eng.id)
                    setIsSTTMenuOpen(false)
                  }}
                  className={cn(
                    'px-2 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[10.5px]',
                    isSelected
                      ? 'bg-emerald-600/20 text-white border border-emerald-500/30'
                      : 'hover:bg-white/[0.06] text-white/75'
                  )}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-medium text-white/95 leading-tight truncate">
                      {eng.name.split(' (')[0]}
                    </div>
                    <div className="text-[9px] text-white/40 font-mono truncate">
                      {eng.badge}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Interactive Language Selector Dropdown */}
      <div ref={langMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
          className="h-6 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-md text-[10px] text-emerald-300 font-medium flex items-center gap-1 transition-all"
          title="Chọn ngôn ngữ âm thanh đầu vào"
        >
          <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="max-w-[120px] truncate">
            {STT_LANG_OPTIONS.find((l) => l.id === sttLang)?.name || 'Tự động (Auto)'}
          </span>
          <ChevronDown
            className={cn(
              'w-2.5 h-2.5 text-emerald-400 shrink-0 transition-transform duration-200',
              isLangMenuOpen && 'rotate-180'
            )}
          />
        </button>

        {isLangMenuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1 min-w-[230px] space-y-0.5 animate-fade-in">
            <div className="px-2 py-1 text-[9px] font-semibold text-white/40 uppercase tracking-wider">
              Ngôn ngữ âm thanh:
            </div>
            {STT_LANG_OPTIONS.map((langOpt) => {
              const isSelected = langOpt.id === sttLang
              return (
                <div
                  key={langOpt.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectSTTLang(langOpt.id)
                    setIsLangMenuOpen(false)
                  }}
                  className={cn(
                    'px-2 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-[10.5px]',
                    isSelected
                      ? 'bg-emerald-600/20 text-white border border-emerald-500/30'
                      : 'hover:bg-white/[0.06] text-white/75'
                  )}
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-medium text-white/95 leading-tight truncate">
                      {langOpt.name}
                    </div>
                    <div className="text-[9px] text-white/40 font-mono truncate">
                      {langOpt.desc}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Simulate Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={onSimulateSTT}
        className="h-6 text-[10px] px-2 gap-1 bg-white/5 text-violet-300 border-violet-500/30 hover:bg-violet-500/20 transition-all font-medium"
        title="Chạy mô phỏng lời nói mẫu để xem phụ đề"
      >
        <Play className="w-2.5 h-2.5 fill-violet-300" />
        <span>Mẫu YouTube</span>
      </Button>

      {sttLinesCount > 0 && (
        <button
          type="button"
          onClick={onClearSTT}
          className="text-[10px] text-white/40 hover:text-rose-300 flex items-center gap-0.5 px-1.5 py-1 rounded transition-colors"
          title="Xóa danh sách nhận diện"
        >
          <Trash2 className="w-3 h-3" />
          <span>Xóa</span>
        </button>
      )}
    </div>
  )
}
