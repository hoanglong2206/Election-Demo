import { useMemo } from 'react'
import {
  FileSpreadsheet,
  Search,
  Sparkles,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import type { UsageRecord } from '@/services/usage-tracker'
import { getFeatureDisplayName } from '../../types'
import { useUsageLogsFilter } from '../../hooks/useUsageLogsFilter'

export interface RecentUsageLogsTableProps {
  records?: UsageRecord[]
}

export function RecentUsageLogsTable({ records: initialRecords }: RecentUsageLogsTableProps) {
  const {
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
  } = useUsageLogsFilter({ initialRecords })

  const providerOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Tất cả Provider' },
      ...uniqueProviders.map((p) => ({ value: p, label: p })),
    ]
  }, [uniqueProviders])

  const featureOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Tất cả Tính năng' },
      ...uniqueFeatures.map((f) => ({
        value: f,
        label: getFeatureDisplayName(f),
      })),
    ]
  }, [uniqueFeatures])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${d.getDate()}/${d.getMonth() + 1}`
  }

  return (
    <Card className="bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative overflow-hidden gap-0">
      <CardHeader className="p-0 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-black/40 border border-white/[0.08] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-[13px] text-white/90 font-semibold flex items-center gap-2">
              <span>Lịch Sử Sử Dụng AI</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border font-mono bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                {filteredRecords.length} / {totalCount} bản ghi
              </Badge>
            </CardTitle>
            <p className="text-[10px] text-white/40 mt-0.5">
              Danh sách chi tiết từng lần gọi tính năng AI/STT, lượng token và chi phí ước tính thời gian thực
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-3 space-y-4">
        <div className="flex items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative w-40 sm:w-48">
            <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Tìm theo model, tính năng, nhà cung cấp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-7 pr-2 py-1 text-[10.5px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Provider Filter */}
            <div className="w-36">
              <CustomSelect
                value={selectedProvider}
                onChange={setSelectedProvider}
                options={providerOptions}
                themeColor="cyan"
                align="right"
                triggerClassName="h-7 text-[10.5px] py-1"
              />
            </div>

            {/* Feature Filter */}
            <div className="w-44">
              <CustomSelect
                value={selectedFeature}
                onChange={setSelectedFeature}
                options={featureOptions}
                themeColor="cyan"
                align="right"
                triggerClassName="h-7 text-[10.5px] py-1"
              />
            </div>
          </div>
        </div>

        <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/20">
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-white/[0.03] text-white/40 border-b border-white/[0.06] sticky top-0 text-[10px] uppercase font-mono">
                <tr>
                  <th className="py-2 px-3">Thời Gian</th>
                  <th className="py-2 px-3">Tính Năng</th>
                  <th className="py-2 px-3">Nhà Cung Cấp & Model</th>
                  <th className="py-2 px-3">Tokens (In / Out)</th>
                  <th className="py-2 px-3">Prompt Cache</th>
                  <th className="py-2 px-3">STT Audio</th>
                  <th className="py-2 px-3 text-right">Chi Phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/40 text-xs">
                      {records.length === 0
                        ? 'Chưa có lịch sử sử dụng AI nào. Hãy bắt đầu phiên làm việc để ghi nhận.'
                        : 'Không tìm thấy kết quả phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const featName = getFeatureDisplayName(r.feature)
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-white/[0.02] transition-colors font-mono text-[10.5px]"
                      >
                        <td className="py-2 px-3 text-white/50 whitespace-nowrap">
                          {formatTime(r.timestamp)}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <span className="text-white/80 font-medium truncate max-w-[150px] block" title={featName}>
                            {featName}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[8.5px] px-1 py-0 font-sans border bg-white/5 text-white/70 border-white/10 shrink-0"
                            >
                              {r.provider}
                            </Badge>
                            <span className="text-cyan-300 font-medium truncate max-w-[130px]" title={r.model}>
                              {r.model}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-white/70">
                          {r.inputTokens !== undefined || r.outputTokens !== undefined ? (
                            <span>
                              {(r.inputTokens || 0).toLocaleString()} /{' '}
                              <span className="text-blue-300">{(r.outputTokens || 0).toLocaleString()}</span>
                            </span>
                          ) : (
                            <span className="text-white/20">---</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {r.cachedTokens && r.cachedTokens > 0 ? (
                            <span className="text-violet-300 font-semibold flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              +{r.cachedTokens.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-white/20">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-amber-300/80">
                          {r.audioDurationSeconds && r.audioDurationSeconds > 0 ? (
                            <span>{Math.round(r.audioDurationSeconds)}s</span>
                          ) : (
                            <span className="text-white/20">---</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={cn(
                              'font-bold',
                              r.costStatus === 'free'
                                ? 'text-emerald-400 font-sans text-[10px]'
                                : r.costStatus === 'unknown'
                                ? 'text-amber-400 font-sans text-[10px]'
                                : 'text-emerald-300'
                            )}
                          >
                            {r.costStatus === 'free'
                              ? 'Free Tier'
                              : r.costStatus === 'unknown'
                              ? 'Chưa định giá'
                              : `$${(r.estimatedCostUsd || 0).toFixed(5)}`}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-2 flex items-center justify-center border-t border-white/[0.06] bg-black/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-[11px] h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1.5"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tải thêm bản ghi...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Tải thêm 50 bản ghi cũ hơn</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

