import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KeyStep = 'idle' | 'checking' | 'verified' | 'syncing' | 'synced' | 'saving' | 'saved'

interface KeyBreadcrumbsProps {
  step: KeyStep
}

export function KeyBreadcrumbs({ step }: KeyBreadcrumbsProps) {
  return (
    <div className="flex items-center gap-1.5 text-[9.5px]">
      <span
        className={cn(
          'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
          step === 'idle' || step === 'checking'
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
            : 'bg-white/5 text-white/40'
        )}
      >
        <span>1. Kiểm tra key</span>
        {(step === 'verified' || step === 'syncing' || step === 'synced' || step === 'saving' || step === 'saved') && (
          <Check className="w-2.5 h-2.5 text-blue-400" />
        )}
      </span>
      <span className="text-white/20">→</span>
      <span
        className={cn(
          'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
          step === 'verified' || step === 'syncing'
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
            : 'bg-white/5 text-white/40'
        )}
      >
        <span>2. Đồng bộ model</span>
        {(step === 'synced' || step === 'saving' || step === 'saved') && <Check className="w-2.5 h-2.5 text-violet-400" />}
      </span>
      <span className="text-white/20">→</span>
      <span
        className={cn(
          'px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1',
          step === 'synced' || step === 'saving' || step === 'saved'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : 'bg-white/5 text-white/40'
        )}
      >
        <span>3. Lưu an toàn</span>
        {step === 'saved' && <Check className="w-2.5 h-2.5 text-emerald-400" />}
      </span>
    </div>
  )
}

