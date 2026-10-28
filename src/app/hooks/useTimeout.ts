import { useEffect, useRef } from 'react'

export function useTimeout(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delayMs === null || delayMs < 0) return
    const id = setTimeout(() => savedCallback.current(), delayMs)
    return () => clearTimeout(id)
  }, [delayMs])
}

