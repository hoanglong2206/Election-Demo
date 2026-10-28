import { AppWindow, Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
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

        <div className="space-y-3">
          <button
            onClick={() => onSelect({ sourceType: 'screen' })}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-violet-500/50 hover:bg-violet-500/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Toàn màn hình chính</p>
                <p className="text-[11px] text-white/40">Chụp toàn bộ màn hình hiện tại để bạn tự do khoanh vùng</p>
              </div>
            </div>
          </button>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white/70">Cửa sổ ứng dụng đang mở</span>
              {windows.length > 0 && <span className="text-[10px] text-white/35">{windows.length} cửa sổ</span>}
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-white/35">Đang nạp danh sách cửa sổ...</div>
            ) : loadError ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">{loadError}</div>
            ) : windows.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/35">Không tìm thấy cửa sổ ứng dụng nào phù hợp.</div>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {windows.map((win) => (
                  <button
                    key={win.id}
                    onClick={() => onSelect({ sourceType: 'window', sourceId: win.id })}
                    className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition hover:border-indigo-500/40 hover:bg-indigo-500/10"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AppWindow className="h-4 w-4 shrink-0 text-indigo-300" />
                      <span className="truncate text-xs text-white/80">{win.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
