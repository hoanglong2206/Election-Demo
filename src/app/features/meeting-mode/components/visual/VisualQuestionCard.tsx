import { useState } from 'react'
import { useVietnameseTranslation } from '@/hooks/useVietnameseTranslation'
import {
  Camera,
  Code2,
  Bug,
  Network,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { VisualQuestionItem, VisualContentType } from '@/services/screen-capture/types'

export interface VisualQuestionCardProps {
  item: VisualQuestionItem
  onDismiss?: () => void
  onRetake?: () => void
  showTranslate?: boolean
}

function getContentTypeMeta(type: VisualContentType) {
  switch (type) {
    case 'coding_question':
      return {
        label: 'Coding & Algorithm',
        color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: Code2,
      }
    case 'error_trace':
      return {
        label: 'Error & Debugging',
        color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        icon: Bug,
      }
    case 'architecture_diagram':
    case 'system_design':
      return {
        label: 'System Design & Architecture',
        color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        icon: Network,
      }
    case 'text_question':
    default:
      return {
        label: 'Câu hỏi Màn hình',
        color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
        icon: HelpCircle,
      }
  }
}

export function VisualQuestionCard({
  item,
  onDismiss,
  onRetake,
  showTranslate = false,
}: VisualQuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copiedSection, setCopiedSection] = useState<'answer' | 'code' | null>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  const meta = getContentTypeMeta(item.contentType)
  const IconComponent = meta.icon

  const { entries: translations, toggle: toggleTranslation } = useVietnameseTranslation()
  const answerTranslation = translations['visual-answer']

  const handleCopy = (text: string, section: 'answer' | 'code') => {
    navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-[#161622]/95 backdrop-blur-md overflow-hidden shadow-xl mb-3 animate-fade-in shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-transparent border-b border-white/[0.08]">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className={cn('px-2 py-0.5 text-[10px] font-medium border flex items-center gap-1', meta.color)}>
            <IconComponent className="w-3 h-3" />
            <span>{meta.label}</span>
          </Badge>
          <span className="text-[11px] font-mono text-white/40">{item.timestamp}</span>
        </div>

        <div className="flex items-center gap-1">
          {onRetake && (
            <button
              onClick={onRetake}
              className="text-[10px] px-2 py-0.5 rounded text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-1"
              title="Chụp lại ảnh khác"
            >
              <Camera className="w-2.5 h-2.5 text-emerald-400" />
              <span>Chụp lại</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded text-white/40 hover:text-rose-400 hover:bg-white/5 transition-colors ml-1"
              title="Đóng câu hỏi hình ảnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* Problem Summary & Image Thumbnail */}
          <div className="flex gap-3">
            <div className="relative group shrink-0 cursor-pointer" onClick={() => setIsImageModalOpen(true)}>
              <img
                src={item.thumbnailUrl}
                alt="Screenshot Thumbnail"
                className="w-24 h-16 object-cover rounded-lg border border-white/10 group-hover:border-violet-500/50 transition-colors"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                <ExternalLink className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/95 text-[12.5px] leading-snug">{item.problemSummary}</p>
              {item.extractedCode && (
                <span className="inline-block mt-1 text-[10px] font-mono text-violet-300/80 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                  Phát hiện đoạn mã code
                </span>
              )}
            </div>
          </div>

          {/* Recommended Answer */}
          <div className="rounded-lg bg-black/40 border border-white/[0.06] p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Giải pháp & Hướng trả lời</span>
              </span>
              <button
                onClick={() => handleCopy(item.recommendedAnswer, 'answer')}
                className="text-[10px] text-white/50 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
              >
                {copiedSection === 'answer' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === 'answer' ? 'Đã copy' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-white/85 text-[11.5px] leading-relaxed whitespace-pre-wrap">{item.recommendedAnswer}</p>

            {showTranslate && (
              <button
                type="button"
                onClick={() => void toggleTranslation('visual-answer', item.recommendedAnswer)}
                disabled={answerTranslation?.busy}
                className="text-[10px] text-violet-300 hover:text-violet-200 mt-1 block"
              >
                {answerTranslation?.busy ? 'Đang dịch...' : answerTranslation?.showing ? 'Hiện bản gốc' : 'Dịch sang tiếng Việt'}
              </button>
            )}
            {showTranslate && answerTranslation?.showing && answerTranslation.text && (
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] text-indigo-300/80 font-medium mb-0.5">Bản dịch tiếng Việt:</p>
                <p className="text-white/75 text-[11px] leading-relaxed whitespace-pre-wrap">{answerTranslation.text}</p>
              </div>
            )}
            {showTranslate && answerTranslation?.busy && (
              <p className="text-[10px] text-white/30 italic animate-pulse mt-1">Đang dịch sang tiếng Việt...</p>
            )}
            {showTranslate && answerTranslation?.error && (
              <p className="text-[10px] text-rose-300 mt-1">{answerTranslation.error}</p>
            )}
          </div>

          {/* Key Insights */}
          {item.keyInsights && item.keyInsights.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10.5px] font-semibold text-white/60">Điểm cốt lõi cần nêu:</span>
              <ul className="list-disc list-inside space-y-0.5 text-white/75 text-[11px] pl-1">
                {item.keyInsights.map((insight, idx) => (
                  <li key={idx} className="leading-snug">
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Extracted Code Snippet */}
          {item.extractedCode && (
            <div className="rounded-lg bg-black/60 border border-white/10 p-2 font-mono text-[11px]">
              <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/10 text-[10px] text-white/40">
                <span>Code snippet / Lời giải</span>
                <button
                  onClick={() => handleCopy(item.extractedCode!, 'code')}
                  className="hover:text-white flex items-center gap-1"
                >
                  {copiedSection === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === 'code' ? 'Đã copy' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-emerald-300 overflow-x-auto p-1 leading-relaxed custom-scrollbar max-h-36">
                <code>{item.extractedCode}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Full Image Preview Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={item.thumbnailUrl} alt="Screenshot Full" className="max-w-full max-h-[85vh] rounded-xl border border-white/20 shadow-2xl" />
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
