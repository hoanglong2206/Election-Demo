import { Trash2, X, CheckSquare } from 'lucide-react'

export interface SidebarBulkActionsBarProps {
  isSelectMode: boolean
  isAllSelected: boolean
  selectedCount: number
  totalFilteredCount: number
  onToggleSelectMode: () => void
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}

export function SidebarBulkActionsBar({
  isSelectMode,
  isAllSelected,
  selectedCount,
  totalFilteredCount,
  onToggleSelectMode,
  onToggleSelectAll,
  onDeleteSelected,
}: SidebarBulkActionsBarProps) {
  if (isSelectMode) {
    return (
      <div className="flex items-center justify-between bg-violet-600/15 border border-violet-500/30 rounded-lg px-2 py-1 text-[10.5px] animate-fade-in shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onToggleSelectAll}
            className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-violet-600 focus:ring-0 cursor-pointer accent-violet-600"
          />
          <span className="text-violet-200 font-semibold text-[10px]">
            {selectedCount === 0
              ? 'Chọn tất cả'
              : `Đã chọn ${selectedCount}/${totalFilteredCount}`}
          </span>
        </label>

        <div className="flex items-center gap-1">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/35 px-1.5 py-0.5 rounded text-[9.5px] font-medium transition-colors"
              title="Xóa các phiên đã chọn (Bulk Delete)"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Xóa ({selectedCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSelectMode}
            className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors"
            title="Thoát chế độ chọn"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  if (totalFilteredCount > 0) {
    return (
      <div className="flex items-center justify-between text-[10px] text-white/45 px-1 pt-0.5 shrink-0">
        <span>{totalFilteredCount} phiên phù hợp</span>
        <button
          type="button"
          onClick={onToggleSelectMode}
          className="flex items-center gap-1 text-white/45 hover:text-violet-300 transition-colors font-medium"
          title="Bật chế độ chọn nhiều để xóa hàng loạt"
        >
          <CheckSquare className="w-3 h-3 text-violet-400" />
          <span>Chọn nhiều</span>
        </button>
      </div>
    )
  }

  return null
}

