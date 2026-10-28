import { type ReactNode, useState, useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'
import { ToastHost } from '@/components/ui/toast'
import { windowPort } from '@/infrastructure/ipc'
import type { ViewState } from './types'
export type { ViewState }

interface LayoutProps {
  children: ReactNode
  currentView: ViewState
  onViewChange: (view: ViewState) => void
}

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const [opacity, setOpacity] = useState(1)
  const [isMinimizing, setIsMinimizing] = useState(false)
  const [isMaximizing, setIsMaximizing] = useState(false)

  useEffect(() => {
    // Listen for restore event from Electron to reverse the minimize/maximize animation
    const unsubscribe = windowPort.onRestore(() => {
      setIsMinimizing(false)
      setIsMaximizing(false)
    })
    return () => unsubscribe?.()
  }, [])

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-transparent select-none">
      <ToastHost />
      {/* ── Glassmorphism container ── */}
      <div
        className={cn(
          'flex flex-col h-full rounded-2xl overflow-hidden',
          'backdrop-blur-2xl',
          'border border-white/10',
          'shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_0.5px_rgba(255,255,255,0.06)]',
          'transition-all duration-300 ease-in-out',
          isMinimizing 
            ? 'opacity-0 scale-90 translate-y-10' 
            : isMaximizing 
              ? 'opacity-0 scale-105' 
              : 'opacity-100 scale-100 translate-y-0'
        )}
        style={{ backgroundColor: `rgba(3, 7, 18, ${opacity})` }}
      >
        <Header 
          opacity={opacity} 
          onOpacityChange={setOpacity} 
          onMinimizeStart={() => setIsMinimizing(true)}
          onMaximizeStart={() => setIsMaximizing(true)}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentView={currentView} onViewChange={onViewChange} />
          <main className="flex-1 overflow-hidden relative flex flex-col bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
