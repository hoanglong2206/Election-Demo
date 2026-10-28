import { Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatTokenCount } from '../../../utils/settingsValidators'
import type { AIModelConfig } from '@/services/ai-model/aiModels'

interface LLMModelDetailsProps {
  currentLLM: AIModelConfig
  isProviderConfigured: boolean
  livePing?: number | null
  isPinging?: boolean
  onTestPing?: () => void
  syncTimeStr?: string | null
}

export function LLMModelDetails({
  currentLLM,
  isProviderConfigured,
  livePing,
  isPinging = false,
  onTestPing,
  syncTimeStr,
}: LLMModelDetailsProps) {
  if (currentLLM.id === 'no-model-configured') return null

  return (
    <div className="flex-1 min-w-0 bg-gradient-to-b from-black/60 to-black/40 p-3 rounded-xl border border-violet-500/20 flex flex-col justify-between space-y-2 text-[10.5px] transition-all duration-200 shadow-inner">
      <div className="flex items-center justify-between gap-2 min-h-6">
        <div className="flex items-center gap-1.5 font-medium text-white/90 text-[10.5px]">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span>Thông tin mô hình LLM đã chọn:</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-[9px] px-2 py-0.5 flex items-center gap-1 font-mono shrink-0',
            currentLLM.tier === 'Free'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              currentLLM.tier === 'Free' ? 'bg-emerald-400' : 'bg-violet-400'
            )}
          />
          <span>
            {currentLLM.provider} · {currentLLM.tier}
          </span>
        </Badge>
      </div>

      <div className="space-y-1.5 text-white/50 text-[9.5px]">
        {/* Row 1: Model ID */}
        <div className="flex items-center justify-between gap-3 min-h-[22px]">
          <span className="text-white/45 text-[10px] shrink-0">Mã định danh (Model ID):</span>
          <code
            className="text-white/90 font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9.5px] truncate max-w-[62%]"
            title={currentLLM.id}
          >
            {currentLLM.id}
          </code>
        </div>

        {/* Row 2: Context Window */}
        <div className="flex items-center justify-between gap-3 min-h-[22px]">
          <span className="text-white/45 text-[10px] shrink-0">Cửa sổ ngữ cảnh (Context):</span>
          <span className="text-violet-300 font-mono font-medium text-[9.5px] bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded truncate max-w-[62%]">
            {formatTokenCount(currentLLM.contextWindow)}
          </span>
        </div>

        {/* Row 3: Capabilities */}
        <div className="flex items-center justify-between gap-3 min-h-[22px]">
          <span className="text-white/45 text-[10px] shrink-0">Capabilities (Khả năng):</span>
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {currentLLM.capabilities && currentLLM.capabilities.length > 0 ? (
              currentLLM.capabilities.map((cap) => (
                <span
                  key={cap}
                  className={cn(
                    'text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded border',
                    cap === 'vision'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-medium'
                      : cap === 'reasoning'
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-300 font-medium'
                      : cap === 'fast'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
                      : 'bg-white/5 border-white/10 text-white/70'
                  )}
                >
                  {cap}
                </span>
              ))
            ) : (
              <span className="text-[8.5px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                text
              </span>
            )}
          </div>
        </div>

        {/* Row 4: Latency */}
        <div className="flex items-center justify-between gap-2 min-h-[22px]">
          <span className="text-white/45 text-[10px] shrink-0">Độ trễ (Latency):</span>
          <div className="flex items-center gap-1.5 min-w-0 justify-end flex-wrap">
            {livePing !== undefined && livePing !== null ? (
              <span className="text-emerald-300 font-mono font-semibold text-[9.5px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{livePing}ms</span>
                <span className="text-white/40 font-normal text-[8.5px]">
                  ({currentLLM.provider})
                </span>
              </span>
            ) : isPinging ? (
              <span className="text-amber-300 font-mono font-medium text-[9.5px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Đang đo ping...</span>
              </span>
            ) : null}
            {onTestPing && (
              <button
                type="button"
                onClick={onTestPing}
                disabled={isPinging}
                className="text-[9px] text-white/50 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors"
                title="Đo ping mạng thực tế tới nhà cung cấp LLM"
              >
                <Zap className={cn('w-2.5 h-2.5 text-amber-400', isPinging && 'animate-spin')} />
                <span>
                  {isPinging
                    ? '...'
                    : livePing !== undefined && livePing !== null
                    ? 'Đo lại'
                    : 'Đo ping'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Row 5: Recommended for */}
        <div className="flex items-start justify-between gap-3 min-h-[22px]">
          <span className="text-white/45 text-[10px] shrink-0 pt-0.5">Khuyên dùng cho:</span>
          <span className="text-white/80 text-right text-[9.5px] leading-tight line-clamp-2 max-w-[62%]">
            {currentLLM.recommendedFor || 'Phân tích câu hỏi phỏng vấn & tư vấn câu trả lời'}
          </span>
        </div>

        {/* Description Quote */}
        <div className="pt-2 border-t border-white/[0.06] text-[9.5px] text-white/50 italic leading-relaxed min-h-[38px] flex items-center">
          <p className="line-clamp-2">
            &ldquo;{currentLLM.description || 'Mô hình ngôn ngữ lớn phân tích ngữ cảnh cuộc hội thoại.'}&rdquo;
          </p>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-8 flex items-center justify-between pt-2 border-t border-white/[0.08] text-[9.5px] gap-2">
        {isProviderConfigured ? (
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono min-w-0">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">Sẵn sàng phản hồi trong cuộc họp</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 text-amber-400 font-mono min-w-0"
            title={`Chưa có API key cho ${currentLLM.provider}`}
          >
            <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">Chưa cấu hình API Key cho {currentLLM.provider}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {syncTimeStr && (
            <span
              className="text-[8.5px] text-white/35 font-mono hidden sm:inline"
              title="Thời điểm đồng bộ gần nhất"
            >
              {syncTimeStr}
            </span>
          )}
          <Badge
            variant="outline"
            className="h-5 text-[8.5px] px-1.5 flex items-center bg-white/5 border-white/10 text-white/60 font-mono shrink-0"
          >
            {currentLLM.isLiveFromAPI ? 'Live Provider API' : 'Dynamic Registry'}
          </Badge>
        </div>
      </div>
    </div>
  )
}

