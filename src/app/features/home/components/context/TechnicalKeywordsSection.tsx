import { useState } from 'react'
import { Tag, RefreshCw, Check, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/types/electron.d'
import { jdKeywordExtractor } from '@/services/ai-model/stt'

export interface TechnicalKeywordsSectionProps {
  mode: AppMode
  theme: 'violet' | 'indigo'
  keywords: string[]
  onAddKeyword?: (kw: string) => void
  onRemoveKeyword?: (kw: string) => void
  onReExtractKeywords?: () => void
}

export function TechnicalKeywordsSection({
  mode,
  theme,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  onReExtractKeywords,
}: TechnicalKeywordsSectionProps) {
  const [newKeywordInput, setNewKeywordInput] = useState('')
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false)
  const [extractKeywordsSuccess, setExtractKeywordsSuccess] = useState(false)

  const isViolet = theme === 'violet'
  const accentClass = isViolet ? 'text-violet-400' : 'text-indigo-400'
  const borderClass = isViolet ? 'border-violet-500/30' : 'border-indigo-500/30'
  const bgTagClass = isViolet
    ? 'bg-violet-500/15 hover:bg-violet-500/25'
    : 'bg-indigo-500/15 hover:bg-indigo-500/25'
  const textTagClass = isViolet ? 'text-violet-200' : 'text-indigo-200'
  const btnBgClass = isViolet
    ? 'bg-violet-600 hover:bg-violet-500'
    : 'bg-indigo-600 hover:bg-indigo-500'
  const focusBorder = isViolet
    ? 'focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25'
    : 'focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25'

  const handleReExtract = () => {
    if (isExtractingKeywords || !onReExtractKeywords) return
    setIsExtractingKeywords(true)
    setExtractKeywordsSuccess(false)
    onReExtractKeywords()
    setTimeout(() => {
      setIsExtractingKeywords(false)
      setExtractKeywordsSuccess(true)
      setTimeout(() => {
        setExtractKeywordsSuccess(false)
      }, 1800)
    }, 450)
  }

  const handleAdd = () => {
    const normalized = jdKeywordExtractor.normalizeKeyword(newKeywordInput)
    if (!normalized) return
    onAddKeyword?.(normalized)
    setNewKeywordInput('')
  }

  return (
    <div className="shrink-0 flex flex-col mt-1.5 p-1.5 rounded-xl bg-black/35 border border-white/[0.07] overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0 pb-1 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Tag className={cn('w-3.5 h-3.5 shrink-0', accentClass)} />
          <span className="text-[11px] font-semibold text-white/90 truncate">
            Technical Keywords
          </span>
          {keywords.length > 0 ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[8.5px] px-1.5 py-0 h-3.5 shrink-0 whitespace-nowrap font-mono',
                isViolet
                  ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              )}
            >
              {keywords.length} keywords
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[8.5px] bg-white/5 text-white/40 border-white/10 px-1.5 py-0 h-3.5 shrink-0 whitespace-nowrap"
            >
              0 keywords
            </Badge>
          )}
        </div>

        {onReExtractKeywords && (
          <button
            type="button"
            id="btn-re-extract-keywords"
            disabled={isExtractingKeywords}
            onClick={handleReExtract}
            className={cn(
              'text-[9.5px] flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all shrink-0 whitespace-nowrap shadow-sm select-none',
              isExtractingKeywords
                ? 'bg-violet-500/25 border-violet-400/50 text-white cursor-wait animate-pulse'
                : extractKeywordsSuccess
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : isViolet
                ? 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25 text-white/80 hover:text-white'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/25 text-white/80 hover:text-white'
            )}
            title="Quét lại nội dung để tự động cập nhật danh sách từ khóa kỹ thuật cho Whisper"
          >
            {isExtractingKeywords ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 shrink-0 animate-spin text-violet-300" />
                <span className="whitespace-nowrap font-medium text-violet-200">
                  Đang trích xuất...
                </span>
              </>
            ) : extractKeywordsSuccess ? (
              <>
                <Check className="w-2.5 h-2.5 shrink-0 text-emerald-400 animate-scale-in" />
                <span className="whitespace-nowrap font-medium text-emerald-300">
                  Đã cập nhật!
                </span>
              </>
            ) : (
              <>
                <RefreshCw className="w-2.5 h-2.5 shrink-0 transition-transform group-hover:rotate-180 duration-500" />
                <span className="whitespace-nowrap">
                  Trích xuất lại từ {mode === 'interview' ? 'JD' : 'Chủ đề'}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Scrollable Keyword Tags List */}
      <div
        className={cn(
          'max-h-[48px] overflow-y-auto custom-scrollbar flex flex-wrap content-start items-center gap-1 py-0.5 transition-opacity duration-200',
          isExtractingKeywords && 'opacity-50'
        )}
      >
        {keywords.length > 0 ? (
          keywords.map((kw) => (
            <span
              key={kw}
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9.5px] font-mono transition-all group',
                bgTagClass,
                borderClass,
                textTagClass
              )}
            >
              <span>{kw}</span>
              {onRemoveKeyword && (
                <button
                  type="button"
                  onClick={() => onRemoveKeyword(kw)}
                  className="opacity-50 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-0.5"
                  title={`Xóa keyword "${kw}"`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-white/30 italic py-0.5">
            Chưa có từ khóa kỹ thuật nào được nạp.
          </span>
        )}
      </div>

      {/* Add Keyword Input Bar */}
      <div className="flex items-center gap-1 pt-1 border-t border-white/[0.04]">
        <input
          type="text"
          id="input-new-keyword"
          placeholder="Thêm keyword mới (vd: Redis, Kafka, Kubernetes)..."
          value={newKeywordInput}
          onChange={(e) => setNewKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          className={cn(
            'flex-1 h-5 text-[10px] bg-black/40 border border-white/10 rounded px-1.5 text-white/90 placeholder:text-white/30 transition-all outline-none',
            focusBorder
          )}
        />
        <button
          type="button"
          id="btn-add-keyword"
          onClick={handleAdd}
          disabled={!newKeywordInput.trim()}
          className={cn(
            'h-5 px-1.5 text-[9.5px] font-medium rounded text-white flex items-center gap-0.5 transition-all disabled:opacity-30 disabled:pointer-events-none select-none shrink-0',
            btnBgClass
          )}
        >
          <Plus className="w-2.5 h-2.5 shrink-0" />
          <span>Thêm</span>
        </button>
      </div>
    </div>
  )
}
