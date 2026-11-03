import React from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'

export interface TranscriptSearchBarProps {
  isOpen: boolean
  query: string
  onQueryChange: (query: string) => void
  matchCount: number
  currentIndex: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export const TranscriptSearchBar = React.memo(function TranscriptSearchBar({
  isOpen,
  query,
  onQueryChange,
  matchCount,
  currentIndex,
  onNext,
  onPrev,
  onClose,
}: TranscriptSearchBarProps) {
  if (!isOpen) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 border-b border-white/[0.08] animate-fade-in text-[10.5px] shrink-0">
      <Search className="w-3.5 h-3.5 text-violet-400 shrink-0" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Tìm kiếm nội dung hội thoại..."
        className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 text-[11px]"
        autoFocus
      />
      {query && (
        <span className="text-[9.5px] font-mono text-white/40 shrink-0">
          {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : 'Không tìm thấy'}
        </span>
      )}
      <button
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-30 transition-colors"
        title="Kết quả trước"
      >
        <ChevronUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-30 transition-colors"
        title="Kết quả tiếp"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white ml-0.5 transition-colors"
        title="Đóng tìm kiếm"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
})
