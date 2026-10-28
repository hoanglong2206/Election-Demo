import { Check, AlertCircle } from 'lucide-react'
import type { MeetingContextData } from '@/services/meeting-context'
import { TechnicalKeywordsSection } from './TechnicalKeywordsSection'

export interface InterviewContextTabProps {
  interviewTab: 'cv' | 'jd'
  contextData: MeetingContextData
  cvTokens: number
  jdTokens: number
  hasCV: boolean
  hasJD: boolean
  isParsingDocument?: boolean
  onContextChange: (data: MeetingContextData) => void
  onAddKeyword?: (kw: string) => void
  onRemoveKeyword?: (kw: string) => void
  onReExtractKeywords?: () => void
  onTriggerFileUpload: () => void
  onLoadSampleCV: () => void
  onLoadSampleJD: () => void
}

export function InterviewContextTab({
  interviewTab,
  contextData,
  cvTokens,
  jdTokens,
  hasCV,
  hasJD,
  onContextChange,
  onAddKeyword,
  onRemoveKeyword,
  onReExtractKeywords,
}: InterviewContextTabProps) {
  if (interviewTab === 'cv') {
    return (
      <div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden gap-1">
        <textarea
          id="input-cv-text"
          value={contextData.cvSummary}
          onChange={(e) => onContextChange({ ...contextData, cvSummary: e.target.value })}
          autoComplete="off"
          spellCheck={false}
          placeholder="Dán tóm tắt CV, dự án thực tế, tech stack của bạn vào đây (hoặc nhấn Upload CV .pdf/.docx)... AI sẽ dùng kinh nghiệm này để trả lời phỏng vấn theo đúng thực tế."
          className="w-full flex-1 min-h-0 bg-[#0d111d] hover:bg-[#0f1424] focus:bg-[#0f1424] border border-white/[0.08] focus:border-violet-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-colors duration-150 caret-violet-400"
        />
        <div className="flex items-center justify-between px-1 text-[9px] text-white/40 shrink-0">
          <span className="truncate">
            {hasCV ? (
              <span className="text-emerald-400/90 flex items-center gap-1 font-medium">
                <Check className="w-2.5 h-2.5" />
                <span>CV đã nạp vào ngữ cảnh AI</span>
              </span>
            ) : contextData.cvSummary?.trim() ? (
              <span className="text-amber-400/90 flex items-center gap-1 font-medium">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>Nội dung quá ngắn hoặc chưa đúng định dạng CV</span>
              </span>
            ) : (
              <span>💡 Hỗ trợ nạp file PDF, DOCX, TXT hoặc dán trực tiếp CV</span>
            )}
          </span>
          <span className="font-mono text-white/30 shrink-0">
            {contextData.cvSummary?.length || 0} ký tự • ~{cvTokens} tok
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 shrink-0 flex flex-col relative">
        <textarea
          id="input-jd-text"
          value={contextData.jobDescription}
          onChange={(e) => onContextChange({ ...contextData, jobDescription: e.target.value })}
          autoComplete="off"
          spellCheck={false}
          placeholder="Dán yêu cầu tuyển dụng (JD) vào đây hoặc bấm Upload JD... Ví dụ: Vị trí Senior Software Engineer, yêu cầu Microservices, React, Docker, Golang..."
          className="w-full h-full bg-[#0d111d] hover:bg-[#0f1424] focus:bg-[#0f1424] border border-white/[0.08] focus:border-violet-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-colors duration-150 caret-violet-400"
        />
      </div>
      <div className="flex items-center justify-between px-1 py-1 text-[9px] text-white/40 shrink-0">
        <span className="truncate">
          {hasJD ? (
            <span className="text-emerald-400/90 flex items-center gap-1 font-medium">
              <Check className="w-2.5 h-2.5" />
              <span>JD đã nạp vào ngữ cảnh AI</span>
            </span>
          ) : contextData.jobDescription?.trim() ? (
            <span className="text-amber-400/90 flex items-center gap-1 font-medium">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Nội dung quá ngắn hoặc chưa đúng định dạng JD</span>
            </span>
          ) : (
            <span>💡 Dán yêu cầu tuyển dụng, tech stack và mô tả vị trí</span>
          )}
        </span>
        <span className="font-mono text-white/30 shrink-0">
          {contextData.jobDescription?.length || 0} ký tự • ~{jdTokens} tok
        </span>
      </div>
      <TechnicalKeywordsSection
        mode="interview"
        theme="violet"
        keywords={contextData.keywords || []}
        onAddKeyword={onAddKeyword}
        onRemoveKeyword={onRemoveKeyword}
        onReExtractKeywords={onReExtractKeywords}
      />
    </div>
  )
}
