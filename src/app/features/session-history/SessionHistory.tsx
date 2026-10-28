import { useState } from 'react'
import type { DetailTab } from './types'
import { SessionHeader } from './components/header'
import { SessionSidebar } from './components/sidebar'
import { SessionDetailView } from './components/detail'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useSessionHistoryData,
  useSessionFilter,
  useSessionHistoryActions,
} from './hooks'

export function SessionHistory() {
  const [detailTab, setDetailTab] = useState<DetailTab>('timeline')

  // 1. Data Loading & Persistence
  const {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    currentSession,
    retentionDays,
    handleRetentionChange,
  } = useSessionHistoryData()

  // 2. Multi-Filter & Search
  const {
    searchTerm,
    setSearchTerm,
    modeFilter,
    setModeFilter,
    dateFilter,
    setDateFilter,
    profileFilter,
    setProfileFilter,
    availableProfiles,
    filteredSessions,
  } = useSessionFilter(sessions)

  // 3. Selection, Deletion, and Actions
  const {
    isSelectMode,
    selectedSessionIds,
    deleteTarget,
    copiedId,
    isEditingTitle,
    setIsEditingTitle,
    handleDeleteSingle,
    handleDeleteSelected,
    handleClearAll,
    handleToggleSelectMode,
    handleToggleSelectSession,
    handleToggleSelectAll,
    handleConfirmDelete,
    handleCancelDelete,
    handleCopyText,
    handleRenameSession,
    handleStartRename,
  } = useSessionHistoryActions({
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    filteredSessions,
  })

  return (
    <div className="flex flex-col h-full p-3.5 overflow-hidden gap-2.5 animate-fade-in select-none">
      <SessionHeader
        totalSessions={sessions.length}
        currentSession={currentSession}
        onClearAll={handleClearAll}
        retentionDays={retentionDays}
        onRetentionDaysChange={handleRetentionChange}
      />

      <div className="flex flex-1 min-h-0 gap-2.5 overflow-hidden">
        <SessionSidebar
          sessions={sessions}
          filteredSessions={filteredSessions}
          selectedSessionId={selectedSessionId}
          searchTerm={searchTerm}
          modeFilter={modeFilter}
          dateFilter={dateFilter}
          profileFilter={profileFilter}
          availableProfiles={availableProfiles}
          onSelectSession={setSelectedSessionId}
          onSearchChange={setSearchTerm}
          onModeFilterChange={setModeFilter}
          onDateFilterChange={setDateFilter}
          onProfileFilterChange={setProfileFilter}
          onDeleteSession={handleDeleteSingle}
          onStartRename={handleStartRename}
          isSelectMode={isSelectMode}
          selectedSessionIds={selectedSessionIds}
          onToggleSelectMode={handleToggleSelectMode}
          onToggleSelectSession={handleToggleSelectSession}
          onToggleSelectAll={handleToggleSelectAll}
          onDeleteSelected={handleDeleteSelected}
        />

        <SessionDetailView
          currentSession={currentSession}
          detailTab={detailTab}
          copiedId={copiedId}
          onDetailTabChange={setDetailTab}
          onCopyText={handleCopyText}
          onRenameSession={handleRenameSession}
          isEditingTitleExternal={isEditingTitle}
          onFinishRename={() => setIsEditingTitle(false)}
        />
      </div>

      {/* Unified delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === 'all'
            ? 'Xóa toàn bộ lịch sử cuộc họp?'
            : deleteTarget?.type === 'bulk'
            ? `Xóa ${deleteTarget.ids.length} phiên họp đã chọn?`
            : 'Xóa bản ghi cuộc họp?'
        }
        description={
          deleteTarget?.type === 'all'
            ? `Tất cả ${deleteTarget.count} phiên họp trong lịch sử sẽ bị xóa vĩnh viễn và không thể khôi phục.`
            : deleteTarget?.type === 'bulk'
            ? `Toàn bộ transcript và gợi ý AI của ${deleteTarget.ids.length} phiên họp đã chọn sẽ bị xóa vĩnh viễn.`
            : deleteTarget?.type === 'single'
            ? `"${deleteTarget.session.title}" sẽ bị xóa vĩnh viễn và không thể khôi phục.`
            : 'Bản ghi này sẽ bị xóa vĩnh viễn và không thể khôi phục.'
        }
        confirmLabel={
          deleteTarget?.type === 'all'
            ? `Xóa tất cả (${deleteTarget.count})`
            : deleteTarget?.type === 'bulk'
            ? `Xóa ${deleteTarget.ids.length} phiên`
            : 'Xóa vĩnh viễn'
        }
        cancelLabel="Giữ lại"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
