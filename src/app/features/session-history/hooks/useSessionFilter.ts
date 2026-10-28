import { useState, useMemo } from 'react'
import {
  searchAndFilterSessions,
  type MeetingSession,
  type SessionDateFilter,
} from '@/services/sessionHistory'
import { profilePresetRepository } from '@/services/profile-preset'
import type { ModeFilter } from '../types'

export interface ProfileFilterOption {
  id: string
  name: string
}

export interface UseSessionFilterReturn {
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  modeFilter: ModeFilter
  setModeFilter: React.Dispatch<React.SetStateAction<ModeFilter>>
  dateFilter: SessionDateFilter
  setDateFilter: React.Dispatch<React.SetStateAction<SessionDateFilter>>
  profileFilter: string
  setProfileFilter: React.Dispatch<React.SetStateAction<string>>
  availableProfiles: ProfileFilterOption[]
  filteredSessions: MeetingSession[]
}

export function useSessionFilter(sessions: MeetingSession[]): UseSessionFilterReturn {
  const [searchTerm, setSearchTerm] = useState('')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [dateFilter, setDateFilter] = useState<SessionDateFilter>('all')
  const [profileFilter, setProfileFilter] = useState<string>('all')

  // Available profiles for filtering
  const [availableProfiles] = useState<ProfileFilterOption[]>(() =>
    profilePresetRepository.getAll().map((p) => ({ id: p.id, name: p.name }))
  )

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

  return {
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
  }
}

