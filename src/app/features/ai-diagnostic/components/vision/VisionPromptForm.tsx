import { Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'

export interface VisionPromptFormProps {
  userContext: string
  onUserContextChange: (val: string) => void
  selectedImplementationLanguage: string
  onSelectImplementationLanguage: (lang: string) => void
  onAnalyzeImage: () => void
  isAnalyzing: boolean
  hasCapturedImage: boolean
  isNoModel: boolean
}

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Tự động theo bài toán' },
  { value: 'python', label: 'Python (Khuyên dùng)' },
  { value: 'typescript', label: 'TypeScript / JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go (Golang)' },
  { value: 'sql', label: 'SQL' },
]

export function VisionPromptForm({
  userContext,
  onUserContextChange,
  selectedImplementationLanguage,
  onSelectImplementationLanguage,
  onAnalyzeImage,
  isAnalyzing,
  hasCapturedImage,
  isNoModel,
}: VisionPromptFormProps) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* User Context Textarea */}
        <div className="md:col-span-2 space-y-1">
          <label className="text-[11px] font-medium text-white/70 block">
            Ngữ cảnh hoặc câu hỏi bổ sung (tùy chọn):
          </label>
          <input
            type="text"
            value={userContext}
            onChange={(e) => onUserContextChange(e.target.value)}
            placeholder="Ví dụ: Giải bằng phương pháp Quy hoạch động O(N)..."
            className="w-full text-xs bg-[#0d111d] border border-white/10 rounded-xl px-3 py-2 text-white/90 placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
        </div>

        {/* Implementation Language Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-white/70 block">
            Ngôn ngữ lập trình lời giải:
          </label>
          <CustomSelect
            value={selectedImplementationLanguage}
            onChange={onSelectImplementationLanguage}
            options={LANGUAGE_OPTIONS}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10.5px] text-white/40">
          Chỉ gửi ảnh và ngữ cảnh tới mô hình Vision được chọn; không lưu trữ vĩnh viễn.
        </span>

        <Button
          id="btn-run-vision-analysis"
          size="sm"
          onClick={onAnalyzeImage}
          disabled={!hasCapturedImage || isAnalyzing || isNoModel}
          className={cn(
            'text-[11px] h-8 px-4 gap-1.5 shadow-sm font-medium transition-all shrink-0',
            !hasCapturedImage || isNoModel
              ? 'bg-white/10 text-white/40 cursor-not-allowed hover:bg-white/10'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          )}
        >
          {isAnalyzing ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>AI đang phân tích ảnh...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-emerald-200 fill-emerald-200" />
              <span>Phân Tích Bằng AI</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
