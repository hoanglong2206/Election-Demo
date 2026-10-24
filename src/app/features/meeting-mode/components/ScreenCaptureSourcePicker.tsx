import { AppWindow, Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DesktopSource {
  id: string
  name: string
}

interface ScreenCaptureSourcePickerProps {
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
        const sources = await window.api?.getDesktopSources?.(['window'])
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
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

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect({ sourceType: 'screen' })}
            className="flex flex-col items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/10 p-5 text-white transition hover:bg-violet-500/20"
          >
            <Monitor className="h-7 w-7 text-violet-300" />
            <span className="text-xs font-medium">Toàn màn hình</span>
            <span className="text-[10px] text-white/40">Chụp toàn bộ màn hình chính</span>
          </button>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white">
              <AppWindow className="h-4 w-4 text-blue-300" />
              Cửa sổ / tab
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {isLoading && <p className="py-3 text-center text-[10px] text-white/40">Đang tải danh sách...</p>}
              {loadError && <p className="py-3 text-center text-[10px] text-amber-300/70">{loadError}</p>}
              {!isLoading && windows.length === 0 && <p className="py-3 text-center text-[10px] text-white/40">Không tìm thấy cửa sổ.</p>}
              {windows.map((source) => (
                <button
                  key={source.id}
                  onClick={() => onSelect({ sourceType: 'window', sourceId: source.id })}
                  className="w-full truncate rounded-lg px-2.5 py-2 text-left text-[11px] text-white/75 hover:bg-white/10 hover:text-white"
                  title={source.name}
                >
                  {source.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onCancel} className="mt-4 w-full rounded-lg border border-white/10 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white">
          Hủy
        </button>
      </div>
    </div>
  )
}
