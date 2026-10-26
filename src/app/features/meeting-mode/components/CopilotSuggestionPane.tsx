import React, { useEffect, useMemo, useState } from 'react'
import {
  UserCheck,
  Brain,
  Cpu,
  RotateCcw,
  Check,
  Copy,
  Zap,
  Sparkles,
  AlertCircle,
  Loader2,
  Settings,
  Square,
  Languages,
  Coffee,
  HelpCircle,
  Activity,
  Layers,
  Camera,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import type { AISuggestion, InterviewVariation } from '../types'
import type { AIModelConfig } from '../../../services/ai-model/aiModels'
import type {
  ContextUsageInfo,
  IntentDetectionResult,
  TriggerMode,
  AnswerStrategyId,
} from '../../../services/ai-model/copilot'
import { answerStrategyRouter, triggerLogManager } from '../../../services/ai-model/copilot'
import { useVietnameseTranslation } from '@/hooks/useVietnameseTranslation'
import { VisualQuestionCard } from './VisualQuestionCard'
import type { ScreenCaptureState, VisualQuestionItem } from '../../../services/screen-capture/types'

interface CopilotSuggestionPaneProps {
  mode: AppMode
  isLatestAQuestion: boolean
  isGeneratingAIResponse: boolean
  currentModel: AIModelConfig
  /** Câu trả lời thật do LLM sinh ra (null = chưa generate). */
  customInterviewAnswer: InterviewVariation | null
  isShortened: boolean
  onToggleShorten: () => void
  isRegenerating: boolean
  onRegenerate: () => void
  copiedAnswer: boolean
  onCopyAnswer: () => void
  /** Các phương án thật do LLM sinh ra (null = chưa generate). */
  customDiscussionSuggestions: AISuggestion[] | null
  copiedOptionId: number | null
  onCopyOption: (text: string, id: number, e: React.MouseEvent) => void
  /** Lỗi khi gọi LLM (thiếu API key / lỗi mạng / rate limit...). */
  aiError: string | null
  hasTranscript: boolean
  onOpenSettings?: () => void
  /** Chế độ Song ngữ: hiện nút "Dịch" cho từng phản hồi. */
  showTranslate: boolean
  triggerMode?: TriggerMode
  onTriggerModeChange?: (mode: TriggerMode) => void
  latestIntent?: IntentDetectionResult | null
  semiAutoPendingQuestion?: string | null
  onTriggerSemiAuto?: () => void
  answerStrategyId?: AnswerStrategyId
  onAnswerStrategyChange?: (strategyId: AnswerStrategyId | undefined) => void
  contextUsage?: ContextUsageInfo | null
  visualQuestion?: VisualQuestionItem | null
  onDismissVisualQuestion?: () => void
  isAnalyzingVisual?: boolean
  onTriggerScreenCapture?: () => void
  screenCaptureState?: ScreenCaptureState
  onToggleCorrectedAnswer?: () => void
}

/**
 * Defensive parser: If any discussion option contains trapped raw JSON string,
 * automatically unpack it into clean separate suggestion cards.
 */
function sanitizeDiscussionOptions(rawOptions: AISuggestion[]): AISuggestion[] {
  if (rawOptions.length !== 1) return rawOptions
  const first = rawOptions[0]
  if (!first || !first.content) return rawOptions

  const text = first.content.trim()
  if (!text.includes('{') || !text.includes('"')) return rawOptions

  try {
    const clean = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    let parsed: unknown = null
    try {
      parsed = JSON.parse(clean)
    } catch {
      try {
        const withoutTrailing = clean.replace(/,\s*([\]}])/g, '$1')
        parsed = JSON.parse(withoutTrailing)
      } catch {
        try {
          const wrapped = `[${clean}]`.replace(/,\s*([\]}])/g, '$1')
          parsed = JSON.parse(wrapped)
        } catch {
          parsed = null
        }
      }
    }

    if (parsed) {
      let arr: unknown[] | null = null
      if (Array.isArray(parsed)) {
        arr = parsed
      } else if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Record<string, unknown>
        const found = Object.values(record).find(Array.isArray)
        arr = (found as unknown[]) || [record]
      }

      if (arr && arr.length > 0) {
        const valid = arr.filter(
          (it) => it && typeof it === 'object' && ('content' in (it as object) || 'label' in (it as object))
        ) as Record<string, unknown>[]

        if (valid.length > 0) {
          return valid.map((it, idx) => ({
            id: typeof it?.id === 'number' ? it.id : idx + 1,
            type: 'option' as const,
            label: typeof it?.label === 'string' ? it.label : `Phương án ${idx + 1}`,
            content: typeof it?.content === 'string' ? it.content : '',
            confidence: typeof it?.confidence === 'number' ? it.confidence : 95 - idx * 4,
          }))
        }
      }
    }
  } catch {
    // Keep as is
  }

  return rawOptions
}

