import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Check, CheckCircle2, XCircle, RotateCcw, Eye, Brain, Zap } from 'lucide-react'

export interface PreviewModelItem {
  id: string
  name: string
  provider?: string
  tier?: string
  capabilities?: string[]
  availability?: 'unchecked' | 'checking' | 'available' | 'unavailable'
  description?: string
}

interface ModelAvailabilityListProps {
  models: PreviewModelItem[]
  providerName: string
  isCheckingAll: boolean
  testingModelId: string | null
  onCheckAll: () => void
  onCheckModel: (modelId: string) => void
  allChecked: boolean
  checkedCount: number
}

export function ModelAvailabilityList({
  models,
  providerName,
  isCheckingAll,
  testingModelId,
  onCheckAll,
  onCheckModel,
  allChecked,
  checkedCount,
}: ModelAvailabilityListProps) {
  if (!models || models.length === 0) return null

  return (
    <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2.5 mt-2 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/90">
            Danh sách mô hình {providerName} từ API ({models.length})
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] px-1.5 py-0 font-mono',
              allChecked
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            )}
          >
            {allChecked ? 'Đã kiểm tra toàn bộ' : `Đã kiểm tra ${checkedCount}/${models.length}`}
          </Badge>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCheckAll}
          disabled={isCheckingAll || allChecked}
          className="h-6 text-[10px] px-2 bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
        >
          {isCheckingAll ? (
            <>
              <RotateCcw className="w-2.5 h-2.5 animate-spin mr-1 text-violet-400" />
              <span>Đang kiểm tra...</span>
            </>
          ) : allChecked ? (
            <>
              <Check className="w-2.5 h-2.5 mr-1 text-emerald-400" />
              <span>Đã kiểm tra xong</span>
            </>
          ) : (
            <span>Kiểm tra tất cả model</span>
          )}
        </Button>
      </div>

      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
        {models.map((model) => {
          const availability = model.availability || 'unchecked'

          return (
            <div
              key={model.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg border text-[10.5px] transition-colors',
                availability === 'available'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-white'
                  : availability === 'unavailable'
                  ? 'bg-rose-500/10 border-rose-500/25 text-white/70'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/85'
              )}
            >
              <div className="min-w-0 flex-1 mr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-white/95 truncate">
                    {model.name?.split(' (')[0] || model.id}
                  </span>
                  <code className="text-[9px] font-mono text-white/45 bg-white/5 px-1 rounded truncate max-w-[150px]">
                    {model.id}
                  </code>
                  {model.capabilities?.includes('vision') && (
                    <Badge
                      variant="outline"
                      className="text-[7.5px] px-1 py-0 bg-amber-500/10 border-amber-500/25 text-amber-300 font-mono flex items-center gap-0.5"
                    >
                      <Eye className="w-2 h-2" />
                      <span>Vision</span>
                    </Badge>
                  )}
                  {model.capabilities?.includes('reasoning') && (
                    <Badge
                      variant="outline"
                      className="text-[7.5px] px-1 py-0 bg-violet-500/10 border-violet-500/25 text-violet-300 font-mono flex items-center gap-0.5"
                    >
                      <Brain className="w-2 h-2" />
                      <span>Reasoning</span>
                    </Badge>
                  )}
                  {model.capabilities?.includes('fast') && (
                    <Badge
                      variant="outline"
                      className="text-[7.5px] px-1 py-0 bg-emerald-500/10 border-emerald-500/25 text-emerald-300 font-mono flex items-center gap-0.5"
                    >
                      <Zap className="w-2 h-2" />
                      <span>Fast</span>
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {availability === 'available' && (
                  <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-medium font-mono">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Khả dụng</span>
                  </span>
                )}
                {availability === 'unavailable' && (
                  <span className="text-rose-400 flex items-center gap-1 text-[10px] font-medium font-mono">
                    <XCircle className="w-3 h-3" />
                    <span>Không hỗ trợ</span>
                  </span>
                )}
                {availability === 'checking' && (
                  <span className="text-blue-300 flex items-center gap-1 text-[10px] font-mono">
                    <RotateCcw className="w-3 h-3 animate-spin" />
                    <span>Đang thử...</span>
                  </span>
                )}
                {availability === 'unchecked' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onCheckModel(model.id)}
                    disabled={Boolean(testingModelId) || isCheckingAll}
                    className="h-5 text-[9.5px] px-1.5 bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  >
                    Kiểm tra
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

