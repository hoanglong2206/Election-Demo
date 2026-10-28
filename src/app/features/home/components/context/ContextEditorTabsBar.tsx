import { Upload, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'

export interface ContextEditorTabsBarProps {
  mode: AppMode
  interviewTab: 'cv' | 'jd'
  hasCV: boolean
  hasJD: boolean
  cvTokens: number
  jdTokens: number
  keywordsCount?: number
  discussionTokens: number
  isParsingDocument: boolean
  onInterviewTabChange: (tab: 'cv' | 'jd') => void
  onLoadSampleCV: () => void
  onLoadSampleJD: () => void
  onTriggerFileUpload: () => void
}

export function ContextEditorTabsBar({
  mode,
  interviewTab,
  hasCV,
  hasJD,
  cvTokens,
  jdTokens,
  keywordsCount = 0,
  discussionTokens,
  isParsingDocument,
  onInterviewTabChange,
  onLoadSampleCV,
  onLoadSampleJD,
  onTriggerFileUpload,
}: ContextEditorTabsBarProps) {
  return (
    <div className="h-7 flex items-center justify-between gap-1.5 shrink-0 min-w-0">
      {mode === 'interview' ? (
        <>
          <div className="flex items-center bg-black/45 p-0.5 rounded-lg border border-white/[0.08] shadow-inner min-w-0">
            <button
              type="button"
              id="tab-cv"
              onClick={() => onInterviewTabChange('cv')}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0',
                interviewTab === 'cv'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-semibold'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  hasCV ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-white/25'
                )}
              />
              <span>1. CV & Kinh Nghiệm</span>
              {cvTokens > 0 && (
                <span className="text-[8.5px] px-1 py-0 rounded bg-black/30 font-mono opacity-85">
                  {cvTokens}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-jd"
              onClick={() => onInterviewTabChange('jd')}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0',
                interviewTab === 'jd'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md font-semibold'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  hasJD ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-white/25'
                )}
              />
              <span>2. Mô Tả JD</span>
              {jdTokens > 0 && (
                <span className="text-[8.5px] px-1 py-0 rounded bg-black/30 font-mono opacity-85">
                  {jdTokens}
                </span>
              )}
              {keywordsCount > 0 && (
                <span className="text-[8px] bg-violet-400/25 text-violet-200 border border-violet-400/35 px-1 rounded-full font-mono shrink-0">
                  {keywordsCount} kw
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {interviewTab === 'cv' ? (
              <>
                <button
                  type="button"
                  id="btn-sample-cv"
                  onClick={onLoadSampleCV}
                  className="text-[10px] text-violet-300/80 hover:text-white underline underline-offset-2 whitespace-nowrap transition-colors"
                >
                  + Mẫu
                </button>
                <button
                  type="button"
                  id="btn-upload-cv"
                  disabled={isParsingDocument}
                  onClick={onTriggerFileUpload}
                  className={cn(
                    'text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm',
                    isParsingDocument
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait'
                      : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25'
                  )}
                  title="Upload file CV (.pdf, .docx, .txt, .md)"
                >
                  {isParsingDocument ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
                      <span>Đang đọc...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-2.5 h-2.5" />
                      <span>Upload CV</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-sample-jd"
                  onClick={onLoadSampleJD}
                  className="text-[10px] text-violet-300/80 hover:text-white underline underline-offset-2 whitespace-nowrap transition-colors"
                >
                  + Mẫu
                </button>
                <button
                  type="button"
                  id="btn-upload-jd"
                  disabled={isParsingDocument}
                  onClick={onTriggerFileUpload}
                  className={cn(
                    'text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm',
                    isParsingDocument
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait'
                      : 'text-violet-300 hover:text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25'
                  )}
                  title="Upload file JD (.pdf, .docx, .txt, .md)"
                >
                  {isParsingDocument ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
                      <span>Đang đọc...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-2.5 h-2.5" />
                      <span>Upload JD</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="text-[10.5px] font-medium text-indigo-300 flex items-center gap-1.5 truncate min-w-0">
            <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="truncate">Nội dung & Tài liệu thảo luận</span>
            {discussionTokens > 0 && (
              <span className="text-[8.5px] px-1 py-0 rounded bg-black/40 text-indigo-200 font-mono shrink-0">
                {discussionTokens} tok
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="btn-upload-discussion-doc"
              disabled={isParsingDocument}
              onClick={onTriggerFileUpload}
              className={cn(
                'text-[10px] h-6 flex items-center gap-1 px-2 rounded-md border transition-all font-medium whitespace-nowrap shadow-sm',
                isParsingDocument
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/25 cursor-wait'
                  : 'text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/25'
              )}
              title="Upload tài liệu thảo luận (.pdf, .docx, .txt, .md)"
            >
              {isParsingDocument ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />
                  <span>Đang đọc...</span>
                </>
              ) : (
                <>
                  <Upload className="w-2.5 h-2.5" />
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
