import { Clock, MessageSquare, Sparkles, Camera, Columns } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DetailTab } from '../../types'

export interface DetailNavTabsProps {
  detailTab: DetailTab
  onDetailTabChange: (tab: DetailTab) => void
  screenshotCount: number
}

export function DetailNavTabs({
  detailTab,
  onDetailTabChange,
  screenshotCount,
}: DetailNavTabsProps) {
  return (
    <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-white/[0.06] shrink-0 gap-2">
      <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.08] shadow-inner backdrop-blur-md select-none">
        <button
          type="button"
          onClick={() => onDetailTabChange('timeline')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border cursor-pointer select-none active:scale-[0.98]',
            detailTab === 'timeline'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-400/30 shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
              : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.05]'
          )}
          title="Dòng thời gian hội thoại tích hợp"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>1. Dòng Thời Gian</span>
        </button>

        <button
          type="button"
          onClick={() => onDetailTabChange('transcript')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border cursor-pointer select-none active:scale-[0.98]',
            detailTab === 'transcript'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-400/30 shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
              : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.05]'
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>2. Lời Thoại</span>
        </button>

        <button
          type="button"
          onClick={() => onDetailTabChange('suggestions')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border cursor-pointer select-none active:scale-[0.98]',
            detailTab === 'suggestions'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-400/30 shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
              : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.05]'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>3. Gợi Ý AI</span>
        </button>

        {screenshotCount > 0 && (
          <button
            type="button"
            onClick={() => onDetailTabChange('screenshots')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border cursor-pointer select-none active:scale-[0.98]',
              detailTab === 'screenshots'
                ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white border-cyan-400/30 shadow-[0_2px_10px_rgba(6,182,212,0.35)]'
                : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.05]'
            )}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-300" />
            <span>4. Ảnh Màn Hình ({screenshotCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onDetailTabChange('split')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border cursor-pointer select-none active:scale-[0.98]',
            detailTab === 'split'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-400/30 shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
              : 'text-white/50 border-transparent hover:text-white/90 hover:bg-white/[0.05]'
          )}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>5. Chia Đôi (50:50)</span>
        </button>
      </div>
    </div>
  )
}

