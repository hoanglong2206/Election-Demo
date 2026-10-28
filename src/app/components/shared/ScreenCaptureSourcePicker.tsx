import { AppWindow, Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { capturePort } from '@/infrastructure/ipc'

export interface DesktopSource {
  id: string
  name: string
}

export interface ScreenCaptureSourcePickerProps {
  onSelect: (source: { sourceType: 'screen' | 'window'; sourceId?: string }) => void
  onCancel: () => void
}

export function ScreenCaptureSourcePicker({ onSelect, onCancel }: ScreenCaptureSourcePickerProps) {
  const [windows, setWindows] = useState<DesktopSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  useEffect(() => {
    let mounted = true
    const loadSources = async () => {
      try {
        const sources = await capturePort.getDesktopSources(['window'])
        if (mounted) setWindows(sources || [])
      } catch (error) {
        console.error('[ScreenCaptureSourcePicker] Không thể tải danh sách cửa sổ:', error)
        if (mounted) setLoadError('Không thể tải danh sách cửa sổ. Bạn có thể chọn toàn màn hình.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void loadSources()
    return () => {
      mounted = false
    }
  }, [])

  const content = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-[min(560px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#16161d] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Chọn nguồn chụp màn hình</h2>
            <p className="mt-1 text-[11px] text-white/45">Sau khi chọn, bạn có thể kéo để cắt vùng cần AI phân tích.</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Hủy">
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => onSelect({ sourceType: 'screen' })}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left transition hover:bg-emerald-500/20"
        >
          <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white">Toàn màn hình chính</div>
            <div className="text-[11px] text-white/50">Chụp toàn bộ không gian làm việc hiện tại</div>
          </div>
        </button>

        <div className="mb-2 text-[11px] font-medium text-white/50">Hoặc chọn một cửa sổ ứng dụng:</div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-white/40">Đang quét danh sách cửa sổ...</div>
        ) : loadError ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">{loadError}</div>
        ) : windows.length === 0 ? (
          <div className="py-6 text-center text-xs text-white/40">Không tìm thấy cửa sổ ứng dụng nào khả dụng.</div>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
            {windows.map((w) => (
              <button
                key={w.id}
                onClick={() => onSelect({ sourceType: 'window', sourceId: w.id })}
                className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
              >
                <div className="rounded-lg bg-white/5 p-2 text-white/60">
                  <AppWindow className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-white/90">{w.name}</div>
                  <div className="font-mono text-[10px] text-white/35">ID: {w.id}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const portalTarget = typeof document !== 'undefined' ? document.body : null
  return portalTarget ? createPortal(content, portalTarget) : content
}
