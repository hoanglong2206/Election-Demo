import { useState, useEffect, useCallback, useRef } from 'react'
import {
  usageTrackerService,
  type MonthlyUsageSummary,
  type BudgetSettings,
  type UsageRecord,
  type DailyUsageItem,
} from '@/services/usage-tracker'
import type { ChartDaysRange } from '../types'
import { buildUsageCsvData, triggerCsvDownload } from '../utils/costAggregation'

export interface UseUsageTrackerOptions {
  recordsLimit?: number
}

export function useUsageTracker(options: UseUsageTrackerOptions = {}) {
  const { recordsLimit = 200 } = options

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [summary, setSummary] = useState<MonthlyUsageSummary>(() =>
    usageTrackerService.getCurrentMonthSummary()
  )
  const [budget, setBudget] = useState<BudgetSettings>(() =>
    usageTrackerService.getBudgetSettings()
  )
  const [records, setRecords] = useState<UsageRecord[]>(() =>
    usageTrackerService.getAllRecords(recordsLimit)
  )

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isResetSuccess, setIsResetSuccess] = useState(false)
  const [demoLoadedSuccess, setDemoLoadedSuccess] = useState(false)

  // Auto-subscribe to live usage updates
  useEffect(() => {
    const unsubscribe = usageTrackerService.subscribe((updatedSummary) => {
      if (isMountedRef.current) {
        setSummary(updatedSummary)
        setRecords(usageTrackerService.getAllRecords(recordsLimit))
      }
    })
    return () => unsubscribe()
  }, [recordsLimit])

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setSummary(usageTrackerService.getCurrentMonthSummary())
    setBudget(usageTrackerService.getBudgetSettings())
    setRecords(usageTrackerService.getAllRecords(recordsLimit))
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsRefreshing(false)
      }
    }, 500)
  }, [isRefreshing, recordsLimit])

  const handleSeedDemoData = useCallback(() => {
    usageTrackerService.seedDemoData()
    handleRefresh()
    setDemoLoadedSuccess(true)
    setTimeout(() => {
      if (isMountedRef.current) {
        setDemoLoadedSuccess(false)
      }
    }, 3000)
  }, [handleRefresh])

  const handleResetConfirmed = useCallback(() => {
    const ok = usageTrackerService.resetLocalStatistics(true)
    if (ok) {
      setIsResetConfirmOpen(false)
      setIsResetSuccess(true)
      handleRefresh()
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsResetSuccess(false)
        }
      }, 3000)
    }
  }, [handleRefresh])

  const handleUpdateBudget = useCallback((newSettings: Partial<BudgetSettings>) => {
    const updated = usageTrackerService.updateBudgetSettings(newSettings)
    setBudget(updated)
    return updated
  }, [])

  const handleExportCsv = useCallback(() => {
    if (records.length === 0) return
    const { csvContent, filename } = buildUsageCsvData(records)
    triggerCsvDownload(csvContent, filename)
  }, [records])

  const getDailyHistory = useCallback((days: ChartDaysRange): DailyUsageItem[] => {
    return usageTrackerService.getDailyHistory(days)
  }, [])

  return {
    summary,
    budget,
    setBudget,
    records,
    isRefreshing,
    isResetConfirmOpen,
    setIsResetConfirmOpen,
    isResetSuccess,
    demoLoadedSuccess,
    handleRefresh,
    handleSeedDemoData,
    handleResetConfirmed,
    handleUpdateBudget,
    handleExportCsv,
    getDailyHistory,
  }
}
