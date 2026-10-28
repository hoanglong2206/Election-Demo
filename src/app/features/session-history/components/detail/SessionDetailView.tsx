import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import type { MeetingSession } from '@/services/session-history'
import type { DetailTab } from '../../types'
import {
  buildChronologicalTimeline,
  sortTranscriptsChronologically,
} from '../../utils/sessionFormatters'
import { DetailHeaderMeta } from './DetailHeaderMeta'
import { DetailNavTabs } from './DetailNavTabs'
import { TimelineTabView } from './TimelineTabView'
import { TranscriptTabView } from './TranscriptTabView'
import { SuggestionsTabView } from './SuggestionsTabView'
import { ScreenshotsTabView } from './ScreenshotsTabView'
import { SplitTabView } from './SplitTabView'
import { ScreenshotLightboxModal } from './ScreenshotLightboxModal'

export interface SessionDetailViewProps {
  currentSession: MeetingSession | null
  detailTab: DetailTab
  copiedId: number | null
  onDetailTabChange: (tab: DetailTab) => void
  onCopyText: (text: string, id: number) => void
  onRenameSession?: (id: string, newTitle: string) => void
  isEditingTitleExternal?: boolean
  onFinishRename?: () => void
}

export function SessionDetailView({
  currentSession,
  detailTab,
  copiedId,
  onDetailTabChange,
  onCopyText,
  onRenameSession,
  isEditingTitleExternal,
  onFinishRename,
}: SessionDetailViewProps) {
  // Focused / Highlighted item when user clicks a timestamp
  const [highlightedId, setHighlightedId] = useState<string | number | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pagination for long meetings
  const [visibleCount, setVisibleCount] = useState(40)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleCount(40)
      setHighlightedId(null)
    }, 0)
    return () => clearTimeout(timer)
  }, [currentSession?.id, detailTab])

  // Construct Unified Chronological Timeline
  const timelineItems = useMemo(() => {
    return buildChronologicalTimeline(currentSession)
  }, [currentSession])

  // Click timestamp to correlate context
  const handleTimestampClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const targetId = e.currentTarget.dataset.targetId
    if (!targetId) return
    setHighlightedId(targetId)
    const el = document.getElementById(`timeline-item-${targetId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedId((prev) => (String(prev) === String(targetId) ? null : prev))
    }, 3000)
  }, [])

  const sortedTranscripts = useMemo(() => {
    return sortTranscriptsChronologically(currentSession?.transcripts)
  }, [currentSession?.transcripts])

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/35 text-[11.5px] bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center gap-2">
        <MessageSquare className="w-8 h-8 text-white/15" />
        <div className="font-medium text-white/60">Chưa có phiên họp nào được chọn</div>
        <p className="text-[10.5px] text-white/30 max-w-sm leading-relaxed">
          Khi bạn lưu lại cuộc họp từ chế độ Cuộc họp (Meeting Mode), toàn bộ transcript timeline song ngữ, câu trả lời gợi ý của AI và câu hỏi hình ảnh sẽ xuất hiện tại đây.
        </p>
      </div>
    )
  }

  const screenshotCount = currentSession.screenshotQuestions?.length || 0

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden shadow-sm">
      {/* Top Header: Title, Renaming & Meta Badges */}
      <DetailHeaderMeta
        currentSession={currentSession}
        totalTimelineCount={timelineItems.length}
        isEditingTitleExternal={isEditingTitleExternal}
        onRenameSession={onRenameSession}
        onFinishRename={onFinishRename}
      />

      {/* Detail Navigation Tabs */}
      <DetailNavTabs
        detailTab={detailTab}
        onDetailTabChange={onDetailTabChange}
        screenshotCount={screenshotCount}
      />

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {detailTab === 'timeline' && (
          <TimelineTabView
            timelineItems={timelineItems}
            visibleCount={visibleCount}
            highlightedId={highlightedId}
            copiedId={copiedId}
            onTimestampClick={handleTimestampClick}
            onCopyText={onCopyText}
            onPreviewImage={(url) => setPreviewImageUrl(url)}
            onLoadMore={() => setVisibleCount((prev) => prev + 40)}
          />
        )}

        {detailTab === 'transcript' && (
          <TranscriptTabView
            sortedTranscripts={sortedTranscripts}
            visibleCount={visibleCount}
            copiedId={copiedId}
            onCopyText={onCopyText}
            onLoadMore={() => setVisibleCount((prev) => prev + 50)}
          />
        )}

        {detailTab === 'suggestions' && (
          <SuggestionsTabView
            suggestions={currentSession.suggestions}
            copiedId={copiedId}
            onCopyText={onCopyText}
          />
        )}

        {detailTab === 'screenshots' && (
          <ScreenshotsTabView
            screenshotQuestions={currentSession.screenshotQuestions}
            onPreviewImage={(url) => setPreviewImageUrl(url)}
          />
        )}

        {detailTab === 'split' && (
          <SplitTabView
            sortedTranscripts={sortedTranscripts}
            suggestions={currentSession.suggestions}
          />
        )}
      </div>

      {/* Screenshot Full Size Modal / Lightbox */}
      <ScreenshotLightboxModal
        imageUrl={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  )
}

