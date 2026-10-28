import { useState, useCallback } from 'react'
import type { AppMode } from '@/types/electron.d'
import type { TranscriptLine } from '../types'
import {
  assembleLatestExchange,
  type AssembledExchange as ScannedExchangeResult,
} from '@/services/ai-model/copilot/exchangeAssembler'

export interface UseExchangeScanReturn {
  latestExchange: ScannedExchangeResult | null
  isScanningExchange: boolean
  setLatestExchange: React.Dispatch<React.SetStateAction<ScannedExchangeResult | null>>
  scanExchange: (lines: TranscriptLine[], mode: AppMode) => ScannedExchangeResult | null
  resetExchange: () => void
}

export function useExchangeScan(): UseExchangeScanReturn {
  const [latestExchange, setLatestExchange] = useState<ScannedExchangeResult | null>(null)
  const [isScanningExchange, setIsScanningExchange] = useState(false)

  const scanExchange = useCallback((lines: TranscriptLine[], mode: AppMode): ScannedExchangeResult | null => {
    if (lines.length === 0) {
      setLatestExchange(null)
      return null
    }

    setIsScanningExchange(true)
    try {
      const scanned = assembleLatestExchange(lines, mode)
      setLatestExchange(scanned)
      return scanned
    } finally {
      setIsScanningExchange(false)
    }
  }, [])

  const resetExchange = useCallback(() => {
    setLatestExchange(null)
  }, [])

  return {
    latestExchange,
    isScanningExchange,
    setLatestExchange,
    scanExchange,
    resetExchange,
  }
}
