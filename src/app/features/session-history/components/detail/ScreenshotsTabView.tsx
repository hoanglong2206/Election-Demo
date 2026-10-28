import { Camera } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { HistoryScreenshotQuestion } from '@/services/sessionHistory'

export interface ScreenshotsTabViewProps {
  screenshotQuestions: HistoryScreenshotQuestion[] | undefined
  onPreviewImage: (url: string) => void
}

export function ScreenshotsTabView({
  screenshotQuestions = [],
  onPreviewImage,
}: ScreenshotsTabViewProps) {
  return (
    <ScrollArea className="h-full p-4 custom-scrollbar">
      <div className="space-y-4 max-w-3xl mx-auto">
        {screenshotQuestions.length === 0 ? (
          <div className="py-16 text-center text-white/35 text-xs">
            <Camera className="w-8 h-8 text-white/15 mx-auto mb-2" />
            <p className="font-medium text-white/50">Chưa có câu hỏi ảnh chụp màn hình</p>
            <p className="text-[10.5px] text-white/30 mt-1">
              Chưa có phân tích screenshot nào được thực hiện trong buổi họp này.
            </p>
          </div>
        ) : (
          screenshotQuestions.map((sq, idx) => (
            <div
              key={sq.id}
              className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-cyan-300 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Câu hỏi hình ảnh #{idx + 1}
                  <span className="text-[10px] text-cyan-400/60 font-mono">[{sq.timestamp}]</span>
                </span>
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-[10px]">
                  {sq.contentType || 'visual_question'}
                </Badge>
              </div>

              {sq.analysisResult?.questionSummary && (
                <div className="text-xs font-medium text-white/95">
                  {sq.analysisResult.questionSummary}
                </div>
              )}

              {(sq.imageUrl || sq.thumbnailUrl) && (
                <div className="relative group/screenshot rounded-lg overflow-hidden border border-cyan-500/25 bg-black/50 flex justify-center">
                  <img
                    src={sq.thumbnailUrl || sq.imageUrl}
                    alt={`Screenshot ${idx + 1}`}
                    loading="lazy"
                    onClick={() => onPreviewImage(sq.imageUrl || sq.thumbnailUrl || '')}
                    className="max-h-64 w-auto object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] text-cyan-300 pointer-events-none opacity-0 group-hover/screenshot:opacity-100 transition-opacity">
                    Bấm để xem kích thước đầy đủ
                  </div>
                </div>
              )}

              {sq.ocrText && (
                <div className="space-y-1">
                  <span className="text-[10px] text-white/40 font-medium">OCR Text:</span>
                  <pre className="p-2.5 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-white/70 overflow-x-auto whitespace-pre-wrap">
                    {sq.ocrText}
                  </pre>
                </div>
              )}

              {sq.analysisResult?.codeSnippet && (
                <div className="space-y-1">
                  <span className="text-[10px] text-cyan-300 font-medium">Code giải pháp:</span>
                  <pre className="p-3 rounded-lg bg-black/70 border border-cyan-500/25 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                    <code>{sq.analysisResult.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {sq.analysisResult?.suggestedAnswer && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-white/90 leading-relaxed">
                  <strong className="text-cyan-300 block mb-1">Gợi ý trả lời phỏng vấn:</strong>
                  {sq.analysisResult.suggestedAnswer}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  )
}

