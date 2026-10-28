import { UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewState } from '@/components/layout/types'

export interface MissingContextGuardProps {
  hasCV: boolean
  hasJD: boolean
  onViewChange?: (view: ViewState) => void
}

export function MissingContextGuard({
  hasCV,
  hasJD,
  onViewChange,
}: MissingContextGuardProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 animate-fade-in select-none">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
        <UserCheck className="w-7 h-7" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="text-[16px] font-bold text-white tracking-tight">
          Yêu Cầu Nạp Đầy Đủ CV & JD
        </h2>
        <p className="text-[12px] text-white/50 leading-relaxed">
          Chế độ <strong className="text-violet-400">Phỏng Vấn (Interview)</strong> yêu cầu phải có cả thông tin{' '}
          <strong className="text-emerald-400">CV / Kinh nghiệm bản thân</strong> và{' '}
          <strong className="text-emerald-400">Mô tả công việc (JD)</strong> ở Trang Chủ trước khi vào phòng họp.
        </p>
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <Badge
          variant="outline"
          className={cn(
            'px-2.5 py-1 text-[10.5px]',
            hasCV
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          )}
        >
          CV: {hasCV ? 'Đã có' : 'Chưa có'}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            'px-2.5 py-1 text-[10.5px]',
            hasJD
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          )}
        >
          JD: {hasJD ? 'Đã có' : 'Chưa có'}
        </Badge>
      </div>
      {onViewChange && (
        <Button
          id="btn-back-home"
          onClick={() => onViewChange('home')}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow-sm"
        >
          Về Trang Chủ để Bổ Sung
        </Button>
      )}
    </div>
  )
}
