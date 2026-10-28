import { useState, useEffect, useRef, useCallback } from 'react'
import {
  enumerateSystemAudioDevices,
  getSavedAudioDeviceId,
  saveAudioDeviceId,
  type AudioDeviceInfo,
} from '@/services/audio-devices'

export interface UseAudioDeviceSelectionReturn {
  audioDevices: AudioDeviceInfo[]
  selectedDeviceId: string
  currentAudioDevice: AudioDeviceInfo | undefined
  isScanningDevices: boolean
  isAudioDropdownOpen: boolean
  audioDropdownRef: React.RefObject<HTMLDivElement | null>
  setIsAudioDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  handleDeviceChange: (deviceId: string) => void
  handleRefreshDevices: () => Promise<void>
}

export function useAudioDeviceSelection(): UseAudioDeviceSelectionReturn {
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(getSavedAudioDeviceId)
  const [isScanningDevices, setIsScanningDevices] = useState(false)
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false)
  const audioDropdownRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    let mounted = true
    enumerateSystemAudioDevices().then((devs) => {
      if (mounted) setAudioDevices(devs)
    })
    return () => {
      mounted = false
      isMountedRef.current = false
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (audioDropdownRef.current && !audioDropdownRef.current.contains(event.target as Node)) {
        setIsAudioDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDeviceChange = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    saveAudioDeviceId(deviceId)
    setIsAudioDropdownOpen(false)
  }, [])

  const handleRefreshDevices = useCallback(async () => {
    setIsScanningDevices(true)
    const devs = await enumerateSystemAudioDevices()
    if (isMountedRef.current) {
      setAudioDevices(devs)
      setTimeout(() => {
        if (isMountedRef.current) setIsScanningDevices(false)
      }, 450)
    }
  }, [])

  const currentAudioDevice =
    audioDevices.find((d) => d.deviceId === selectedDeviceId) || audioDevices[0]

  return {
    audioDevices,
    selectedDeviceId,
    currentAudioDevice,
    isScanningDevices,
    isAudioDropdownOpen,
    audioDropdownRef,
    setIsAudioDropdownOpen,
    handleDeviceChange,
    handleRefreshDevices,
  }
}
