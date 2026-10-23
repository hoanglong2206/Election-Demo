import { useState } from 'react'
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
import type { VisualQuestionItem, VisualContentType } from '../../../services/screen-capture/types'

interface VisualQuestionCardProps {
  item: VisualQuestionItem
  onDismiss?: () => void
  onRetake?: () => void
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
        label: 'Technical Question',
        color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
        icon: HelpCircle,
      }
  }
}

export function VisualQuestionCard({
  item,
  onDismiss,
  onRetake,
}: VisualQuestionCardProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const meta = getContentTypeMeta(item.contentType)
  const IconComponent = meta.icon

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(item.recommendedAnswer)
    setCopiedAnswer(true)
    setTimeout(() => setCopiedAnswer(false), 2000)
  }

  const handleCopyCode = () => {
    if (!item.extractedCode) return
    navigator.clipboard.writeText(item.extractedCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="relative rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/30 via-slate-900/60 to-black/70 p-4 shadow-xl backdrop-blur-md transition-all space-y-3">
      {/* Top Banner: Distinguishes Visual Question from Voice Transcript */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2.5 py-0.5 bg-violet-600/25 text-violet-300 border-violet-400/40 text-[11px] font-semibold tracking-wide"
          >
            <Camera className="w-3.5 h-3.5 text-violet-300" />
            <span>TỪ ẢNH MÀN HÌNH (VISUAL)</span>
          </Badge>

          <Badge variant="outline" className={cn('text-[10px] font-medium font-mono', meta.color)}>
            <IconComponent className="w-3 h-3" />
            <span>{meta.label}</span>
          </Badge>

          {item.language && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/20 font-mono">
              {item.language}
            </Badge>
          )}

          {item.difficulty && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono',
                item.difficulty === 'Hard'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  : item.difficulty === 'Medium'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              )}
            >
              {item.difficulty}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/40 font-mono mr-1">
            {item.timestamp} · {item.modelName} ({item.latencyMs}ms)
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {onRetake && (
            <button
              onClick={onRetake}
              className="p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              title="Chụp lại màn hình"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              title="Đóng câu hỏi màn hình"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-3.5 items-start">
        {/* Thumbnail Preview with Lightbox Trigger */}
        {item.thumbnailUrl && (
          <div
            onClick={() => setShowFullImage(true)}
            className="group relative w-20 h-20 rounded-xl overflow-hidden border border-white/15 bg-black/40 flex-shrink-0 cursor-pointer shadow-md hover:border-violet-400 transition-all"
            title="Bấm để xem ảnh gốc"
          >
            <img src={item.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <ExternalLink className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span className="truncate">{item.title}</span>
          </h3>
          <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
            {item.problemSummary}
          </p>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-3 pt-1 text-xs">
          {/* Key Insights List */}
          {item.keyInsights && item.keyInsights.length > 0 && (
            <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/5 space-y-1">
              <span className="text-[10px] font-semibold text-violet-300 uppercase tracking-wider block">
                Điểm then chốt & Ràng buộc (Constraints / Insights):
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-white/80 text-[11.5px] leading-relaxed">
                {item.keyInsights.map((insight, idx) => (
                  <li key={idx} className="marker:text-violet-400">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Extracted Code Block */}
          {item.extractedCode && (
            <div className="relative rounded-xl bg-black/60 border border-white/10 p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto space-y-1">
              <div className="flex items-center justify-between pb-1 border-b border-white/10 text-[9.5px] text-white/40">
                <span>MÃ NGUỒN TRÍCH XUẤT</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Đã copy' : 'Copy code'}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap">{item.extractedCode}</pre>
            </div>
          )}

          {/* Step-by-step Solution */}
          {item.stepByStepSolution && (
            <div className="bg-white/[0.02] rounded-xl p-2.5 border border-white/5 space-y-1">
              <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider block">
                Thuật toán & Độ phức tạp (Algorithm):
              </span>
              <p className="text-[11.5px] text-white/80 whitespace-pre-wrap leading-relaxed">
                {item.stepByStepSolution}
              </p>
            </div>
          )}

          {/* Recommended Talking Answer (Main Value for Interview/Meeting) */}
          <div className="rounded-xl bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border border-violet-500/30 p-3 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Gợi ý trả lời ngay (Nói trực tiếp):</span>
              </span>

              <button
                onClick={handleCopyAnswer}
                className="flex items-center gap-1 text-[11px] font-medium text-violet-300 hover:text-white transition-colors"
              >
                {copiedAnswer ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAnswer ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>

            <p className="text-[12px] text-white/95 leading-relaxed whitespace-pre-wrap font-sans">
              {item.recommendedAnswer}
            </p>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full Image Zoom */}
      {showFullImage && item.thumbnailUrl && (
        <div
          onClick={() => setShowFullImage(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl max-h-[85vh] rounded-xl overflow-hidden border border-white/20 shadow-2xl">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={item.thumbnailUrl} alt="Screenshot full" className="w-full h-auto max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
