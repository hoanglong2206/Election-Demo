import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Eye, Brain, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AIModelConfig } from '@/services/ai-model/aiModels'

interface LLMModelSelectorProps {
  modelsList: AIModelConfig[]
  selectedLLM: string
  onSelectLLM: (id: string) => void
  currentLLM: AIModelConfig
}

export function LLMModelSelector({
  modelsList,
  selectedLLM,
  onSelectLLM,
  currentLLM,
}: LLMModelSelectorProps) {
  const [isLLMOpen, setIsLLMOpen] = useState(false)
  const llmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (llmRef.current && !llmRef.current.contains(e.target as Node)) {
        setIsLLMOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
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
  )
}

