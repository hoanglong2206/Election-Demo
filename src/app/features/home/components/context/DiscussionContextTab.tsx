import type { MeetingContextData } from '@/services/meeting-context'
import { TechnicalKeywordsSection } from './TechnicalKeywordsSection'

export interface DiscussionContextTabProps {
  contextData: MeetingContextData
  discussionTokens: number
  onContextChange: (data: MeetingContextData) => void
  onAddKeyword?: (kw: string) => void
  onRemoveKeyword?: (kw: string) => void
  onReExtractKeywords?: () => void
}

export function DiscussionContextTab({
  contextData,
  discussionTokens,
  onContextChange,
  onAddKeyword,
  onRemoveKeyword,
  onReExtractKeywords,
}: DiscussionContextTabProps) {
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 shrink-0 flex flex-col relative">
        <textarea
          id="input-discussion-text"
          value={contextData.discussionTopic || ''}
          onChange={(e) =>
            onContextChange({
              ...contextData,
              discussionTopic: e.target.value,
            })
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Điền chủ đề cuộc họp, bài toán kiến trúc hoặc tải lên tài liệu (.pdf, .docx)... Ví dụ: Thiết kế hệ thống Rate Limiting phân tán, xử lý cache stampede khi flash sale, hoặc di chuyển từ Monolith sang Microservices..."
          className="w-full h-full bg-[#0d111d] hover:bg-[#0f1424] focus:bg-[#0f1424] border border-white/[0.08] focus:border-indigo-500/50 rounded-xl p-2.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-none font-mono leading-relaxed custom-scrollbar transition-colors duration-150 caret-indigo-400"
        />
        <div className="absolute right-2 bottom-1.5 text-[8.5px] font-mono text-white/30 pointer-events-none bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.05]">
          {contextData.discussionTopic?.length || 0} ký tự • ~{discussionTokens} tok
        </div>
      </div>
      <TechnicalKeywordsSection
        mode="discussion"
        theme="indigo"
        keywords={contextData.discussionKeywords || []}
        onAddKeyword={onAddKeyword}
        onRemoveKeyword={onRemoveKeyword}
        onReExtractKeywords={onReExtractKeywords}
      />
    </div>
  )
}
