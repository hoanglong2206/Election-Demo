import { useState, useEffect } from 'react'
import {
  Zap,
  Target,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIBenchmarkResult } from '@/services/ai-model/aiModels'
import { getSavedAIModelId, saveAIModelId } from '@/services/ai-model/aiModels'
import {
  getTacticalRecommendation,
  type TacticalRecommendation,
} from '../../utils/benchmarkFormatters'

export interface TacticalAdviceCardProps {
  benchmarkResult: AIBenchmarkResult | null
  selectedModelId: string
  selectedModelName?: string
  onViewChange?: (
    view:
      | 'home'
      | 'meeting'
      | 'audio-test'
      | 'ai-diagnostic'
      | 'history'
      | 'settings'
  ) => void
}

export function TacticalAdviceCard({
  benchmarkResult,
  selectedModelId,
  selectedModelName,
  onViewChange,
}: TacticalAdviceCardProps) {
  const [activeMeetingModelId, setActiveMeetingModelId] = useState(() =>
    getSavedAIModelId()
  )
  const [justApplied, setJustApplied] = useState(false)

  // Listen to external updates
  useEffect(() => {
    const handleModelUpdate = () => {
      setActiveMeetingModelId(getSavedAIModelId())
    }
    window.addEventListener('ai-models-updated', handleModelUpdate)
    window.addEventListener('storage', handleModelUpdate)
    return () => {
      window.removeEventListener('ai-models-updated', handleModelUpdate)
      window.removeEventListener('storage', handleModelUpdate)
    }
  }, [])

  const recommendation: TacticalRecommendation | null =
    getTacticalRecommendation(benchmarkResult)

  const isCurrentMeetingModel = activeMeetingModelId === selectedModelId

  const handleApplyToMeeting = () => {
    saveAIModelId(selectedModelId)
    setActiveMeetingModelId(selectedModelId)
    setJustApplied(true)
    setTimeout(() => setJustApplied(false), 2500)
  }

  // Idle state when not benchmarked yet
  if (!recommendation) {
    return (
      <div className="bg-gradient-to-r from-amber-500/[0.04] via-violet-500/[0.04] to-black/30 border border-white/[0.07] rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="font-medium text-white/80 block">
              Tư vấn Chiến thuật Thực chiến (Combat Readiness)
            </span>
            <p className="text-[11px] text-white/45">
              Bấm &quot;Chạy Test Benchmark&quot; phía dưới để hệ thống đo đạc và đề xuất kịch bản phỏng vấn tối ưu cho{' '}
              <span className="text-amber-300 font-mono font-medium">
                {selectedModelName || selectedModelId}
              </span>.
            </p>
          </div>
        </div>
        {isCurrentMeetingModel && (
          <Badge
            variant="outline"
            className="shrink-0 bg-emerald-500/15 border-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1 py-1 px-2 font-medium"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Model Cuộc họp Hiện tại
          </Badge>
        )}
      </div>
    )
  }

  // Active Recommendation Card
  const variantStyles = {
    emerald: {
      border: 'border-emerald-500/35 bg-emerald-950/20',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      scoreColor: 'text-emerald-400',
      Icon: Zap,
    },
    amber: {
      border: 'border-amber-500/35 bg-amber-950/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      iconBg: 'bg-amber-500/20 text-amber-400',
      scoreColor: 'text-amber-400',
      Icon: Target,
    },
    violet: {
      border: 'border-violet-500/35 bg-violet-950/20',
      badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      iconBg: 'bg-violet-500/20 text-violet-400',
      scoreColor: 'text-violet-400',
      Icon: Brain,
    },
    rose: {
      border: 'border-rose-500/35 bg-rose-950/20',
      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      iconBg: 'bg-rose-500/20 text-rose-400',
      scoreColor: 'text-rose-400',
      Icon: AlertTriangle,
    },
  }[recommendation.badgeVariant]

  const CategoryIcon = variantStyles.Icon

  return (
    <div
      className={cn(
        'border rounded-xl p-3.5 space-y-3 transition-all duration-300 backdrop-blur-md shadow-md animate-fade-in',
        variantStyles.border
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/10 shadow-inner',
              variantStyles.iconBg
            )}
          >
            <CategoryIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-white/95">
                {recommendation.headline}
              </span>
              <Badge
                variant="outline"
                className={cn('text-[9.5px] px-2 py-0.5 border font-semibold', variantStyles.badge)}
              >
                {recommendation.badgeTitle}
              </Badge>
            </div>
            <div className="text-[11px] text-white/50 mt-0.5">
              Phù hợp nhất: <span className="text-white/80 font-medium">{recommendation.bestFor}</span>
            </div>
          </div>
        </div>

        {/* Suitability Score Gauge */}
        <div className="text-right shrink-0 bg-black/40 border border-white/[0.08] px-2.5 py-1 rounded-lg">
          <div className="text-[9.5px] text-white/40 uppercase tracking-wider">Độ phù hợp</div>
          <div className={cn('text-sm font-bold font-mono', variantStyles.scoreColor)}>
            {recommendation.suitabilityScore}/100
          </div>
        </div>
      </div>

      {/* Advice and Risk Details */}
      <div className="bg-black/30 border border-white/[0.06] rounded-lg p-2.5 space-y-1.5 text-xs text-white/80 leading-relaxed">
        <p className="text-[11.5px] text-white/90">
          💡 <span className="font-medium text-white/95">{recommendation.advice}</span>
        </p>

        {recommendation.riskWarning && (
          <div className="flex items-start gap-1.5 text-amber-200/90 text-[10.5px] pt-1 border-t border-white/[0.05]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{recommendation.riskWarning}</span>
          </div>
        )}
      </div>

      {/* Action Row: 1-Click Apply to Meeting & Jump to Meeting */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-1.5">
          {isCurrentMeetingModel ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Đang là Model kích hoạt cho Meeting Copilot</span>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleApplyToMeeting}
              className={cn(
                'h-7 px-3 text-[11px] font-medium rounded-lg transition-all cursor-pointer',
                justApplied
                  ? 'bg-emerald-600 text-white border border-emerald-500'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 hover:border-amber-400'
              )}
            >
              {justApplied ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1 text-white" />
                  Đã áp dụng thành công!
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
                  Đặt làm Model cho Cuộc họp (1-Click Apply)
                </>
              )}
            </Button>
          )}
        </div>

        {onViewChange && (
          <button
            type="button"
            onClick={() => onViewChange('meeting')}
            className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors cursor-pointer ml-auto"
          >
            <span>Mở Meeting Copilot</span>
            <ArrowRight className="w-3 h-3 text-amber-400" />
          </button>
        )}
      </div>
    </div>
  )
}