export function CopilotSuggestionPane({
  mode,
  isLatestAQuestion,
  isGeneratingAIResponse,
  currentModel,
  customInterviewAnswer,
  isShortened,
  onToggleShorten,
  isRegenerating,
  onRegenerate,
  copiedAnswer,
  onCopyAnswer,
  customDiscussionSuggestions,
  copiedOptionId,
  onCopyOption,
  aiError,
  hasTranscript,
  onOpenSettings,
  showTranslate,
  triggerMode,
  onTriggerModeChange,
  latestIntent,
  semiAutoPendingQuestion,
  onTriggerSemiAuto,
  answerStrategyId,
  onAnswerStrategyChange,
  contextUsage,
  visualQuestion,
  onDismissVisualQuestion,
  isAnalyzingVisual,
  onTriggerScreenCapture,
  screenCaptureState = 'idle',
  onToggleCorrectedAnswer,
}: CopilotSuggestionPaneProps) {
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [logs, setLogs] = useState(() => triggerLogManager.getLogs())

  const isStreamingInterview =
    mode === 'interview' &&
    Boolean(
      customInterviewAnswer &&
        (customInterviewAnswer.isStreaming ||
          customInterviewAnswer.streamingState === 'connecting' ||
          customInterviewAnswer.streamingState === 'streaming')
    )

  const interviewAnswer =
    customInterviewAnswer && (customInterviewAnswer.content.trim() || isStreamingInterview)
      ? customInterviewAnswer
      : null

  const discussionOptions = useMemo(
    () => sanitizeDiscussionOptions(customDiscussionSuggestions ?? []),
    [customDiscussionSuggestions]
  )
  const hasContent =
    mode === 'interview' ? Boolean(interviewAnswer) : discussionOptions.length > 0

  const activeAnswerContent = interviewAnswer
    ? isShortened
      ? interviewAnswer.shortContent
      : interviewAnswer.content
    : ''

  const confidence =
    mode === 'interview' ? interviewAnswer?.confidence : discussionOptions[0]?.confidence

  // ── Bilingual mode: bản dịch tiếng Việt theo từng phản hồi ────────────────
  const { entries: translations, toggle: toggleTranslation, reset: resetTranslations } =
    useVietnameseTranslation()

  // Nội dung mới -> bỏ bản dịch cũ để không hiển thị lẫn lộn.
  useEffect(() => {
    resetTranslations()
  }, [customInterviewAnswer, customDiscussionSuggestions, resetTranslations])

  const interviewTr = translations['interview']
  const interviewShowingVi = Boolean(interviewTr?.text && interviewTr.showing)
  const interviewDisplay = interviewShowingVi ? interviewTr!.text! : activeAnswerContent

  return (
    <section className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden relative">
      {/* Header (Row 1: Pane Title, Generating Status & Screen Capture Action) */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'interview' ? (
            <UserCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )}
          <span
            className="text-[11px] text-white/70 font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
            title={
              mode === 'interview'
                ? 'Suggested Answer — Theo CV & Chuẩn STAR'
                : isLatestAQuestion
                ? 'Suggested Answers — Phương án phản hồi'
                : 'Suggested Questions — Câu hỏi gợi ý dẫn dắt'
            }
          >
            {mode === 'interview'
              ? 'Suggested Answer (STAR)'
              : isLatestAQuestion
              ? 'Suggested Answers'
              : 'Suggested Questions'}
          </span>
          {mode === 'interview' && interviewAnswer?.grounding?.overallRisk !== 'low' && (
            <span
              className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200"
              title={interviewAnswer?.grounding?.warning || 'Một số thông tin cần được xác minh'}
            >
              Verify claims
            </span>
          )}
          {mode === 'interview' && interviewAnswer?.failover?.switched && (
            <span
              className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-200"
              title="Provider chính không khả dụng; hệ thống đã tự chuyển sang provider dự phòng."
            >
              Provider switched
            </span>
          )}
          {mode === 'interview' && onAnswerStrategyChange && (
            <select
              value={answerStrategyId || ''}
              onChange={(event) =>
                onAnswerStrategyChange(
                  (event.target.value || undefined) as AnswerStrategyId | undefined
                )
              }
              className="max-w-[170px] rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/70 outline-none"
              title="Chọn framework trả lời; Auto để router tự chọn"
              aria-label="Answer strategy"
            >
              <option value="">Auto strategy</option>
              {answerStrategyRouter.list().map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.label}
                </option>
              ))}
            </select>
          )}

          {/* Dynamic status badge when generating: Placed neatly next to title on Row 1 */}
          {isGeneratingAIResponse && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono animate-pulse flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-2.5 h-2.5 animate-spin text-amber-400" />
              <span className="hidden sm:inline">AI đang suy luận...</span>
              <span className="sm:hidden">Suy luận...</span>
            </Badge>
          )}
        </div>

        {/* Screenshot Question Capture Button */}
        {onTriggerScreenCapture && (
          <Button
            id="btn-capture-screen"
            size="sm"
            variant="outline"
            onClick={onTriggerScreenCapture}
            disabled={screenCaptureState === 'capturing' || screenCaptureState === 'processing'}
            className={cn(
              'h-6 text-[10px] px-2 gap-1.5 border transition-all shrink-0',
              screenCaptureState === 'processing' || screenCaptureState === 'capturing'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 animate-pulse'
                : screenCaptureState === 'cropping'
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-violet-600/20 hover:text-violet-200 hover:border-violet-500/30'
            )}
            title="Chụp màn hình câu hỏi kỹ thuật/coding trên màn hình (Ctrl+Shift+S)"
          >
            {screenCaptureState === 'processing' || screenCaptureState === 'capturing' ? (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                <span className="hidden sm:inline">
                  {screenCaptureState === 'capturing' ? 'Đang chụp...' : 'AI đang phân tích...'}
                </span>
                <span className="sm:hidden">Đang quét</span>
              </>
            ) : (
              <>
                <Camera className="w-2.5 h-2.5 text-violet-400" />
                <span>Chụp câu hỏi</span>
                <kbd className="hidden sm:inline text-[9px] px-1 py-0 bg-white/10 text-white/50 rounded font-mono">
                  Ctrl+Shift+S
                </kbd>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Sub-toolbar (Row 2): Trigger Mode Selector, Logs, AI Model Badge & Context Metrics */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-1 shrink-0 border-b border-white/[0.02] min-w-0">
        {/* Left: Trigger mode switcher, logs & intent */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {/* Trigger Mode Selector (Auto / Semi / Manual) */}
          {triggerMode && onTriggerModeChange && (
            <div
              className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[9px]"
              title="Chế độ kích hoạt Copilot (Auto: Tự động khi có câu hỏi | Semi: Báo câu hỏi & bấm để gợi ý | Manual: Chỉ gợi ý khi bấm thủ công)"
            >
              <button
                type="button"
                onClick={() => onTriggerModeChange('auto')}
                className={cn(
                  'px-1.5 py-0.5 rounded font-semibold transition-all',
                  triggerMode === 'auto'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white'
                )}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onTriggerModeChange('semi-auto')}
                className={cn(
                  'px-1.5 py-0.5 rounded font-semibold transition-all',
                  triggerMode === 'semi-auto'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white'
                )}
              >
                Semi
              </button>
              <button
                type="button"
                onClick={() => onTriggerModeChange('manual')}
                className={cn(
                  'px-1.5 py-0.5 rounded font-semibold transition-all',
                  triggerMode === 'manual'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white'
                )}
              >
                Manual
              </button>
            </div>
          )}

          {/* Trigger Decision Log Button */}
          <button
            type="button"
            onClick={() => {
              setLogs(triggerLogManager.getLogs())
              setIsLogOpen(!isLogOpen)
            }}
            className={cn(
              'h-5 px-1.5 rounded text-[8.5px] font-mono border transition-all flex items-center gap-1',
              isLogOpen
                ? 'bg-violet-600 text-white border-violet-500'
                : 'bg-white/5 text-white/40 hover:text-white border-white/10'
            )}
            title="Xem nhật ký phân loại Intent & Quyết định trigger Copilot"
          >
            <Activity className="w-2.5 h-2.5" />
            <span>Logs</span>
          </button>

          {/* Intent Status Badge (only when meaningful intent detected, skip UNKNOWN/Idle to preserve space) */}
          {latestIntent && latestIntent.normalizedText && latestIntent.intent !== 'UNKNOWN' && (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 h-5 font-mono flex items-center gap-1 transition-all shrink-0',
                latestIntent.intent === 'QUESTION' &&
                  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                latestIntent.intent === 'DISCUSSION_POINT' &&
                  'bg-blue-500/15 text-blue-300 border-blue-500/30',
                latestIntent.intent === 'COMMAND' &&
                  'bg-amber-500/15 text-amber-300 border-amber-500/30',
                latestIntent.intent === 'SMALL_TALK' &&
                  'bg-white/5 text-white/40 border-white/10'
              )}
              title={`${latestIntent.triggerDecisionReason} | Confidence: ${(latestIntent.confidence * 100).toFixed(0)}%`}
            >
              {latestIntent.intent === 'QUESTION' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Q: {(latestIntent.confidence * 100).toFixed(0)}%</span>
                </>
              )}
              {latestIntent.intent === 'DISCUSSION_POINT' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>Disc: {(latestIntent.confidence * 100).toFixed(0)}%</span>
                </>
              )}
              {latestIntent.intent === 'COMMAND' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Cmd</span>
                </>
              )}
              {latestIntent.intent === 'SMALL_TALK' && (
                <>
                  <Coffee className="w-2.5 h-2.5 text-white/40" />
                  <span>Bỏ qua</span>
                </>
              )}
            </Badge>
          )}
        </div>

        {/* Right: LLM model & context metrics */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end min-w-0">
          {/* AI Model badge */}
          <Badge
            variant="outline"
            className="text-[9.5px] px-1.5 py-0 h-5 bg-indigo-500/10 text-indigo-300 border-indigo-500/20 font-mono flex items-center gap-1 shrink-0 max-w-[130px]"
            title={`Model LLM: ${currentModel.name}`}
          >
            <Cpu className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
            <span className="truncate">{currentModel.name.split(' ')[0]}</span>
          </Badge>

          {/* Multi-Tier Context Usage Badge */}
          {contextUsage && (
            <div className="relative group">
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] px-1.5 py-0 h-5 font-mono flex items-center gap-1 cursor-help transition-all',
                  contextUsage.usagePercent > 85
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : contextUsage.usagePercent > 60
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                )}
                title="Ước tính context token gửi tới LLM theo 4 tầng (Di chuột để xem chi tiết)"
              >
                <Layers className="w-2.5 h-2.5" />
                <span>
                  Context: {(contextUsage.totalTokens / 1000).toFixed(1)}k / {(contextUsage.maxBudget / 1000).toFixed(1)}k
                </span>
              </Badge>
              {/* Tooltip on hover with breakdown of the 4 tiers */}
              <div className="absolute right-0 top-6 z-50 hidden group-hover:flex flex-col w-64 p-2.5 bg-zinc-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-zinc-300 pointer-events-none backdrop-blur-md">
                <div className="font-semibold text-white mb-1.5 flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" /> Phân bổ Context
                  </span>
                  <span className="font-mono text-emerald-400">{contextUsage.usagePercent}% budget</span>
                </div>
                <div className="space-y-1 font-mono text-[9.5px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tầng 1 (Permanent):</span>
                    <span>{contextUsage.breakdown.permanent} tok</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tầng 2 (Session Memory):</span>
                    <span>{contextUsage.breakdown.sessionMemory} tok</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tầng 3 (Short-Term):</span>
                    <span>{contextUsage.breakdown.shortTerm} tok</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tầng 4 (Current Input):</span>
                    <span>{contextUsage.breakdown.currentInput} tok</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/10 font-semibold text-white">
                    <span>Tổng context:</span>
                    <span>{contextUsage.totalTokens} / {contextUsage.maxBudget} tok</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence only exists once the LLM has produced something */}
          {hasContent && typeof confidence === 'number' && (
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1.5 py-0 h-5 font-mono flex items-center',
                mode === 'interview'
                  ? 'bg-violet-500/10 text-violet-300 border-violet-500/25'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
              )}
            >
              {confidence}% Match
            </Badge>
          )}
        </div>
      </div>

      {/* Semi-Auto Pending Question Notification Banner */}
      {triggerMode === 'semi-auto' && semiAutoPendingQuestion && (
        <div className="mx-3.5 mt-2 p-2 rounded-lg bg-violet-600/15 border border-violet-500/30 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <div className="min-w-0 text-[11px]">
              <div className="text-violet-200 font-semibold truncate">
                Phát hiện câu hỏi: &ldquo;{semiAutoPendingQuestion}&rdquo;
              </div>
              <div className="text-white/40 text-[9.5px]">
                Chế độ Semi-Auto — Bấm nút để tạo câu trả lời gợi ý
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onTriggerSemiAuto}
            disabled={isGeneratingAIResponse}
            className="h-6 text-[10.5px] px-2.5 bg-violet-600 hover:bg-violet-500 text-white shrink-0 font-medium"
          >
            Gợi ý trả lời
          </Button>
        </div>
      )}

      {/* False Trigger Decision Log Drawer */}
      {isLogOpen && (
        <div className="mx-3.5 mt-2 p-2.5 rounded-xl bg-black/80 border border-white/10 backdrop-blur-md space-y-1.5 animate-fade-in z-20 text-[10px]">
          <div className="flex items-center justify-between pb-1 border-b border-white/10 text-white/70">
            <div className="flex items-center gap-1.5 font-semibold">
              <Activity className="w-3 h-3 text-violet-400" />
              <span>Nhật Ký Quyết Định Trigger Copilot ({logs.length} bản ghi gần nhất)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsLogOpen(false)}
              className="text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1 font-mono">
            {logs.length === 0 ? (
              <div className="text-white/30 italic py-2 text-center">Chưa có phát biểu nào được ghi nhận.</div>
            ) : (
              logs.map((lg) => (
                <div
                  key={lg.id}
                  className="flex items-start justify-between gap-2 p-1.5 rounded bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white/35">[{lg.timeStr}]</span>
                      <span className="text-white/75 font-semibold">{lg.speaker}:</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[8px] px-1 py-0 h-3.5',
                          lg.intent === 'QUESTION' && 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                          lg.intent === 'SMALL_TALK' && 'bg-white/5 text-white/40 border-white/10',
                          lg.intent === 'COMMAND' && 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                          lg.intent === 'DISCUSSION_POINT' && 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        )}
                      >
                        {lg.intent}
                      </Badge>
                      <span
                        className={cn(
                          'font-semibold',
                          lg.decision === 'triggered' ? 'text-emerald-400' : 'text-white/40'
                        )}
                      >
                        {lg.decision === 'triggered' ? '✓ TRIGGERED' : '✕ SKIPPED'}
                      </span>
                    </div>
                    <div className="text-white/90 truncate">&ldquo;{lg.text}&rdquo;</div>
                    <div className="text-white/35 text-[9px] truncate">{lg.reason}</div>
                  </div>
                  <div className="shrink-0 text-white/50 text-[9px]">
                    {(lg.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Suggestion Body */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden px-4 py-3 custom-scrollbar">
        <div className="space-y-2.5">
          {/* ── 0. CÂU HỎI TỪ MÀN HÌNH (SCREENSHOT MULTIMODAL) 📸 ─────── */}
          {visualQuestion && (
            <VisualQuestionCard
              item={visualQuestion}
              onDismiss={onDismissVisualQuestion}
              showTranslate={showTranslate}
            />
          )}

          {isAnalyzingVisual && (
            <div className="rounded-2xl p-4 border border-violet-500/35 bg-violet-950/25 animate-fade-in shadow-lg">
              <div className="flex items-center gap-2.5 text-xs text-violet-200 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
                <span className="font-semibold">Đang phân tích hình ảnh câu hỏi bằng Multimodal AI...</span>
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 bg-violet-500/20 rounded w-3/4 animate-pulse" />
                <div className="h-1.5 bg-violet-500/15 rounded w-5/6 animate-pulse" />
                <div className="h-1.5 bg-violet-500/10 rounded w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {/* ── 1. ĐANG GỌI LLM (CHỈ KHI KHÔNG PHẢI STREAMING INTERVIEW) ───────────────── */}
          {isGeneratingAIResponse && !isStreamingInterview ? (
            <div className="rounded-xl p-4 border border-amber-500/25 bg-amber-500/[0.04] animate-fade-in">
              <div className="flex items-center gap-2 text-[11.5px] text-amber-200 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span>
                  {mode === 'interview'
                    ? 'AI đang đọc transcript & soạn câu trả lời theo CV...'
                    : 'AI đang đọc transcript & đề xuất phương án thảo luận...'}
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 bg-white/10 rounded w-3/4 animate-pulse" />
                <div className="h-1.5 bg-white/10 rounded w-5/6 animate-pulse" />
                <div className="h-1.5 bg-white/10 rounded w-2/3 animate-pulse" />
              </div>
            </div>
          ) : /* ── 2. LỖI GỌI LLM ──────────────────────────────────────────── */
          aiError ? (
            <div className="rounded-xl p-3.5 border border-rose-500/30 bg-rose-500/[0.06] animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-px" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold text-rose-200">
                    Không tạo được nội dung từ AI
                  </p>
                  <p className="text-[10.5px] text-rose-200/70 leading-relaxed mt-1 break-words">
                    {aiError}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-rose-500/15">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={isRegenerating || !hasTranscript}
                  className="h-5 text-[9.5px] px-2 gap-1 bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className={cn('w-2.5 h-2.5', isRegenerating && 'animate-spin')} />
                  <span>Thử lại</span>
                </Button>
                {onOpenSettings && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpenSettings}
                    className="h-5 text-[9.5px] px-2 gap-1 bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                  >
                    <Settings className="w-2.5 h-2.5 text-violet-300" />
                    <span>Mở Cài đặt (API Key)</span>
                  </Button>
                )}
              </div>
            </div>
          ) : /* ── 3. CHƯA CÓ KẾT QUẢ ──────────────────────────────────────── */
          !hasContent ? (
            <div className="rounded-xl p-4 border border-white/[0.08] bg-white/[0.02] text-center animate-fade-in">
              <div
                className={cn(
                  'w-9 h-9 mx-auto rounded-xl border flex items-center justify-center',
                  mode === 'interview'
                    ? 'bg-violet-600/15 border-violet-500/25 text-violet-400'
                    : 'bg-indigo-600/15 border-indigo-500/25 text-indigo-400'
                )}
              >
                {mode === 'interview' ? (
                  <UserCheck className="w-4 h-4" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
              </div>
              <p className="text-[11.5px] font-semibold text-white/90 mt-2">
                {mode === 'interview'
                  ? 'Chưa có câu trả lời từ AI'
                  : 'Chưa có phương án từ AI'}
              </p>
              <p className="text-[10.5px] text-white/45 leading-relaxed mt-1 max-w-[280px] mx-auto">
                {hasTranscript ? (
                  <>
                    Bấm nút <Square className="w-2.5 h-2.5 inline text-rose-400" />{' '}
                    <span className="text-white/70 font-medium">Dừng</span> trên thanh điều khiển —
                    AI sẽ đọc toàn bộ transcript và sinh nội dung tại đây.
                  </>
                ) : (
                  'Hãy bắt đầu thu âm cuộc họp trước. Khi bấm Dừng, AI sẽ đọc transcript và sinh nội dung tại đây.'
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={onRegenerate}
                disabled={isRegenerating || !hasTranscript}
                className="h-6 text-[10px] px-2.5 gap-1.5 mt-2.5 bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                title={
                  hasTranscript
                    ? 'Sinh nội dung từ transcript hiện có'
                    : 'Cần có transcript trước khi sinh nội dung'
                }
              >
                <Sparkles className="w-2.5 h-2.5 text-violet-300" />
                <span>Tạo ngay từ transcript</span>
              </Button>
            </div>
          ) : mode === 'interview' ? (
            /* ── 4. INTERVIEW: câu trả lời thật từ LLM (STREAMING SUPPORT) ─────────────────── */
            <div
              className={cn(
                'rounded-xl p-3.5 border animate-fade-in transition-all',
                'bg-gradient-to-br from-violet-600/15 via-indigo-600/10 to-transparent',
                'border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
                'relative overflow-hidden'
              )}
            >
              {/* Shimmer accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />

              {/* Tag & Action Toolbar */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  <span
                    className="text-[10px] font-semibold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded border border-violet-500/30 truncate whitespace-nowrap"
                    title={isShortened ? 'Phiên bản rút gọn (Short)' : interviewAnswer!.label}
                  >
                    {isShortened ? '⚡ Phiên bản rút gọn (Short)' : interviewAnswer!.label}
                  </span>
                  {interviewAnswer?.isStreaming ? (
                    <span className="text-[10px] text-amber-300 font-mono shrink-0 whitespace-nowrap flex items-center gap-1 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      ⚡ Đang stream chữ...
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-300/70 font-mono shrink-0 whitespace-nowrap">
                      ✨ LLM Real-time
                    </span>
                  )}
                </div>
              </div>

              {/* RAG Citations badges */}
              {interviewAnswer?.retrieval?.citations && interviewAnswer.retrieval.citations.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mb-2.5">
                  <span className="text-[9px] text-white/40">Dẫn chứng:</span>
                  {interviewAnswer.retrieval.citations.slice(0, 3).map((cit, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300 font-mono"
                      title={cit.text}
                    >
                      📎 {cit.section || cit.sourceType || cit.documentId || `Trích dẫn ${idx + 1}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Answer Content / Streaming state */}
              {interviewAnswer?.streamingState === 'connecting' && !interviewDisplay ? (
                <div className="flex items-center gap-2 py-3 text-[11.5px] text-violet-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400 shrink-0" />
                  <span className="font-medium animate-pulse">Đang kết nối AI (chữ đầu xuất hiện &lt; 1s)...</span>
                </div>
              ) : (
                <p className="text-[12.5px] leading-relaxed text-white/95 font-normal whitespace-pre-line">
                  {interviewDisplay}
                  {interviewAnswer?.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-violet-400 ml-1 animate-pulse align-middle" />
                  )}
                </p>
              )}

              {showTranslate && interviewTr?.error && (
                <p className="text-[9.5px] text-rose-300/85 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                  <span>{interviewTr.error}</span>
                </p>
              )}

              {/* Grounding Verification Status & Corrected Answer Action */}
              {interviewAnswer?.grounding && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                  {interviewAnswer.grounding.hasDiscrepancies && interviewAnswer.grounding.correctedAnswer ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-amber-300 font-medium">
                        <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Có lưu ý so với CV</span>
                      </span>
                      {onToggleCorrectedAnswer && (
                        <button
                          type="button"
                          onClick={onToggleCorrectedAnswer}
                          className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30 transition-all font-medium text-[9.5px]"
                        >
                          {interviewAnswer.appliedCorrected ? '↩ Xem câu trả lời gốc' : '🛡️ Xem bản chỉnh sửa theo CV'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-300/80">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Đã kiểm chứng khớp CV ({Math.round(interviewAnswer.grounding.confidence <= 1 ? interviewAnswer.grounding.confidence * 100 : interviewAnswer.grounding.confidence)}%)</span>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION TOOLBAR: TRANSLATE / COPY / SHORTEN / REGENERATE */}
              <div className="border-t border-white/[0.06] py-2 mt-2 flex items-center justify-end gap-1.5 shrink-0">
                {showTranslate && (
                  <Button
                    id="btn-translate-answer"
                    size="sm"
                    variant="outline"
                    onClick={() => toggleTranslation('interview', interviewAnswer!.content)}
                    disabled={interviewTr?.busy || interviewAnswer?.isStreaming}
                    className={cn(
                      'h-5 text-[9.5px] px-2 gap-1 border transition-all font-medium',
                      interviewShowingVi
                        ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
                        : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                    )}
                    title="Dịch câu trả lời sang tiếng Việt"
                  >
                    {interviewTr?.busy ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-300" />
                    ) : (
                      <Languages className="w-2.5 h-2.5 text-sky-300" />
                    )}
                    <span>
                      {interviewTr?.busy ? 'Đang dịch...' : interviewShowingVi ? 'Bản gốc' : 'Dịch'}
                    </span>
                  </Button>
                )}

                <Button
                  id="btn-copy-answer"
                  size="sm"
                  variant="outline"
                  onClick={onCopyAnswer}
                  disabled={!interviewAnswer?.content?.trim()}
                  className={cn(
                    'h-5 text-[9.5px] px-2 gap-1 border transition-all font-medium',
                    copiedAnswer
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                  )}
                  title="1 click sao chép câu trả lời để dán vào chat phỏng vấn"
                >
                  {copiedAnswer ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Đã chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-violet-300" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  id="btn-shorten-answer"
                  size="sm"
                  variant="outline"
                  onClick={onToggleShorten}
                  disabled={interviewAnswer?.isStreaming}
                  className={cn(
                    'h-5 text-[9.5px] px-2 gap-1 border transition-all font-medium',
                    isShortened
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                  )}
                  title="Làm ngắn lại thành 2-3 gạch đầu dòng súc tích"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isShortened ? 'Mở rộng' : 'Làm ngắn'}</span>
                </Button>

                <Button
                  id="btn-regenerate-answer"
                  size="sm"
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={isRegenerating || interviewAnswer?.isStreaming}
                  className="h-5 text-[9.5px] px-2 gap-1 bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white transition-all font-medium"
                  title="Gọi lại LLM để tạo câu trả lời khác"
                >
                  <RotateCcw className={cn('w-2.5 h-2.5 text-violet-400', isRegenerating && 'animate-spin')} />
                  <span>{isRegenerating ? 'Đang tạo...' : 'Tạo lại'}</span>
                </Button>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-white/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Ready to use &bull; Đã tối ưu cho phỏng vấn</span>
                </div>
              </div>
            </div>
          ) : (
            /* ── 5. DISCUSSION: các phương án thật từ LLM ───────────────── */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-indigo-300/80 mb-0.5">
                <span className="flex items-center gap-1 font-medium min-w-0">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span className="truncate whitespace-nowrap">
                    {isLatestAQuestion
                      ? '❓ Câu cuối là câu hỏi → Đề xuất các phương án giải pháp trả lời'
                      : '💬 Câu cuối là nội dung chia sẻ → Đề xuất các câu hỏi phản biện & làm rõ'}
                  </span>
                </span>
                <span className="font-mono text-emerald-300/70 shrink-0 whitespace-nowrap">
                  ✨ {discussionOptions.length} phương án từ LLM
                </span>
              </div>

              {discussionOptions.map((suggestion, idx) => {
                const trKey = `opt-${suggestion.id}`
                const tr = translations[trKey]
                const showingVi = Boolean(tr?.text && tr.showing)
                const displayContent = showingVi
                  ? tr!.text!
                  : isShortened
                  ? suggestion.content.split('.')[0] + '.'
                  : suggestion.content

                return (
                <div
                  key={suggestion.id}
                  className={cn(
                    'rounded-xl p-3 border group animate-fade-in transition-all duration-200 relative overflow-hidden',
                    idx === 0
                      ? 'bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-transparent border-indigo-500/35 shadow-[0_0_15px_rgba(99,102,241,0.08)]'
                      : 'bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.07] hover:border-indigo-500/30'
                  )}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider',
                          idx === 0 ? 'text-indigo-400' : 'text-violet-400/80'
                        )}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11.5px] font-semibold text-white/85 group-hover:text-white transition-colors truncate">
                        {suggestion.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1.5 py-0 h-4 font-mono',
                          idx === 0
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            : 'bg-transparent text-white/30 border-white/10'
                        )}
                      >
                        {suggestion.confidence}%
                      </Badge>

                      <button
                        type="button"
                        onClick={(e) => onCopyOption(suggestion.content, suggestion.id, e)}
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-all text-[9.5px] flex items-center gap-0.5"
                        title="Sao chép phương án này"
                      >
                        {copiedOptionId === suggestion.id ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        <span>{copiedOptionId === suggestion.id ? 'Đã chép' : 'Copy'}</span>
                      </button>

                      {showTranslate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleTranslation(trKey, suggestion.content)
                          }}
                          disabled={tr?.busy}
                          className={cn(
                            'p-1 rounded transition-all text-[9.5px] flex items-center gap-0.5 disabled:opacity-60',
                            showingVi
                              ? 'text-sky-200 hover:bg-sky-500/15'
                              : 'text-white/40 hover:bg-white/10 hover:text-white'
                          )}
                          title="Dịch phương án này sang tiếng Việt"
                        >
                          {tr?.busy ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-300" />
                          ) : (
                            <Languages className="w-2.5 h-2.5 text-sky-300" />
                          )}
                          <span>
                            {tr?.busy ? 'Đang dịch' : showingVi ? 'Bản gốc' : 'Dịch'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11.5px] leading-relaxed text-white/70 group-hover:text-white/90 transition-colors whitespace-pre-line">
                    {displayContent}
                  </p>

                  {showTranslate && tr?.error && (
                    <p className="text-[9.5px] text-rose-300/85 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                      <span>{tr.error}</span>
                    </p>
                  )}

                  {idx === 0 && (
                    <div className="mt-2 pt-1.5 border-t border-indigo-500/15 flex items-center justify-between text-[9.5px] text-indigo-300/60 font-mono">
                      <span>✨ Phương án ưu tiên từ LLM</span>
                      <span className="text-white/30">1-click copy để phản hồi</span>
                    </div>
                  )}
                </div>
                )
              })}

              {/* ACTION TOOLBAR */}
              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/[0.06] mt-2">
                <Button
                  id="btn-copy-answer"
                  size="sm"
                  variant="outline"
                  onClick={onCopyAnswer}
                  className={cn(
                    'h-5 text-[9.5px] px-2 gap-1 border transition-all font-medium',
                    copiedAnswer
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                  )}
                  title="Sao chép toàn bộ phương án thảo luận để dán vào chat/notes"
                >
                  {copiedAnswer ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Đã chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-violet-300" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                <Button
                  id="btn-shorten-answer"
                  size="sm"
                  variant="outline"
                  onClick={onToggleShorten}
                  className={cn(
                    'h-5 text-[9.5px] px-2 gap-1 border transition-all font-medium',
                    isShortened
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                  )}
                  title="Rút gọn nội dung các phương án thảo luận"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{isShortened ? 'Mở rộng' : 'Làm ngắn'}</span>
                </Button>

                <Button
                  id="btn-regenerate-answer"
                  size="sm"
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="h-5 text-[9.5px] px-2 gap-1 bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white transition-all font-medium"
                  title="Gọi lại LLM để lấy phương án khác"
                >
                  <RotateCcw className={cn('w-2.5 h-2.5 text-violet-400', isRegenerating && 'animate-spin')} />
                  <span>{isRegenerating ? 'Đang tạo...' : 'Tạo lại'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
