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

  const snapshot = unfinishedRecovery.snapshot
  const title = snapshot?.title || 'Cuộc họp trước'
  const count = snapshot?.transcripts?.length || unfinishedRecovery.eventCount || 0

  return (
    <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 animate-fade-in shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="truncate">
          Phát hiện phiên họp chưa hoàn thành: <strong className="text-amber-300 font-medium">"{title}"</strong> ({count} câu thoại)
        </span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          className="rounded bg-amber-300 hover:bg-amber-200 px-2.5 py-1 text-black font-medium transition-colors cursor-pointer"
          onClick={onRestore}
        >
          Khôi phục
        </button>
        <button
          type="button"
          className="rounded border border-white/20 hover:bg-white/10 px-2.5 py-1 transition-colors cursor-pointer"
          onClick={onFinalize}
        >
          Hoàn tất
        </button>
        <button
          type="button"
          className="rounded border border-red-300/30 hover:bg-red-500/20 px-2.5 py-1 text-red-200 transition-colors cursor-pointer"
          onClick={onDiscard}
        >
          Bỏ qua
        </button>
      </div>
    </div>
  )
}
