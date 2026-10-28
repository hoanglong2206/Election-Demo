export interface UnfinishedSessionBannerProps {
  unfinishedRecovery: any
  isOpen: boolean
  onRestore: () => void
  onFinalize: () => void
  onDiscard: () => void
}

export function UnfinishedSessionBanner({
  unfinishedRecovery,
  isOpen,
  onRestore,
  onFinalize,
  onDiscard,
}: UnfinishedSessionBannerProps) {
  if (!unfinishedRecovery || !isOpen) return null

  return (
    <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 animate-fade-in shrink-0">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>Phát hiện phiên họp chưa hoàn thành từ sự cố trước đó</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-amber-300 hover:bg-amber-200 px-2.5 py-1 text-black font-medium transition-colors"
          onClick={onRestore}
        >
          Khôi phục
        </button>
        <button
          type="button"
          className="rounded border border-white/20 hover:bg-white/10 px-2.5 py-1 transition-colors"
          onClick={onFinalize}
        >
          Hoàn tất
        </button>
        <button
          type="button"
          className="rounded border border-red-300/30 hover:bg-red-500/20 px-2.5 py-1 text-red-200 transition-colors"
          onClick={onDiscard}
        >
          Bỏ qua
        </button>
      </div>
    </div>
  )
}
