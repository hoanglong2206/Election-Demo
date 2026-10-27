import { Zap, Eye, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DiagnosticViewTab } from '../types'
import type { AIModelConfig } from '../../../services/ai-model/aiModels'
import type { MultimodalModelOption } from '../../../services/screen-capture/types'
import { usageTrackerService } from '../../../services/usage-tracker'

interface AIDiagnosticHeaderProps {
  activeTab: DiagnosticViewTab
  setActiveTab: (tab: DiagnosticViewTab) => void
  currentLLM: AIModelConfig
  currentVision: MultimodalModelOption | null
  onOpenSettings?: () => void
}

export function AIDiagnosticHeader({
  activeTab,
  setActiveTab,
  currentLLM,
  currentVision,
  onOpenSettings,
}: AIDiagnosticHeaderProps) {
  return (
    <div className="space-y-2.5 pb-2 border-b border-white/[0.08]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Title & Description */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[14px] font-semibold text-white/95 leading-tight">
                Chẩn Đoán Tốc Độ AI & Kiểm Tra Chụp Màn Hình
              </h2>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border font-mono bg-amber-500/10 text-amber-300 border-amber-500/30"
              >
                AI & Vision Diagnostic
              </Badge>
            </div>

            <p className="text-[11px] text-white/45 leading-tight mt-0.5">
              Đo độ trễ API, tốc độ sinh token (tokens/s) và thử nghiệm chụp màn hình, OCR, phân tích bài toán Multimodal
            </p>
          </div>
        </div>

        {/* Tab Switcher & Settings Shortcut */}
        <div className="flex items-center gap-2 justify-between w-full">
          <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/[0.08] shrink-0 shadow-inner">
            <button
              type="button"
              id="tab-diag-llm"
              onClick={() => setActiveTab('llm-speed')}
              className={cn(
                'h-7 px-3 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
                activeTab === 'llm-speed'
                  ? 'bg-amber-600/30 text-amber-200 border border-amber-500/40 shadow-sm font-semibold'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
              )}
              title="Chuyên kiểm tra tốc độ phản hồi và benchmark token/s của mô hình LLM"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Đo Tốc Độ AI (LLM)</span>
            </button>

            <button
              type="button"
              id="tab-diag-vision"
              onClick={() => setActiveTab('vision-capture')}
              className={cn(
                'h-7 px-3 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap',
                activeTab === 'vision-capture'
                  ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 shadow-sm font-semibold'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
              )}
              title="Chuyên kiểm tra chụp màn hình, cắt vùng crop và phân tích bài toán bằng Vision"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Chụp Màn Hình & Vision</span>
            </button>
          </div>

          {onOpenSettings && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="h-7 px-2.5 text-[11px] bg-white/[0.03] border-white/10 hover:bg-white/10 text-white/70 hover:text-white"
              title="Cấu hình API Key và Mô hình"
            >
              <Settings className="w-3.5 h-3.5 mr-1" />
              <span>Cài đặt</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Active Model Badges Strip */}
      <div className="flex items-center gap-2 text-[10.5px] text-white/40 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Mô hình LLM chính:
          <span className="font-mono text-amber-300 font-medium ml-0.5">{currentLLM.name || currentLLM.id}</span>
          <span className="text-white/30">({currentLLM.provider})</span>
        </span>

        <span className="text-white/20">•</span>

        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Mô hình Vision:
          <span className="font-mono text-emerald-300 font-medium ml-0.5">
            {currentVision?.name || 'Tự động chọn Vision Model'}
          </span>
          {currentVision?.provider && <span className="text-white/30">({currentVision.provider})</span>}
        </span>

        <span className="text-white/20">•</span>

        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Prompt Cache Hit:
          <span className="font-mono text-violet-300 font-medium ml-0.5">
            {usageTrackerService.getCacheMetrics().cacheHitRate}%
          </span>
          <span className="text-white/30">
            ({usageTrackerService.getCacheMetrics().totalCachedTokens.toLocaleString()} tokens tiết kiệm)
          </span>
        </span>
      </div>
    </div>
  )
}
