import { useState, useReducer, useRef, useEffect, useCallback } from 'react'
import {
  deleteSessionFromHistory,
  deleteMultipleSessionsFromHistory,
  clearAllSessionsFromHistory,
  renameSessionInHistory,
  type MeetingSession,
} from '@/services/session-history'
import {
  sessionSelectionReducer,
  initialSessionSelectionState,
  type DeleteTarget,
} from '../reducers/sessionSelectionReducer'

export interface UseSessionHistoryActionsProps {
  sessions: MeetingSession[]
  setSessions: React.Dispatch<React.SetStateAction<MeetingSession[]>>
  selectedSessionId: string
  setSelectedSessionId: React.Dispatch<React.SetStateAction<string>>
  filteredSessions: MeetingSession[]
}

export interface UseSessionHistoryActionsReturn {
  isSelectMode: boolean
  selectedSessionIds: Set<string>
  deleteTarget: DeleteTarget
  copiedId: number | null
  isEditingTitle: boolean
  setIsEditingTitle: React.Dispatch<React.SetStateAction<boolean>>
  handleDeleteSingle: (id: string, e: React.MouseEvent) => void
  handleDeleteSelected: () => void
  handleClearAll: () => void
  handleToggleSelectMode: () => void
  handleToggleSelectSession: (id: string) => void
  handleToggleSelectAll: () => void
  handleConfirmDelete: () => void
  handleCancelDelete: () => void
  handleCopyText: (text: string, id: number) => void
  handleRenameSession: (id: string, newTitle: string) => void
  handleStartRename: (id: string) => void
}

export function useSessionHistoryActions({
  sessions,
  setSessions,
  selectedSessionId,
  setSelectedSessionId,
  filteredSessions,
}: UseSessionHistoryActionsProps): UseSessionHistoryActionsReturn {
  const [selectionState, dispatch] = useReducer(
    sessionSelectionReducer,
    initialSessionSelectionState
  )

  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const handleDeleteSingle = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const session = sessions.find((s) => s.id === id)
      if (session) {
        dispatch({ type: 'SET_DELETE_TARGET', target: { type: 'single', session } })
      }
    },
    [sessions]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectionState.selectedSessionIds.size === 0) return
    dispatch({
      type: 'SET_DELETE_TARGET',
      target: { type: 'bulk', ids: Array.from(selectionState.selectedSessionIds) },
    })
  }, [selectionState.selectedSessionIds])

  const handleClearAll = useCallback(() => {
    if (sessions.length === 0) return
    dispatch({
      type: 'SET_DELETE_TARGET',
      target: { type: 'all', count: sessions.length },
    })
  }, [sessions.length])

  const handleToggleSelectMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_SELECT_MODE' })
  }, [])

  const handleToggleSelectSession = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECT_SESSION', id })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    dispatch({
      type: 'TOGGLE_SELECT_ALL',
      allIds: filteredSessions.map((s) => s.id),
    })
  }, [filteredSessions])

  const handleConfirmDelete = useCallback(() => {
    const target = selectionState.deleteTarget
    if (!target) return
    setIsEditingTitle(false)

    if (target.type === 'single') {
      const updated = deleteSessionFromHistory(target.session.id)
      setSessions(updated)
      if (selectedSessionId === target.session.id) {
        setSelectedSessionId(updated.length > 0 ? updated[0].id : '')
      }
      dispatch({ type: 'REMOVE_IDS_FROM_SELECTION', ids: [target.session.id] })
    } else if (target.type === 'bulk') {
      const updated = deleteMultipleSessionsFromHistory(target.ids)
      setSessions(updated)
      dispatch({ type: 'CLEAR_SELECTION' })
      if (target.ids.includes(selectedSessionId)) {
        setSelectedSessionId(updated.length > 0 ? updated[0].id : '')
      }
    } else if (target.type === 'all') {
      const updated = clearAllSessionsFromHistory()
      setSessions(updated)
      setSelectedSessionId('')
      dispatch({ type: 'CLEAR_SELECTION' })
    }

    dispatch({ type: 'CLEAR_DELETE_TARGET' })
  }, [
    selectionState.deleteTarget,
    selectedSessionId,
    setSessions,
    setSelectedSessionId,
  ])

  const handleCancelDelete = useCallback(() => {
    dispatch({ type: 'CLEAR_DELETE_TARGET' })
  }, [])

  const handleCopyText = useCallback((text: string, id: number) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const handleRenameSession = useCallback(
    (id: string, newTitle: string) => {
      const updated = renameSessionInHistory(id, newTitle)
      setSessions(updated)
    },
    [setSessions]
  )

  const handleStartRename = useCallback(
    (id: string) => {
      setSelectedSessionId(id)
      setIsEditingTitle(true)
    },
    [setSelectedSessionId]
  )

  return {
    isSelectMode: selectionState.isSelectMode,
    selectedSessionIds: selectionState.selectedSessionIds,
    deleteTarget: selectionState.deleteTarget,
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
  }
}

