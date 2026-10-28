import { useState } from 'react'
import {
  Code,
  CheckCircle2,
  Copy,
  Check,
  Lightbulb,
  Sparkles,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import type { VisualAnalysisResult } from '@/services/screen-capture/types'
import { useVietnameseTranslation } from '@/hooks/useVietnameseTranslation'

export interface VisionResultViewProps {
  analysisResult: VisualAnalysisResult | null
  showTranslate: boolean
  selectedImplementationLanguage: string
  onSelectImplementationLanguage: (language: string) => void
  onReanalyzeWithLanguage: () => void
  isAnalyzing: boolean
}

export function VisionResultView({
  analysisResult,
  showTranslate,
  selectedImplementationLanguage,
  onSelectImplementationLanguage,
  onReanalyzeWithLanguage,
  isAnalyzing,
}: VisionResultViewProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const { entries: translations, toggle: toggleTranslation } =
    useVietnameseTranslation()
  const answerTranslation = translations['vision-answer']

  const handleCopyCode = () => {
    if (analysisResult?.extractedCode) {
      navigator.clipboard.writeText(analysisResult.extractedCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleCopyAnswer = () => {
    if (analysisResult?.recommendedAnswer) {
      navigator.clipboard.writeText(analysisResult.recommendedAnswer)
      setCopiedAnswer(true)
      setTimeout(() => setCopiedAnswer(false), 2000)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[220px] bg-black/40 border border-white/[0.08] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between text-white/50 text-[10.5px] pb-1.5 border-b border-white/[0.05]">
        <span className="font-medium text-white/70 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          Kết quả nhận diện & Phân tích từ Vision
          {analysisResult?.timestamp && (
            <span className="text-white/30 text-[9.5px]">
              ({analysisResult.timestamp})
            </span>
          )}
        </span>

        {analysisResult?.latencyMs && (
          <span className="text-[10px] text-white/40 font-mono">
            Độ trễ xử lý: {analysisResult.latencyMs}ms
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar space-y-3 pr-1 text-xs text-white/90">
        {analysisResult ? (
          <div className="space-y-3 animate-fade-in">
            {/* Problem Title & Meta Badges */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-white/95 leading-tight">
                  {analysisResult.title}
                </h4>
                {analysisResult.problemSummary && (
                  <p className="text-[11.5px] text-white/60 mt-1 leading-relaxed">
                    {analysisResult.problemSummary}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {analysisResult.difficulty && (
                  <Badge
                    className={cn(
                      'text-[9px] px-1.5 py-0 border font-semibold',
                      analysisResult.difficulty === 'Easy'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : analysisResult.difficulty === 'Medium'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    )}
                  >
                    {analysisResult.difficulty}
                  </Badge>
                )}

                {analysisResult.language && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 text-cyan-300 border-cyan-500/30"
                  >
                    {analysisResult.language}
                  </Badge>
                )}
              </div>
            </div>

            {/* Extracted Code if available */}
            {analysisResult.extractedCode && (
              <div className="space-y-1 bg-slate-950/80 border border-white/10 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-[10px] text-white/40 pb-1 border-b border-white/[0.06]">
                  <span className="flex items-center gap-1 font-mono text-cyan-400">
                    <Code className="w-3 h-3" />
                    Mã nguồn trích xuất từ ảnh
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto custom-scrollbar p-1">
                  {analysisResult.extractedCode}
                </pre>
              </div>
            )}

            {/* Language Switcher Bar for Coding Question */}
            {analysisResult.contentType === 'coding_question' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/25 via-cyan-950/10 to-transparent p-2.5 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <Code className="w-3 h-3 text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-cyan-200 leading-tight">
                      Ngôn ngữ lời giải
                    </div>
                    <div className="text-[9.5px] text-white/40 leading-tight truncate">
                      {analysisResult.language
                        ? `Đang dùng: ${
                            selectedImplementationLanguage ||
                            analysisResult.language
                          } (bấm để đổi ngôn ngữ)`
                        : 'Tự động nhận diện theo đề bài hoặc chọn ngôn ngữ'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-48 sm:w-56 shrink-0">
                    <CustomSelect
                      value={selectedImplementationLanguage || ''}
                      onChange={(val) => onSelectImplementationLanguage(val)}
                      options={[
                        {
                          value: '',
                          label: analysisResult.language
                            ? `Tự nhận diện (${analysisResult.language})`
                            : 'Tự nhận diện',
                          subLabel: analysisResult.language
                            ? `Mặc định theo đề bài (${analysisResult.language})`
                            : 'Tự động nhận diện theo đề bài',
                          badge: 'AUTO',
                        },
                        {
                          value: 'TypeScript',
                          label: 'TypeScript',
                          badge: 'TS',
                        },
                        { value: 'Python', label: 'Python', badge: 'PY' },
                        { value: 'Java', label: 'Java', badge: 'JAVA' },
                        { value: 'Go', label: 'Go (Golang)', badge: 'GO' },
                        { value: 'C++', label: 'C++', badge: 'CPP' },
                        { value: 'C#', label: 'C#', badge: 'CS' },
                        {
                          value: 'JavaScript',
                          label: 'JavaScript',
                          badge: 'JS',
                        },
                        { value: 'Rust', label: 'Rust', badge: 'RS' },
                      ]}
                      themeColor="cyan"
                      triggerClassName="h-7 text-[11px] py-1 px-2.5 bg-black/60 border-cyan-500/30 text-cyan-100 hover:border-cyan-400/50 hover:bg-cyan-950/30 shadow-sm"
                      menuClassName="min-w-[220px]"
                    />
                  </div>

                  {selectedImplementationLanguage &&
                    selectedImplementationLanguage !==
                      analysisResult.language && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={onReanalyzeWithLanguage}
                        disabled={isAnalyzing}
                        className="h-6 px-2.5 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shrink-0 whitespace-nowrap transition-all"
                        title="Gọi lại Vision để sinh lời giải theo ngôn ngữ đã chọn"
                      >
                        {isAnalyzing ? 'Đang sinh...' : 'Sinh lại'}
                      </Button>
                    )}
                </div>
              </div>
            )}

            {/* Optimal Solution Code */}
            {analysisResult.solutionCode && (
              <div className="space-y-1 bg-emerald-950/20 border border-emerald-500/25 rounded-lg p-2.5">
                <span className="text-[10.5px] font-semibold text-emerald-300 flex items-center gap-1">
                  <Code className="w-3 h-3 text-emerald-400" />
                  Lời giải tối ưu (
                  {analysisResult.language || 'ngôn ngữ được nhận diện'}):
                </span>
                <pre className="text-[11px] font-mono text-emerald-200 overflow-x-auto whitespace-pre-wrap">
                  {analysisResult.solutionCode}
                </pre>
              </div>
            )}

            {/* Key Insights & Strategy */}
            {analysisResult.keyInsights &&
              analysisResult.keyInsights.length > 0 && (
                <div className="space-y-1.5 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                  <span className="text-[10.5px] font-semibold text-amber-300 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-amber-400" />
                    Điểm then chốt & Edge Cases:
                  </span>
                  <ul className="space-y-1">
                    {analysisResult.keyInsights.map((insight, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] text-white/75 leading-relaxed"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Step by Step Solution & Complexity */}
            {analysisResult.stepByStepSolution && (
              <div className="space-y-1 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                <span className="text-[10.5px] font-semibold text-violet-300 flex items-center gap-1">
                  <Code className="w-3 h-3 text-violet-400" />
                  Các bước giải quyết & Độ phức tạp:
                </span>
                <p className="text-[11px] text-white/75 leading-relaxed whitespace-pre-wrap">
                  {analysisResult.stepByStepSolution}
                </p>
                {(analysisResult.timeComplexity ||
                  analysisResult.spaceComplexity) && (
                  <div className="border-t border-white/[0.05] pt-1 text-[10.5px] text-violet-200/80">
                    {analysisResult.timeComplexity && (
                      <div>Time: {analysisResult.timeComplexity}</div>
                    )}
                    {analysisResult.spaceComplexity && (
                      <div>Space: {analysisResult.spaceComplexity}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recommended Interviewer Answer */}
            {analysisResult.recommendedAnswer && (
              <div className="space-y-1.5 bg-emerald-950/20 border border-emerald-500/25 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Gợi ý trả lời tự tin với Interviewer:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAnswer}
                    className="text-emerald-400/70 hover:text-emerald-300 transition-colors"
                    title="Sao chép lời nói"
                  >
                    {copiedAnswer ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                {showTranslate && (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleTranslation(
                        'vision-answer',
                        analysisResult.recommendedAnswer
                      )
                    }
                    disabled={answerTranslation?.busy}
                    className="text-[10px] text-emerald-300 hover:text-emerald-200"
                  >
                    {answerTranslation?.busy
                      ? 'Đang dịch...'
                      : answerTranslation?.showing
                      ? 'Hiện bản gốc'
                      : 'Dịch sang tiếng Việt'}
                  </button>
                )}
                <p className="text-[11px] text-emerald-100/90 leading-relaxed font-sans whitespace-pre-wrap">
                  {answerTranslation?.showing && answerTranslation.text
                    ? answerTranslation.text
                    : analysisResult.recommendedAnswer}
                </p>
                {answerTranslation?.error && (
                  <p className="text-[10px] text-rose-300">
                    {answerTranslation.error}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 text-white/30 space-y-1">
            <Eye className="w-6 h-6 text-white/20" />
            <p className="text-[11px]">Chưa có kết quả phân tích hình ảnh.</p>
            <p className="text-[10px] text-white/25">
              Chụp màn hình bài toán phỏng vấn hoặc chọn đề bài mẫu để AI Vision
              phân tích.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
