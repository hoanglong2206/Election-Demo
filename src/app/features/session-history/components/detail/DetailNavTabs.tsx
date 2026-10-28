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
      <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
        <button
          type="button"
          onClick={() => onDetailTabChange('timeline')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
            detailTab === 'timeline'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-white/45 hover:text-white/80'
          )}
          title="Dòng thời gian hội thoại tích hợp"
        >
          <Clock className="w-3 h-3" />
          <span>1. Dòng Thời Gian</span>
        </button>

        <button
          type="button"
          onClick={() => onDetailTabChange('transcript')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
            detailTab === 'transcript'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-white/45 hover:text-white/80'
          )}
        >
          <MessageSquare className="w-3 h-3" />
          <span>2. Lời Thoại</span>
        </button>

        <button
          type="button"
          onClick={() => onDetailTabChange('suggestions')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
            detailTab === 'suggestions'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-white/45 hover:text-white/80'
          )}
        >
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span>3. Gợi Ý AI</span>
        </button>

        {screenshotCount > 0 && (
          <button
            type="button"
            onClick={() => onDetailTabChange('screenshots')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
              detailTab === 'screenshots'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-white/45 hover:text-white/80'
            )}
          >
            <Camera className="w-3 h-3 text-cyan-300" />
            <span>4. Ảnh Màn Hình ({screenshotCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onDetailTabChange('split')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-medium transition-colors',
            detailTab === 'split'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-white/45 hover:text-white/80'
          )}
        >
          <Columns className="w-3 h-3" />
          <span>5. Chia Đôi (50:50)</span>
        </button>
      </div>
    </div>
  )
}

