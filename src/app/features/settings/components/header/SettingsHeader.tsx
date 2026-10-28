import { Settings as SettingsIcon, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SettingsHeaderProps {
  onSave: () => void
}

export function SettingsHeader({ onSave }: SettingsHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-1">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <SettingsIcon className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-white/95">
            Cài Đặt Hệ Thống & Trí Tuệ Nhân Tạo
          </h2>
          <p className="text-[11px] text-white/40">
            Quản lý Groq Key (STT+LLM), LLM Key đa hãng (Gemini, OpenAI) và phím tắt cuộc họp
          </p>
        </div>
      </div>

      <Button
        id="btn-save-settings"
        size="sm"
        onClick={onSave}
        className={cn(
          'text-[11.5px] h-8 px-4 gap-1.5 shadow-sm font-medium transition-all bg-violet-600 hover:bg-violet-500 text-white'
        )}
      >
        <Check className="w-3.5 h-3.5" />
        <span>Lưu cài đặt</span>
      </Button>
    </div>
  )
}

