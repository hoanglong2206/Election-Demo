import { useEffect } from 'react'
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  X,
  Loader2,
  RefreshCw,
  Award,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CvJdMatchResult } from '@/services/ai-model/context'

export interface CvJdMatchDialogProps {
  open: boolean
  result: CvJdMatchResult | null
  isAnalyzing: boolean
  onClose: () => void
  onReAnalyzeWithAI: () => void
}

export function CvJdMatchDialog({
  open,
  result,
  isAnalyzing,
  onClose,
  onReAnalyzeWithAI,
}: CvJdMatchDialogProps) {
  // Keyboard listener: Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !result) return null

  const { score, level, summary, matchedKeywords, missingKeywords, strengths, recommendations, isAI } = result

  const scoreColor =
    score >= 80
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : score >= 65
      ? 'text-violet-400 border-violet-500/40 bg-violet-500/10'
      : score >= 45
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/40 bg-rose-500/10'

  const scoreLabel =
    level === 'excellent'
      ? 'Rất phù hợp (Excellent Fit)'
      : level === 'good'
      ? 'Phù hợp tốt (Good Fit)'
      : level === 'moderate'
      ? 'Tương đối phù hợp (Moderate)'
      : 'Cần bổ sung nhiều (Low Fit)'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Dialog container */}
      <div
        className={cn(
          'relative z-10 w-full max-w-[620px] max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl',
          'bg-gradient-to-br from-[#12131f]/95 via-[#0e101c]/95 to-[#090b14]/95',
          'border-white/[0.12] backdrop-blur-xl overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px -10px rgba(139, 92, 246, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white tracking-wide flex items-center gap-2">
                <span>So Khớp Hồ Sơ CV & Yêu Cầu Tuyển Dụng (JD)</span>
                {isAI ? (
                  <Badge variant="outline" className="text-[9px] bg-violet-500/20 text-violet-300 border-violet-500/30 px-1.5 py-0 h-4">
                    <Zap className="w-2.5 h-2.5 mr-0.5 text-amber-300 inline" />
                    AI Phân tích
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] bg-white/5 text-white/50 border-white/10 px-1.5 py-0 h-4">
                    Heuristic tức thì
                  </Badge>
                )}
              </h2>
              <p className="text-[10px] text-white/40">
                Đánh giá mức độ tương thích và chuẩn bị luận điểm trước khi vào phỏng vấn
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Hero Score Box */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            {/* Circular Score Badge */}
            <div
              className={cn(
                'w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 shadow-lg',
                scoreColor
              )}
            >
              <span className="text-2xl font-bold font-mono tracking-tight leading-none">
                {score}%
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80 mt-0.5">
                Match
              </span>
            </div>

            {/* Score info & Summary */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white/95">
                  {scoreLabel}
                </span>
                <span className="text-[10px] text-white/35 font-mono">
                  &bull; {matchedKeywords.length} kỹ năng khớp / {missingKeywords.length} kỹ năng thiếu
                </span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                {summary}
              </p>
            </div>
          </div>

          {/* 2-Column: Matched vs Missing Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Column 1: Matched Keywords */}
            <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 flex flex-col">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kỹ Năng Đã Khớp ({matchedKeywords.length})</span>
                </span>
              </div>

              {matchedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {matchedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-white/40 italic">
                  Chưa phát hiện từ khóa công nghệ trùng khớp rõ ràng giữa CV và JD.
                </p>
              )}
            </div>

            {/* Column 2: Missing Keywords */}
            <div className="p-3.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 flex flex-col">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Từ Khóa Còn Thiếu ({missingKeywords.length})</span>
                </span>
              </div>

              {missingKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {missingKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/15 text-rose-200 border border-rose-500/30"
                      title="Kỹ năng yêu cầu trong JD nhưng chưa tìm thấy trong CV"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-emerald-300/80 italic">
                  Tuyệt vời! CV đã bao phủ hầu hết các từ khóa kỹ thuật trọng tâm của JD.
                </p>
              )}
            </div>
          </div>

          {/* Strengths */}
          {strengths && strengths.length > 0 && (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-2 text-violet-300 text-[11px] font-semibold">
                <Award className="w-3.5 h-3.5 text-violet-400" />
                <span>Thế Mạnh Nổi Bật Đối Chiếu Theo JD</span>
              </div>
              <ul className="space-y-1.5">
                {strengths.map((str, i) => (
                  <li key={i} className="text-[11px] text-white/75 flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview Defense Strategies */}
          {recommendations && recommendations.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/[0.03] border border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-2 text-amber-300 text-[11px] font-semibold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Chiến Thuật Ứng Biến Khi Phỏng Vấn (Defense Strategy)</span>
              </div>
              <ul className="space-y-1.5">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-[11px] text-white/75 flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08] bg-white/[0.02]">
          <Button
            size="sm"
            variant="outline"
            onClick={onReAnalyzeWithAI}
            disabled={isAnalyzing}
            className="text-[11px] h-7 px-3 gap-1.5 bg-gradient-to-r from-violet-600/30 to-indigo-600/30 hover:from-violet-600/50 hover:to-indigo-600/50 text-violet-200 border-violet-500/35 transition-all"
            title="Sử dụng LLM quét sâu toàn diện ngữ cảnh giữa CV và JD"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                <span>AI đang phân tích sâu...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 text-amber-300" />
                <span>Phân tích lại bằng AI (Deep Scan)</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={onClose}
            className="text-[11px] h-7 px-4 bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Đã rõ & Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
