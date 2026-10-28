import { useState, useRef, useEffect } from 'react'
import { Cpu, AlertCircle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LLMModelSelector } from './LLMModelSelector'
import { LLMModelDetails } from './LLMModelDetails'
import type { AIModelConfig } from '@/services/ai-model/aiModels'

export interface LLMEngineCardProps {
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
        credentialStatuses[providerKey === 'google' ? 'gemini' : providerKey]?.configured
      )
    : true

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
                {modelSource === 'cache'
                  ? 'Dùng cache'
                  : modelSource === 'mixed'
                  ? 'API + cache'
                  : 'API models'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-w-0 p-0 gap-2.5">
        {/* Warning if current selected model disappeared */}
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

        <LLMModelSelector
          modelsList={modelsList}
          selectedLLM={selectedLLM}
          onSelectLLM={onSelectLLM}
          currentLLM={currentLLM}
        />

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

        {modelsList.length > 0 && (
          <LLMModelDetails
            currentLLM={currentLLM}
            isProviderConfigured={isProviderConfigured}
            livePing={livePing}
            isPinging={isPinging}
            onTestPing={onTestPing}
            syncTimeStr={syncTimeStr}
          />
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

