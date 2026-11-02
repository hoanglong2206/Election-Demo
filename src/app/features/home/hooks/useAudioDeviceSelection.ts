import { useState, useEffect, useRef, useCallback } from 'react'
import {
  enumerateSystemAudioDevices,
  getSavedAudioDeviceId,
  type AudioDeviceInfo,
} from '@/services/audio-devices'
import { settingsManager } from '@/services/settings'

export interface UseAudioDeviceSelectionReturn {
  audioDevices: AudioDeviceInfo[]
  savedDeviceId: string
  savedAudioDevice: AudioDeviceInfo
  // Legacy aliases for backward compatibility with callers/tests
  selectedDeviceId: string
  currentAudioDevice: AudioDeviceInfo
  isScanningDevices: boolean
  isAudioDropdownOpen: boolean
  audioDropdownRef: React.RefObject<HTMLDivElement | null>
  setIsAudioDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  handleDeviceChange: (deviceId: string) => void
  handleRefreshDevices: () => Promise<void>
}

export function useAudioDeviceSelection(): UseAudioDeviceSelectionReturn {
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([])
  const [savedDeviceId, setSavedDeviceId] = useState<string>(getSavedAudioDeviceId)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(getSavedAudioDeviceId)
  const [isScanningDevices, setIsScanningDevices] = useState(false)
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false)
  const audioDropdownRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  // Enumerate hardware audio devices upon mount
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

  // Keep Home synchronized whenever Settings updates
  useEffect(() => {
    const handleSync = () => {
      const saved = getSavedAudioDeviceId()
      setSavedDeviceId(saved)
      setSelectedDeviceId(saved)
    }
    window.addEventListener('storage', handleSync)
    window.addEventListener('app_settings_changed', handleSync)
    const unsub = settingsManager.subscribe(handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('app_settings_changed', handleSync)
      unsub()
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

  const fallbackDevice: AudioDeviceInfo = {
    deviceId: 'default-loopback',
    label: 'Loopback Output (Âm thanh hệ thống)',
    kind: 'audiooutput',
    type: 'system',
  }

  const savedAudioDevice =
    audioDevices.find((d) => d.deviceId === savedDeviceId) ||
    audioDevices[0] ||
    fallbackDevice

  const currentAudioDevice =
    audioDevices.find((d) => d.deviceId === selectedDeviceId) || savedAudioDevice

  return {
    audioDevices,
    savedDeviceId,
    savedAudioDevice,
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
