import { useEffect } from 'react'

export interface UseMeetingHotkeysProps {
  onTriggerScreenCapture: () => void
}

export function useMeetingHotkeys({ onTriggerScreenCapture }: UseMeetingHotkeysProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey
      if (isCmdOrCtrl && e.shiftKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) {
        e.preventDefault()
        e.stopPropagation()
        onTriggerScreenCapture()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onTriggerScreenCapture])
}
