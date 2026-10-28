import { useState, useEffect, useCallback, useRef } from 'react'
import {
  profileContextService,
  type ProfilePreset,
} from '@/services/profile-preset'

export interface UseProfilePresetsReturn {
  activeProfile: ProfilePreset | null
  allProfiles: ProfilePreset[]
  handleSelectProfile: (id: string) => ProfilePreset | null
  handleOpenCreateProfile: () => void
  handleOpenEditProfile: (preset: ProfilePreset) => void
  handleSaveProfile: (data: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>) => void
  handleDuplicateProfile: (id: string) => void
  handleOpenDeleteProfile: (preset: ProfilePreset) => void
  handleConfirmDeleteProfile: () => void
  isProfileDialogOpen: boolean
  profileDialogMode: 'create' | 'edit'
  editingProfile: ProfilePreset | null
  setIsProfileDialogOpen: (open: boolean) => void
  isDeleteProfileOpen: boolean
  deletingProfile: ProfilePreset | null
  setIsDeleteProfileOpen: (open: boolean) => void
  isImportExportOpen: boolean
  setIsImportExportOpen: (open: boolean) => void
}

export function useProfilePresets(): UseProfilePresetsReturn {
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [activeProfile, setActiveProfile] = useState<ProfilePreset | null>(() =>
    profileContextService.getActiveProfile()
  )
  const [allProfiles, setAllProfiles] = useState<ProfilePreset[]>(() =>
    profileContextService.getAllProfiles()
  )

  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [profileDialogMode, setProfileDialogMode] = useState<'create' | 'edit'>('create')
  const [editingProfile, setEditingProfile] = useState<ProfilePreset | null>(null)
  const [isDeleteProfileOpen, setIsDeleteProfileOpen] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState<ProfilePreset | null>(null)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)

  useEffect(() => {
    const unsub = profileContextService.subscribe((active, all) => {
      if (!isMountedRef.current) return
      setActiveProfile(active)
      setAllProfiles(all)
    })
    return unsub
  }, [])

  const handleSelectProfile = useCallback((id: string) => {
    return profileContextService.setActiveProfile(id)
  }, [])

  const handleOpenCreateProfile = useCallback(() => {
    setProfileDialogMode('create')
    setEditingProfile(null)
    setIsProfileDialogOpen(true)
  }, [])

  const handleOpenEditProfile = useCallback((preset: ProfilePreset) => {
    setProfileDialogMode('edit')
    setEditingProfile(preset)
    setIsProfileDialogOpen(true)
  }, [])

  const handleSaveProfile = useCallback(
    (data: Omit<ProfilePreset, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (profileDialogMode === 'create') {
        profileContextService.createProfile(data)
      } else if (editingProfile) {
        profileContextService.updateProfile(editingProfile.id, data)
      }
    },
    [profileDialogMode, editingProfile]
  )

  const handleDuplicateProfile = useCallback((id: string) => {
    profileContextService.duplicateProfile(id)
  }, [])

  const handleOpenDeleteProfile = useCallback((preset: ProfilePreset) => {
    setDeletingProfile(preset)
    setIsDeleteProfileOpen(true)
  }, [])

  const handleConfirmDeleteProfile = useCallback(() => {
    if (deletingProfile) {
      profileContextService.deleteProfile(deletingProfile.id)
      setDeletingProfile(null)
    }
  }, [deletingProfile])

  return {
    activeProfile,
    allProfiles,
    handleSelectProfile,
    handleOpenCreateProfile,
    handleOpenEditProfile,
    handleSaveProfile,
    handleDuplicateProfile,
    handleOpenDeleteProfile,
    handleConfirmDeleteProfile,
    isProfileDialogOpen,
    profileDialogMode,
    editingProfile,
    setIsProfileDialogOpen,
    isDeleteProfileOpen,
    deletingProfile,
    setIsDeleteProfileOpen,
    isImportExportOpen,
    setIsImportExportOpen,
  }
}
