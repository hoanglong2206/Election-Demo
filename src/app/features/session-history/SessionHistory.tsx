import { useState, useMemo, useEffect, useRef } from 'react'
import {
  getSavedSessions,
  initSessionStorage,
  loadFullSession,
  subscribeSessions,
  deleteSessionFromHistory,
  deleteMultipleSessionsFromHistory,
  clearAllSessionsFromHistory,
  renameSessionInHistory,
  searchAndFilterSessions,
  getSavedRetentionDays,
  saveRetentionDays,
  applySessionRetention,
  type MeetingSession,
  type SessionDateFilter,
} from '../../services/sessionHistory'
import { profilePresetRepository } from '../../services/profile-preset'
import type { DetailTab, ModeFilter } from './types'
import { SessionHeader } from './components/SessionHeader'
import { SessionSidebar } from './components/SessionSidebar'
import { SessionDetailView } from './components/SessionDetailView'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'

type DeleteTarget =
  | { type: 'single'; session: MeetingSession }
  | { type: 'bulk'; ids: string[] }
  | { type: 'all'; count: number }
  | null

export function SessionHistory() {
  const [sessions, setSessions] = useState<MeetingSession[]>(() => getSavedSessions())
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    const list = getSavedSessions()
    return list.length > 0 ? list[0].id : ''
  })

  // Search & Multi-filters
  const [searchTerm, setSearchTerm] = useState('')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [dateFilter, setDateFilter] = useState<SessionDateFilter>('all')
  const [profileFilter, setProfileFilter] = useState<string>('all')

  // Available profiles for filtering
  const [availableProfiles] = useState<{ id: string; name: string }[]>(() =>
    profilePresetRepository.getAll().map((p) => ({ id: p.id, name: p.name }))
  )

  // Local storage retention setting
  const [retentionDays, setRetentionDays] = useState<number>(() => getSavedRetentionDays())

  // Detail View
  const [detailTab, setDetailTab] = useState<DetailTab>('timeline')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Bulk selection state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())

  // Unified delete target (single / bulk / all)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)

  useEffect(() => {
    let isSubscribed = true

    const unsubscribe = subscribeSessions((updated) => {
      if (!isSubscribed) return
      setSessions([...updated])
      if (updated.length > 0) {
        setSelectedSessionId((curr) => {
          if (!curr || !updated.some((s) => s.id === curr)) {
            return updated[0].id
          }
          return curr
        })
      } else {
        setSelectedSessionId('')
      }
    })

    initSessionStorage().then((loaded) => {
      if (!isSubscribed) return
      setSessions(loaded)
      if (loaded.length > 0) {
        setSelectedSessionId((curr) => {
          if (!curr || !loaded.some((s) => s.id === curr)) {
            return loaded[0].id
          }
          return curr
        })
      }
    })

    return () => {
      isSubscribed = false
      unsubscribe()
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Multi-attribute filtering & Full-text search
  const filteredSessions = useMemo(() => {
    void sessions.length
    return searchAndFilterSessions({
      searchTerm,
      mode: modeFilter,
      profileId: profileFilter,
      dateRange: dateFilter,
    })
  }, [sessions, searchTerm, modeFilter, profileFilter, dateFilter])

  const currentSession = useMemo(() => {
    const selected = sessions.find((s) => s.id === selectedSessionId)
    if (selected) return selected
    return selectedSessionId ? null : filteredSessions[0] || null
  }, [sessions, selectedSessionId, filteredSessions])

  // Lazy-load full session details (transcripts & suggestions) on demand
  useEffect(() => {
    if (!selectedSessionId) return
    const current = sessions.find((s) => s.id === selectedSessionId)
    if (current && !current._isFullyLoaded) {
      loadFullSession(selectedSessionId).then((full) => {
        if (full) {
          setSessions((prev) => prev.map((s) => (s.id === full.id ? full : s)))
        }
      })
    }
  }, [selectedSessionId, sessions])

  const handleDeleteSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const session = sessions.find((s) => s.id === id)
    if (session) {
      setDeleteTarget({ type: 'single', session })
    }
  }

  const handleDeleteSelected = () => {
    if (selectedSessionIds.size === 0) return
    setDeleteTarget({ type: 'bulk', ids: Array.from(selectedSessionIds) })
  }

  const handleClearAll = () => {
    if (sessions.length === 0) return
    setDeleteTarget({ type: 'all', count: sessions.length })
  }

  const handleToggleSelectMode = () => {
    setIsSelectMode((prev) => {
      const next = !prev
      if (!next) {
        setSelectedSessionIds(new Set())
      }
      return next
    })
  }

  const handleToggleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set())
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map((s) => s.id)))
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    setIsEditingTitle(false)

    if (deleteTarget.type === 'single') {
      const updated = deleteSessionFromHistory(deleteTarget.session.id)
      setSessions(updated)
      if (selectedSessionId === deleteTarget.session.id) {
        setSelectedSessionId(updated.length > 0 ? updated[0].id : '')
      }
      if (selectedSessionIds.has(deleteTarget.session.id)) {
        setSelectedSessionIds((prev) => {
          const next = new Set(prev)
          next.delete(deleteTarget.session.id)
          return next
        })
      }
    } else if (deleteTarget.type === 'bulk') {
      const updated = deleteMultipleSessionsFromHistory(deleteTarget.ids)
      setSessions(updated)
      setSelectedSessionIds(new Set())
      setIsSelectMode(false)
      if (deleteTarget.ids.includes(selectedSessionId)) {
        setSelectedSessionId(updated.length > 0 ? updated[0].id : '')
      }
    } else if (deleteTarget.type === 'all') {
      const updated = clearAllSessionsFromHistory()
      setSessions(updated)
      setSelectedSessionId('')
      setSelectedSessionIds(new Set())
      setIsSelectMode(false)
    }

    setDeleteTarget(null)
  }

  const handleCancelDelete = () => {
    setDeleteTarget(null)
  }

  const handleCopyText = (text: string, id: number) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500)
  }

  const handleRenameSession = (id: string, newTitle: string) => {
    const updated = renameSessionInHistory(id, newTitle)
    setSessions(updated)
  }

  const handleStartRename = (id: string) => {
    setSelectedSessionId(id)
    setIsEditingTitle(true)
  }

  const handleRetentionChange = (days: number) => {
    setRetentionDays(days)
    saveRetentionDays(days)
    if (days > 0) {
      const res = applySessionRetention(days)
      setSessions([...res.remainingSessions])
    }
  }

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
