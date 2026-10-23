import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'
type ToastMessage = { id: number; type: ToastType; message: string }
const TOAST_EVENT = 'app:toast'
let nextToastId = 0

export function showToast(message: string, type: ToastType = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { id: ++nextToastId, type, message } }))
  }
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const onToast = (event: Event) => {
      const toast = (event as CustomEvent<ToastMessage>).detail
      if (!toast?.message) return
      setToasts((current) => [...current.filter((item) => item.type !== 'loading'), toast].slice(-4))
      if (toast.type !== 'loading') {
        window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4500)
      }
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,560px)] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' || toast.type === 'warning' ? AlertCircle : toast.type === 'loading' ? LoaderCircle : Info
        const tone = toast.type === 'success'
          ? 'border-emerald-500/35 text-emerald-400'
          : toast.type === 'error'
          ? 'border-rose-500/35 text-rose-400'
          : toast.type === 'warning'
          ? 'border-amber-500/35 text-amber-400'
          : 'border-violet-500/35 text-violet-400'
        return (
          <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={cn('pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-[#0b1020]/95 px-4 py-3 text-[12px] text-white shadow-2xl backdrop-blur-xl animate-fade-in', tone)}>
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', toast.type === 'loading' && 'animate-spin')} />
            <span className="min-w-0 flex-1 leading-relaxed">{toast.message}</span>
            <button type="button" aria-label="Đóng thông báo" className="-mr-1 shrink-0 rounded p-0.5 text-white/45 hover:bg-white/10 hover:text-white" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
