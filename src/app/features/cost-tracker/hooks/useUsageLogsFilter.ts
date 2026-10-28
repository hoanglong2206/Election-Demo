import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { usageTrackerService, type UsageRecord } from '@/services/usage-tracker'
import { filterUsageRecords } from '../utils/costAggregation'

export interface UseUsageLogsFilterProps {
  initialRecords?: UsageRecord[]
  pageSize?: number
}

export function useUsageLogsFilter({
  initialRecords,
  pageSize = 50,
}: UseUsageLogsFilterProps = {}) {
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [records, setRecords] = useState<UsageRecord[]>(() =>
    initialRecords || usageTrackerService.getAllRecords(pageSize)
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedFeature, setSelectedFeature] = useState<string>('all')
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(() =>
    initialRecords ? initialRecords.length : records.length
  )

  const [prevInitial, setPrevInitial] = useState(initialRecords)
  if (initialRecords !== prevInitial) {
    setPrevInitial(initialRecords)
    if (initialRecords) {
      setRecords(initialRecords)
      setTotalCount(initialRecords.length)
    }
  }

  // Query initial page on mount or when provider changes (if initialRecords not provided)
  useEffect(() => {
    if (initialRecords) return

    let isCancelled = false
    void (async () => {
      try {
        const res = await usageTrackerService.queryPagedRecords({
          limit: pageSize,
          provider: selectedProvider !== 'all' ? selectedProvider : undefined,
        })
        if (!isCancelled && isMountedRef.current) {
          setRecords(res.records)
          setNextCursor(res.nextCursor)
          setHasMore(res.hasMore)
          setTotalCount(res.total)
        }
      } catch {
        // Ignore fallback
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [selectedProvider, initialRecords, pageSize])

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const res = await usageTrackerService.queryPagedRecords({
        cursor: nextCursor,
        limit: pageSize,
        provider: selectedProvider !== 'all' ? selectedProvider : undefined,
      })
      if (isMountedRef.current) {
        setRecords((prev) => [...prev, ...res.records])
        setNextCursor(res.nextCursor)
        setHasMore(res.hasMore)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false)
      }
    }
  }, [hasMore, nextCursor, isLoadingMore, selectedProvider, pageSize])

  const filteredRecords = useMemo(() => {
    return filterUsageRecords(records, searchQuery, selectedProvider, selectedFeature)
  }, [records, searchQuery, selectedProvider, selectedFeature])

  const uniqueProviders = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => {
      if (r.provider) set.add(r.provider)
    })
    return Array.from(set).sort()
  }, [records])

  const uniqueFeatures = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => {
      if (r.feature) set.add(r.feature)
    })
    return Array.from(set).sort()
  }, [records])

  return {
    records,
    filteredRecords,
    searchQuery,
    setSearchQuery,
    selectedProvider,
    setSelectedProvider,
    selectedFeature,
    setSelectedFeature,
    hasMore,
    isLoadingMore,
    totalCount,
    handleLoadMore,
    uniqueProviders,
    uniqueFeatures,
  }
}
