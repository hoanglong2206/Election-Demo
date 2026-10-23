import { Brain, Minus, Maximize, X, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface HeaderProps {
  opacity: number
  onOpacityChange: (opacity: number) => void
  onMinimizeStart: () => void
  onMaximizeStart: () => void
}

export function Header({ opacity, onOpacityChange, onMinimizeStart, onMaximizeStart }: HeaderProps) {
  // Default true — matches the alwaysOnTop: true set in main.ts at startup
  const [isPinned, setIsPinned] = useState(true)

  const handleMinimize = () => {
    onMinimizeStart()
    setTimeout(() => {
      window.api?.minimize()
    }, 300)
  }
  const handleMaximize = () => {
    onMaximizeStart()
    setTimeout(() => {
      window.api?.maximize()
    }, 300)
  }
  const handleClose = () => window.api?.close()
  const handlePinToggle = async () => {
    const newState = await window.api?.toggleAlwaysOnTop()
    setIsPinned(newState ?? !isPinned)
  }

  return (
    <header
      className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: App identity */}
      <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">
          Copilot
        </span>
      </div>

      {/* Right: Window controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
          className="w-16 mx-1 accent-violet-500 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
          title="Adjust Opacity"
        />

        {/* Always-on-top toggle */}
        <Button
          id="btn-pin"
          variant="ghost"
          size="icon"
          onClick={handlePinToggle}
          title={isPinned ? 'Đang ghim: luôn hiển thị trên cùng — bấm để bỏ ghim' : 'Không ghim: bị che khi chuyển app — bấm để ghim lên trên'}
          className={cn(
            'w-6 h-6 rounded-md transition-all duration-200',
            isPinned
              ? 'text-violet-400 bg-violet-500/15 hover:text-violet-300 hover:bg-violet-500/25 shadow-[0_0_8px_rgba(139,92,246,0.25)]'
              : 'text-white/35 hover:text-white/70 hover:bg-white/10'
          )}
        >
          {isPinned
            ? <Pin className="w-3.5 h-3.5" />
            : <PinOff className="w-3.5 h-3.5" />
          }
        </Button>

        <Button
          id="btn-minimize"
          variant="ghost"
          size="icon"
          onClick={handleMinimize}
          className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <Button
          id="btn-maximize"
          variant="ghost"
          size="icon"
          onClick={handleMaximize}
          className="w-6 h-6 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Maximize className="w-3.5 h-3.5" />
        </Button>
        <Button
          id="btn-close"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="w-6 h-6 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  )
}
