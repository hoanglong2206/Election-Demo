import { Home, MessageSquare, Headphones, Zap, FileText, Coins, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ViewState } from './Layout'

interface SidebarProps {
  currentView: ViewState
  onViewChange: (view: ViewState) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-14 flex flex-col items-center py-4 border-r border-white/[0.07] bg-white/[0.02] shrink-0">
      <div className="flex flex-col gap-3 w-full px-2">
        <Button
          variant="ghost"
          size="icon"
          title="Trang chủ & Cài đặt nhanh"
          onClick={() => onViewChange('home')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'home'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/35 shadow-[0_0_15px_rgba(139,92,246,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <Home className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Meeting Copilot"
          onClick={() => onViewChange('meeting')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'meeting'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/35 shadow-[0_0_15px_rgba(139,92,246,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Kiểm tra thu âm & Live STT"
          onClick={() => onViewChange('audio-test')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'audio-test'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-[0_0_15px_rgba(16,185,129,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <Headphones className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Đo tốc độ AI & Test Chụp màn hình"
          onClick={() => onViewChange('ai-diagnostic')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'ai-diagnostic'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35 shadow-[0_0_15px_rgba(245,158,11,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <Zap className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Lịch sử cuộc họp (Session History)"
          onClick={() => onViewChange('history')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'history'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/35 shadow-[0_0_15px_rgba(139,92,246,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <FileText className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Theo dõi Chi phí & Token Usage"
          onClick={() => onViewChange('cost-tracker')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'cost-tracker'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shadow-[0_0_15px_rgba(16,185,129,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <Coins className="w-5 h-5" />
        </Button>
      </div>

      <div className="mt-auto px-2 w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewChange('settings')}
          className={cn(
            'w-10 h-10 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
            currentView === 'settings'
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/35 shadow-[0_0_15px_rgba(139,92,246,0.25)] scale-[1.04]'
              : 'text-white/40 hover:text-white hover:bg-white/10'
          )}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </aside>
  )
}
