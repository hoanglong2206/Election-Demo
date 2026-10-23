import { useState, useRef, useEffect } from 'react'
import {
  Cpu,
  ChevronDown,
  Check,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  Brain,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIModelConfig } from '../../../services/ai-model/aiModels'

interface LLMEngineCardProps {
  modelsList: AIModelConfig[]
  selectedLLM: string
  onSelectLLM: (id: string) => void
  currentLLM: AIModelConfig
  isSyncing?: boolean
  lastSyncedAt?: number | null
  modelSource?: 'api' | 'cache' | 'mixed' | null
  credentialStatuses?: Record<string, { configured: boolean; maskedKey?: string }>
  livePing?: number | null
  isPinging?: boolean
  onTestPing?: () => void
}

export function LLMEngineCard({
  modelsList,
  selectedLLM,
  onSelectLLM,
  currentLLM,
  isSyncing = false,
  lastSyncedAt,
  modelSource,
  credentialStatuses,
  livePing,
  isPinging = false,
  onTestPing,
}: LLMEngineCardProps) {
  const [isLLMOpen, setIsLLMOpen] = useState(false)
  const llmRef = useRef<HTMLDivElement>(null)

  const [emptyShakeKey, setEmptyShakeKey] = useState(0)
  const prevSyncingRef = useRef(isSyncing)

  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && modelsList.length === 0) {
      setEmptyShakeKey((k) => k + 1)
    }
    prevSyncingRef.current = isSyncing
  }, [isSyncing, modelsList.length])

  const providerKey = currentLLM.provider.toLowerCase()
  const isProviderConfigured = credentialStatuses
    ? Boolean(
        credentialStatuses[
          providerKey === 'google' ? 'gemini' : providerKey
        ]?.configured
      )
    : true

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (llmRef.current && !llmRef.current.contains(e.target as Node)) {
        setIsLLMOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Format last synced time string
  const syncTimeStr = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <Card className="h-full min-w-0 bg-white/[0.03] border-white/[0.08] shadow-none p-4 relative flex flex-col gap-2.5">
      <CardHeader className="min-w-0 p-0 pb-0 space-y-1">
        <div className="flex items-center justify-between min-h-[24px]">
          <CardTitle className="min-w-0 text-[12.5px] font-semibold text-white/95 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400 shrink-0" />
            <span>LLM Engine (Trí tuệ phản hồi & Tư vấn)</span>
          </CardTitle>
        

          <div className="flex items-center gap-1.5 shrink-0">
            {modelSource && (
              <Badge
                variant="outline"
                title={
                  modelSource === 'cache'
                    ? 'API chưa trả model; danh sách đang hiển thị được giữ từ cache.'
                    : modelSource === 'mixed'
                    ? 'Danh sách gồm model vừa đồng bộ và model giữ từ cache.'
                    : 'Danh sách model được tải từ API.'
                }
                className={cn(
                  'text-[8px] px-1.5 py-0.5 font-mono',
                  modelSource === 'cache'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                    : modelSource === 'mixed'
                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                )}
              >
                {modelSource === 'cache' ? 'Dùng cache' : modelSource === 'mixed' ? 'API + cache' : 'API models'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-w-0 p-0 gap-2.5">
        {/* Warning if current selected model disappeared from available list */}
        {modelsList.length > 0 && selectedLLM && !modelsList.some((m) => m.id === selectedLLM) && (
          <div className="bg-amber-500/15 border border-amber-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-[11px] text-amber-200 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="leading-snug truncate">
                Mô hình "{selectedLLM}" không còn khả dụng trong danh sách.
              </span>
            </div>
            {modelsList[0] && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectLLM(modelsList[0].id)}
                className="h-6 px-2 text-[10px] bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30 shrink-0 flex items-center gap-1 font-medium"
              >
                <span>Dùng {modelsList[0].name.split(' (')[0]}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
        )}

        {/* Custom Interactive Dropdown for LLM */}
        <div ref={llmRef} className="relative">
          <button
            type="button"
            onClick={() => setIsLLMOpen(!isLLMOpen)}
            disabled={modelsList.length === 0}
            className={cn(
              'w-full h-10 border rounded-xl px-3 text-[11.5px] text-left flex items-center justify-between transition-all',
              modelsList.length > 0
                ? 'bg-black/50 hover:bg-black/70 border-white/[0.1] hover:border-violet-500/40 cursor-pointer'
                : 'bg-black/30 border-white/[0.06] text-white/40 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 overflow-hidden">
              <span className="font-semibold text-white/95 truncate">
                {modelsList.length > 0
                  ? currentLLM.name.split(' (')[0]
                  : 'Chưa có mô hình nào (Cần nhập Key)'}
              </span>
              {modelsList.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant="outline"
                    className="text-[8.5px] px-1.5 py-0 bg-white/5 border-white/10 text-violet-300 font-mono"
                  >
                    {currentLLM.provider} · {currentLLM.tier}
                  </Badge>
                  {currentLLM.capabilities?.includes('vision') && (
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1 py-0 bg-amber-500/10 border-amber-500/25 text-amber-300 font-mono flex items-center gap-0.5"
                    >
                      <Eye className="w-2 h-2" />
                      <span>Vision</span>
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 shrink-0 transition-transform duration-200',
                isLLMOpen && 'rotate-180 text-violet-400'
              )}
            />
          </button>

          {/* LLM Floating Menu */}
          {isLLMOpen && modelsList.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0c101d] border border-white/15 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 max-h-60 overflow-y-auto custom-scrollbar space-y-1 animate-fade-in">
              {modelsList.map((m) => {
                const isSelected = m.id === selectedLLM
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectLLM(m.id)
                      setIsLLMOpen(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSelectLLM(m.id)
                        setIsLLMOpen(false)
                      }
                    }}
                    className={cn(
                      'p-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2',
                      isSelected
                        ? 'bg-violet-600/20 text-white border border-violet-500/30'
                        : 'hover:bg-white/[0.06] text-white/75'
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[11px] text-white">
                          {m.name.split(' (')[0]}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 bg-white/5 border-white/10 text-violet-300 font-mono"
                        >
                          {m.provider} · {m.tier}
                        </Badge>
                        {m.capabilities?.includes('vision') && (
                          <Badge
                            variant="outline"
                            className="text-[7.5px] px-1 py-0 bg-amber-500/10 border-amber-500/25 text-amber-300 font-mono flex items-center gap-0.5"
                          >
                            <Eye className="w-2 h-2" />
                            <span>Vision</span>
                          </Badge>
                        )}
                        {m.capabilities?.includes('reasoning') && (
                          <Badge
                            variant="outline"
                            className="text-[7.5px] px-1 py-0 bg-violet-500/10 border-violet-500/25 text-violet-300 font-mono flex items-center gap-0.5"
                          >
                            <Brain className="w-2 h-2" />
                            <span>Reasoning</span>
                          </Badge>
                        )}
                        {m.capabilities?.includes('fast') && (
                          <Badge
                            variant="outline"
                            className="text-[7.5px] px-1 py-0 bg-emerald-500/10 border-emerald-500/25 text-emerald-300 font-mono flex items-center gap-0.5"
                          >
                            <Zap className="w-2 h-2" />
                            <span>Fast</span>
                          </Badge>
                        )}
                        {m.isLiveFromAPI && (
                          <Badge className="text-[7.5px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-1 py-0 font-mono">
                            Live API
                          </Badge>
                        )}
                      </div>
                      <p className="text-[9.5px] text-white/40 leading-relaxed truncate">
                        {m.description}
                      </p>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {modelsList.length === 0 && (
          <div
            key={`empty-warning-${emptyShakeKey}`}
            className={cn(
              'text-[10.5px] text-amber-300/90 flex items-center gap-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 transition-all',
              emptyShakeKey > 0 && 'animate-alert-shake'
            )}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Chưa có mô hình LLM nào được kích hoạt. Hãy nhập <strong>Groq API Key</strong> hoặc{' '}
              <strong>LLM API Key</strong> ở trên rồi bấm <strong>Lưu cài đặt</strong>.
            </span>
          </div>
        )}

        {/* ── Active LLM Model Details Card ── */}
        {modelsList.length > 0 && currentLLM.id !== 'no-model-configured' && (
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
                  {(() => {
                    const raw = currentLLM.contextWindow
                    if (!raw) return '128k tokens'
                    const str = String(raw).trim()
                    if (/^\d+$/.test(str)) {
                      const num = parseInt(str, 10)
                      if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace('.0', '')}M tokens`
                      if (num >= 1024) return `${Math.round(num / 1024)}k tokens`
                      return `${num} tokens`
                    }
                    return str
                  })()}
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
                    <span className="text-[8.5px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">text</span>
                  )}
                </div>
              </div>

              {/* Row 4: Latency */}
              <div className="flex items-center justify-between gap-2 min-h-[22px]">
                <span className="text-white/45 text-[10px] shrink-0">Độ trễ (Latency):</span>
                <div className="flex items-center gap-1.5 min-w-0 justify-end flex-wrap">
                  {livePing !== undefined && livePing !== null ? (
                    <span
                      className="text-emerald-300 font-mono font-semibold text-[9.5px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1.5 shrink-0"
                    >
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
                      <span>{isPinging ? '...' : livePing !== undefined && livePing !== null ? 'Đo lại' : 'Đo ping'}</span>
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
                <p className="line-clamp-2">&ldquo;{currentLLM.description || 'Mô hình ngôn ngữ lớn phân tích ngữ cảnh cuộc hội thoại.'}&rdquo;</p>
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
                  <span className="text-[8.5px] text-white/35 font-mono hidden sm:inline" title="Thời điểm đồng bộ gần nhất">
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
        )}

        {modelsList.length === 0 && (
          <p className="text-[10px] text-white/40 leading-relaxed">
            Dùng để phân tích câu hỏi phỏng vấn, trích xuất CV và sinh câu trả lời gợi ý tức thì.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
