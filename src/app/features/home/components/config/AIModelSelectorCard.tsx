import { useState } from 'react'
import { Bot, Mic } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AIModelConfig } from '@/services/ai-model/aiModels'
import type { STTEngineConfig } from '@/services/ai-model/types'
import { ModelInspectorTab } from './ModelInspectorTab'
import { SttInspectorTab } from './SttInspectorTab'

export interface AIModelSelectorCardProps {
  className?: string
  // LLM props
  aiModels: AIModelConfig[]
  selectedModelId: string
  currentModel: AIModelConfig
  hasModels: boolean
  isModelDropdownOpen: boolean
  isPinging: boolean
  livePing: number
  pingError?: string | null
  modelDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleDropdown: () => void
  onModelChange: (id: string) => void
  onTestPing: () => void
  onOpenSettings: () => void
  onOpenBenchmark?: () => void

  // STT props
  sttEngines: STTEngineConfig[]
  selectedSTTId: string
  currentSTTEngine: STTEngineConfig | undefined
  isSTTDropdownOpen: boolean
  sttDropdownRef: React.RefObject<HTMLDivElement | null>
  onToggleSTTDropdown: () => void
  onSTTChange: (id: string) => void
  onOpenAudioTest?: () => void
  isSTTPinging?: boolean
  liveSTTLatency?: number
  sttPingError?: string | null
  onTestSTTPing?: () => void
}

export function AIModelSelectorCard({
  className,
  aiModels,
  selectedModelId,
  currentModel,
  hasModels,
  isModelDropdownOpen,
  isPinging,
  livePing,
  pingError,
  modelDropdownRef,
  onToggleDropdown,
  onModelChange,
  onTestPing,
  onOpenSettings,
  onOpenBenchmark,
  sttEngines,
  selectedSTTId,
  currentSTTEngine,
  isSTTDropdownOpen,
  sttDropdownRef,
  onToggleSTTDropdown,
  onSTTChange,
  onOpenAudioTest,
  isSTTPinging = false,
  liveSTTLatency,
  sttPingError,
  onTestSTTPing,
}: AIModelSelectorCardProps) {
  const [activeEngineTab, setActiveEngineTab] = useState<'llm' | 'stt'>('llm')

  return (
    <Card
      className={cn(
        'bg-white/[0.03] border-white/[0.07] shadow-none p-3 gap-2 flex flex-col justify-between h-[255px] shrink-0 relative',
        className
      )}
    >
      {/* ── Top Header with Tab Switcher & Provider Badge ── */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.05]">
        {/* Sub-tab switcher: LLM vs STT */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/[0.08] text-[10.5px] shrink-0">
          <button
            type="button"
            id="tab-engine-llm"
            onClick={() => setActiveEngineTab('llm')}
            className={cn(
              'h-6 px-2.5 rounded-md font-medium transition-colors flex items-center gap-1.5 border select-none whitespace-nowrap shrink-0',
              activeEngineTab === 'llm'
                ? 'bg-violet-600/30 text-violet-200 border-violet-500/40 shadow-sm'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            <Bot className="w-3 h-3 text-violet-400 shrink-0" />
            <span className="whitespace-nowrap">LLM Copilot</span>
          </button>

          <button
            type="button"
            id="tab-engine-stt"
            onClick={() => setActiveEngineTab('stt')}
            className={cn(
              'h-6 px-2.5 rounded-md font-medium transition-colors flex items-center gap-1.5 border select-none whitespace-nowrap shrink-0',
              activeEngineTab === 'stt'
                ? 'bg-cyan-600/30 text-cyan-200 border-cyan-500/40 shadow-sm'
                : 'border-transparent text-white/50 hover:text-white'
            )}
          >
            <Mic className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="whitespace-nowrap">STT Bóc Băng</span>
          </button>
        </div>

        {/* Right Badge & Inspect Clarifier */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeEngineTab === 'llm' ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 border font-mono',
                hasModels
                  ? currentModel.tier === 'Free'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              )}
            >
              {hasModels ? currentModel.provider : 'Chưa có key'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 border font-mono',
                currentSTTEngine?.provider === 'Local'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              )}
            >
              {currentSTTEngine?.provider === 'Local' ? 'C++ Offline' : 'Cloud Whisper'}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Active Content Area ── */}
      {activeEngineTab === 'llm' ? (
        <ModelInspectorTab
          aiModels={aiModels}
          selectedModelId={selectedModelId}
          currentModel={currentModel}
          hasModels={hasModels}
          isModelDropdownOpen={isModelDropdownOpen}
          isPinging={isPinging}
          livePing={livePing}
          pingError={pingError}
          modelDropdownRef={modelDropdownRef}
          onToggleDropdown={onToggleDropdown}
          onModelChange={onModelChange}
          onTestPing={onTestPing}
          onOpenSettings={onOpenSettings}
          onOpenBenchmark={onOpenBenchmark}
        />
      ) : (
        <SttInspectorTab
          sttEngines={sttEngines}
          selectedSTTId={selectedSTTId}
          currentSTTEngine={currentSTTEngine}
          isSTTDropdownOpen={isSTTDropdownOpen}
          sttDropdownRef={sttDropdownRef}
          onToggleSTTDropdown={onToggleSTTDropdown}
          onSTTChange={onSTTChange}
          onOpenAudioTest={onOpenAudioTest}
          isSTTPinging={isSTTPinging}
          liveSTTLatency={liveSTTLatency}
          sttPingError={sttPingError}
          onTestSTTPing={onTestSTTPing}
        />
      )}
    </Card>
  )
}
